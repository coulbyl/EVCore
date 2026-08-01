import { Injectable } from '@nestjs/common';
import { FixtureStatus, Prisma, type Fixture } from '@evcore/db';
import Decimal from 'decimal.js';
import { createLogger } from '@utils/logger';
import { DEFAULT_SEASON_START_MONTH } from '@config/etl.constants';
import { activeSeasons } from '@utils/date.utils';
import { PrismaService } from '@/prisma.service';
import { toPrismaDecimal } from '@utils/prisma.utils';
import { seasonNameFromYear } from '@utils/season.utils';
import { calculateRecentForm, resultForTeam } from './rolling-stats.utils';

const logger = createLogger('rolling-stats-service');
const TEAM_STATS_UPDATE_BATCH_SIZE = 100;

export type FeatureSnapshot = {
  recentForm: Decimal;
  xgFor: Decimal;
  xgAgainst: Decimal;
  homeWinRate: Decimal;
  awayWinRate: Decimal;
  drawRate: Decimal;
  leagueVolatility: Decimal;
};

type RollingStatsRunResult = {
  seasonId: string;
  fixtureCount: number;
  upsertCount: number;
  teamStatsWritten: number;
  createdCount: number;
  updatedCount: number;
  durationMs: number;
};

type SeasonFixture = Pick<
  Fixture,
  | 'id'
  | 'seasonId'
  | 'homeTeamId'
  | 'awayTeamId'
  | 'scheduledAt'
  | 'homeScore'
  | 'awayScore'
  | 'homeXg'
  | 'awayXg'
>;

type TeamStatsRow = {
  teamId: string;
  afterFixtureId: string;
  stats: FeatureSnapshot;
};

type ExistingTeamStatsRow = {
  teamId: string;
  afterFixtureId: string;
  recentForm: Prisma.Decimal;
  xgFor: Prisma.Decimal;
  xgAgainst: Prisma.Decimal;
  homeWinRate: Prisma.Decimal;
  awayWinRate: Prisma.Decimal;
  drawRate: Prisma.Decimal;
  leagueVolatility: Prisma.Decimal;
};

class RollingWindow {
  private readonly entries: Array<{ for: Decimal; against: Decimal }> = [];
  private sumFor = new Decimal(0);
  private sumAgainst = new Decimal(0);

  constructor(private readonly maxSize: number) {}

  push(values: { for: Decimal; against: Decimal }): void {
    this.entries.push(values);
    this.sumFor = this.sumFor.plus(values.for);
    this.sumAgainst = this.sumAgainst.plus(values.against);

    if (this.entries.length > this.maxSize) {
      const removed = this.entries.shift();
      if (removed) {
        this.sumFor = this.sumFor.minus(removed.for);
        this.sumAgainst = this.sumAgainst.minus(removed.against);
      }
    }
  }

  average(): { for: Decimal; against: Decimal } {
    if (this.entries.length === 0) {
      return { for: new Decimal(0), against: new Decimal(0) };
    }

    return {
      for: this.sumFor.div(this.entries.length),
      against: this.sumAgainst.div(this.entries.length),
    };
  }

  get size(): number {
    return this.entries.length;
  }
}

class TeamSeasonAccumulator {
  recentResults: Array<'W' | 'D' | 'L'> = [];
  readonly xgWindow = new RollingWindow(10);
  readonly goalWindow = new RollingWindow(10);
  homeMatches = 0;
  homeWins = 0;
  awayMatches = 0;
  awayWins = 0;
  scoredMatches = 0;
  draws = 0;

  // Sorted ascending coach_tenure start dates for this team (empty when no
  // sync data exists — behaviour is then unchanged from before this field
  // existed). recentForm is a 5-result trailing window (rolling-stats.utils
  // calculateRecentForm); without this, the first match under a new coach
  // is scored using a window still 100% composed of the previous coach's
  // results — backtested 2026-07-25 (db:coach-bounce-backtest): teams
  // outperform that stale-window expectation by +0.08 pt/match on average
  // (positive across every home/away × opponent-strength stratum), and
  // recentForm stays measurably below the dataset average through the
  // entire 5-match window after a change (0.377 → 0.432 vs a 0.461
  // baseline) — i.e. it's a lagging indicator, not an already-priced-in one.
  private coachStarts: Date[] = [];
  private coachIndex = -1;

  setCoachStarts(starts: Date[]): void {
    this.coachStarts = starts;
  }

  // Re-centers recentForm at each coach change by dropping the window
  // instead of letting it straddle two coaches' results.
  private advanceCoachAndResetOnChange(asOf: Date): void {
    if (this.coachStarts.length === 0) return;

    let index = this.coachIndex;
    while (index + 1 < this.coachStarts.length) {
      const nextStart = this.coachStarts[index + 1];
      if (!nextStart || nextStart.getTime() > asOf.getTime()) break;
      index += 1;
    }

    if (index !== this.coachIndex) {
      this.recentResults = [];
      this.coachIndex = index;
    }
  }

  addFixture(fixture: SeasonFixture, teamId: string): void {
    this.advanceCoachAndResetOnChange(fixture.scheduledAt);

    const result = resultForTeam(fixture as Fixture, teamId);
    if (result) {
      this.recentResults.push(result);
      if (this.recentResults.length > 5) {
        this.recentResults.shift();
      }
    }

    const isHome = fixture.homeTeamId === teamId;
    const goalsFor = isHome ? fixture.homeScore : fixture.awayScore;
    const goalsAgainst = isHome ? fixture.awayScore : fixture.homeScore;
    const xgFor = isHome ? fixture.homeXg : fixture.awayXg;
    const xgAgainst = isHome ? fixture.awayXg : fixture.homeXg;

    if (goalsFor !== null && goalsAgainst !== null) {
      this.goalWindow.push({
        for: new Decimal(goalsFor),
        against: new Decimal(goalsAgainst),
      });

      this.scoredMatches += 1;
      if (goalsFor === goalsAgainst) {
        this.draws += 1;
      }

      if (isHome) {
        this.homeMatches += 1;
        if (goalsFor > goalsAgainst) {
          this.homeWins += 1;
        }
      } else {
        this.awayMatches += 1;
        if (goalsFor > goalsAgainst) {
          this.awayWins += 1;
        }
      }
    }

    if (xgFor !== null && xgAgainst !== null) {
      this.xgWindow.push({
        for: new Decimal(xgFor),
        against: new Decimal(xgAgainst),
      });
    }
  }

  snapshot(leagueVolatility: Decimal): FeatureSnapshot {
    const rolling =
      this.xgWindow.size > 0
        ? this.xgWindow.average()
        : this.goalWindow.average();

    return {
      recentForm: calculateRecentForm(this.recentResults),
      xgFor: rolling.for,
      xgAgainst: rolling.against,
      homeWinRate:
        this.homeMatches > 0
          ? new Decimal(this.homeWins).div(this.homeMatches)
          : new Decimal(0),
      awayWinRate:
        this.awayMatches > 0
          ? new Decimal(this.awayWins).div(this.awayMatches)
          : new Decimal(0),
      drawRate:
        this.scoredMatches > 0
          ? new Decimal(this.draws).div(this.scoredMatches)
          : new Decimal(0),
      leagueVolatility,
    };
  }
}

class LeagueVolatilityAccumulator {
  private count = 0;
  private mean = new Decimal(0);
  private m2 = new Decimal(0);

  addFixture(fixture: SeasonFixture): void {
    if (fixture.homeScore === null || fixture.awayScore === null) {
      return;
    }

    const totalGoals = new Decimal(fixture.homeScore).plus(fixture.awayScore);
    this.count += 1;

    const delta = totalGoals.minus(this.mean);
    this.mean = this.mean.plus(delta.div(this.count));
    const delta2 = totalGoals.minus(this.mean);
    this.m2 = this.m2.plus(delta.times(delta2));
  }

  value(): Decimal {
    if (this.count < 2) {
      return new Decimal(0);
    }

    return this.m2.div(this.count).sqrt();
  }
}

@Injectable()
export class RollingStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async backfillSeasonYear(
    year: number,
    competitionCode: string,
  ): Promise<RollingStatsRunResult> {
    const seasonStartMonth =
      await this.resolveSeasonStartMonth(competitionCode);
    const season = await this.prisma.client.season.findFirst({
      where: {
        name: seasonNameFromYear(year, seasonStartMonth, competitionCode),
        competition: { code: competitionCode },
      },
      select: { id: true },
    });

    if (!season) {
      throw new Error(`season not found for year ${year}`);
    }

    return this.backfillSeason(season.id);
  }

  async backfillLeague(competitionCode: string): Promise<
    Array<
      {
        year: number;
      } & RollingStatsRunResult
    >
  > {
    const competition = await this.prisma.client.competition.findFirst({
      where: { code: competitionCode, isActive: true },
      select: { code: true, seasonStartMonth: true },
    });
    if (!competition) {
      throw new Error(`competition not found: ${competitionCode}`);
    }

    const seasons = activeSeasons(
      competition.seasonStartMonth ?? DEFAULT_SEASON_START_MONTH,
      1,
    );

    const results: Array<{ year: number } & RollingStatsRunResult> = [];

    for (const year of seasons) {
      const result = await this.backfillSeasonYear(year, competition.code);
      results.push({ year, ...result });
    }

    return results;
  }

  async backfillAllConfiguredSeasons(): Promise<
    Array<
      {
        competitionCode: string;
        year: number;
      } & RollingStatsRunResult
    >
  > {
    const results: Array<
      { competitionCode: string; year: number } & RollingStatsRunResult
    > = [];

    const competitions = await this.prisma.client.competition.findMany({
      where: { isActive: true },
      select: { code: true, seasonStartMonth: true },
    });

    for (const competition of competitions) {
      const seasons = activeSeasons(
        competition.seasonStartMonth ?? DEFAULT_SEASON_START_MONTH,
        1,
      );
      for (const year of seasons) {
        const result = await this.backfillSeasonYear(year, competition.code);
        results.push({ competitionCode: competition.code, year, ...result });
      }
    }

    return results;
  }

  async refreshSeasonYear(
    year: number,
    competitionCode: string,
  ): Promise<RollingStatsRunResult> {
    const seasonStartMonth =
      await this.resolveSeasonStartMonth(competitionCode);
    const season = await this.prisma.client.season.findFirst({
      where: {
        name: seasonNameFromYear(year, seasonStartMonth, competitionCode),
        competition: { code: competitionCode },
      },
      select: { id: true },
    });

    if (!season) {
      throw new Error(`season not found for year ${year}`);
    }

    return this.refreshSeason(season.id);
  }

  private async resolveSeasonStartMonth(
    competitionCode: string,
  ): Promise<number> {
    const competition = await this.prisma.client.competition.findFirst({
      where: { code: competitionCode },
      select: { seasonStartMonth: true },
    });
    if (!competition) {
      throw new Error(`competition not found: ${competitionCode}`);
    }
    return competition.seasonStartMonth ?? DEFAULT_SEASON_START_MONTH;
  }

  async refreshLeague(
    competitionCode: string,
  ): Promise<Array<{ year: number } & RollingStatsRunResult>> {
    const competition = await this.prisma.client.competition.findFirst({
      where: { code: competitionCode, isActive: true },
      select: { code: true, seasonStartMonth: true },
    });
    if (!competition) {
      throw new Error(`competition not found: ${competitionCode}`);
    }

    const seasons = activeSeasons(
      competition.seasonStartMonth ?? DEFAULT_SEASON_START_MONTH,
      1,
    );

    const results: Array<{ year: number } & RollingStatsRunResult> = [];

    for (const year of seasons) {
      const result = await this.refreshSeasonYear(year, competition.code);
      results.push({ year, ...result });
    }

    return results;
  }

  async refreshAllConfiguredSeasons(): Promise<
    Array<{ competitionCode: string; year: number } & RollingStatsRunResult>
  > {
    const results: Array<
      { competitionCode: string; year: number } & RollingStatsRunResult
    > = [];

    const competitions = await this.prisma.client.competition.findMany({
      where: { isActive: true },
      select: { code: true, seasonStartMonth: true },
    });

    for (const competition of competitions) {
      const seasons = activeSeasons(
        competition.seasonStartMonth ?? DEFAULT_SEASON_START_MONTH,
        1,
      );
      for (const year of seasons) {
        const result = await this.refreshSeasonYear(year, competition.code);
        results.push({ competitionCode: competition.code, year, ...result });
      }
    }

    return results;
  }

  async backfillSeason(seasonId: string): Promise<RollingStatsRunResult> {
    logger.info({ seasonId }, 'Starting rolling-stats backfill');
    const startedAt = Date.now();

    const fixtures = await this.loadFinishedSeasonFixtures(seasonId);
    const coachStartsByTeam = await this.loadCoachStartsByTeam(
      this.teamIdsFromFixtures(fixtures),
    );
    const rows = this.computeSeasonRows(fixtures, coachStartsByTeam);
    const existingRows = await this.loadExistingTeamStats(seasonId);
    const { createdCount, updatedCount } = await this.persistSeasonRows(
      rows,
      existingRows,
    );

    const durationMs = Date.now() - startedAt;
    const teamStatsWritten = createdCount + updatedCount;

    logger.info(
      {
        seasonId,
        fixtureCount: fixtures.length,
        teamStatsWritten,
        createdCount,
        updatedCount,
        durationMs,
      },
      'Rolling-stats backfill complete',
    );

    return {
      seasonId,
      fixtureCount: fixtures.length,
      upsertCount: teamStatsWritten,
      teamStatsWritten,
      createdCount,
      updatedCount,
      durationMs,
    };
  }

  async refreshSeason(seasonId: string): Promise<RollingStatsRunResult> {
    logger.info({ seasonId }, 'Starting rolling-stats refresh');
    const startedAt = Date.now();

    const fixtures = await this.loadFinishedSeasonFixtures(seasonId);
    const existingRows = await this.loadExistingTeamStats(seasonId);
    const firstMissingFixtureIndex = this.findFirstIncompleteFixtureIndex(
      fixtures,
      existingRows,
    );

    if (firstMissingFixtureIndex === -1) {
      const durationMs = Date.now() - startedAt;
      logger.info(
        {
          seasonId,
          fixtureCount: fixtures.length,
          teamStatsWritten: 0,
          durationMs,
        },
        'Rolling-stats refresh complete',
      );

      return {
        seasonId,
        fixtureCount: fixtures.length,
        upsertCount: 0,
        teamStatsWritten: 0,
        createdCount: 0,
        updatedCount: 0,
        durationMs,
      };
    }

    const fixtureIdsToRefresh = new Set(
      fixtures.slice(firstMissingFixtureIndex).map((fixture) => fixture.id),
    );
    const coachStartsByTeam = await this.loadCoachStartsByTeam(
      this.teamIdsFromFixtures(fixtures),
    );
    const rows = this.computeSeasonRows(fixtures, coachStartsByTeam).filter(
      (row) => fixtureIdsToRefresh.has(row.afterFixtureId),
    );
    const { createdCount, updatedCount } = await this.persistSeasonRows(
      rows,
      existingRows,
    );

    const durationMs = Date.now() - startedAt;
    const teamStatsWritten = createdCount + updatedCount;

    logger.info(
      {
        seasonId,
        fixtureCount: fixtures.length,
        refreshStartFixtureId: fixtures[firstMissingFixtureIndex]?.id,
        teamStatsWritten,
        createdCount,
        updatedCount,
        durationMs,
      },
      'Rolling-stats refresh complete',
    );

    return {
      seasonId,
      fixtureCount: fixtures.length,
      upsertCount: teamStatsWritten,
      teamStatsWritten,
      createdCount,
      updatedCount,
      durationMs,
    };
  }

  async computeAndStore(teamId: string, afterFixtureId: string): Promise<void> {
    const stats = await this.computeStats(teamId, afterFixtureId);

    await this.prisma.client.teamStats.upsert({
      where: { teamId_afterFixtureId: { teamId, afterFixtureId } },
      create: {
        teamId,
        afterFixtureId,
        recentForm: toPrismaDecimal(stats.recentForm, 4),
        xgFor: toPrismaDecimal(stats.xgFor, 3),
        xgAgainst: toPrismaDecimal(stats.xgAgainst, 3),
        homeWinRate: toPrismaDecimal(stats.homeWinRate, 4),
        awayWinRate: toPrismaDecimal(stats.awayWinRate, 4),
        drawRate: toPrismaDecimal(stats.drawRate, 4),
        leagueVolatility: toPrismaDecimal(stats.leagueVolatility, 4),
      },
      update: {
        recentForm: toPrismaDecimal(stats.recentForm, 4),
        xgFor: toPrismaDecimal(stats.xgFor, 3),
        xgAgainst: toPrismaDecimal(stats.xgAgainst, 3),
        homeWinRate: toPrismaDecimal(stats.homeWinRate, 4),
        awayWinRate: toPrismaDecimal(stats.awayWinRate, 4),
        drawRate: toPrismaDecimal(stats.drawRate, 4),
        leagueVolatility: toPrismaDecimal(stats.leagueVolatility, 4),
      },
    });
  }

  async computeStats(
    teamId: string,
    afterFixtureId: string,
  ): Promise<FeatureSnapshot> {
    const afterFixture = await this.prisma.client.fixture.findUnique({
      where: { id: afterFixtureId },
      select: { id: true, seasonId: true, scheduledAt: true },
    });

    if (!afterFixture) {
      throw new Error(`afterFixture not found: ${afterFixtureId}`);
    }

    const finishedFixtures = await this.loadFinishedSeasonFixtures(
      afterFixture.seasonId,
    );
    const fixturesUpToTarget = finishedFixtures.filter(
      (fixture) => fixture.scheduledAt <= afterFixture.scheduledAt,
    );
    const coachStartsByTeam = await this.loadCoachStartsByTeam(
      this.teamIdsFromFixtures(fixturesUpToTarget),
    );
    const rows = this.computeSeasonRows(fixturesUpToTarget, coachStartsByTeam);
    const row = rows.find(
      (entry) =>
        entry.teamId === teamId && entry.afterFixtureId === afterFixture.id,
    );

    if (row) {
      return row.stats;
    }

    const teamAccumulator = new TeamSeasonAccumulator();
    teamAccumulator.setCoachStarts(coachStartsByTeam.get(teamId) ?? []);
    const leagueAccumulator = new LeagueVolatilityAccumulator();

    for (const fixture of fixturesUpToTarget) {
      leagueAccumulator.addFixture(fixture);
      if (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId) {
        teamAccumulator.addFixture(fixture, teamId);
      }
    }

    return teamAccumulator.snapshot(leagueAccumulator.value());
  }

  private async loadFinishedSeasonFixtures(
    seasonId: string,
  ): Promise<SeasonFixture[]> {
    return this.prisma.client.fixture.findMany({
      where: { seasonId, status: FixtureStatus.FINISHED },
      select: {
        id: true,
        seasonId: true,
        homeTeamId: true,
        awayTeamId: true,
        scheduledAt: true,
        homeScore: true,
        awayScore: true,
        homeXg: true,
        awayXg: true,
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    });
  }

  private computeSeasonRows(
    fixtures: SeasonFixture[],
    coachStartsByTeam: Map<string, Date[]>,
  ): TeamStatsRow[] {
    const teamAccumulators = new Map<string, TeamSeasonAccumulator>();
    const leagueAccumulator = new LeagueVolatilityAccumulator();
    const rows: TeamStatsRow[] = [];

    for (const fixture of fixtures) {
      leagueAccumulator.addFixture(fixture);

      const homeAccumulator = this.getTeamAccumulator(
        teamAccumulators,
        fixture.homeTeamId,
        coachStartsByTeam,
      );
      homeAccumulator.addFixture(fixture, fixture.homeTeamId);

      const awayAccumulator = this.getTeamAccumulator(
        teamAccumulators,
        fixture.awayTeamId,
        coachStartsByTeam,
      );
      awayAccumulator.addFixture(fixture, fixture.awayTeamId);

      const leagueVolatility = leagueAccumulator.value();

      rows.push({
        teamId: fixture.homeTeamId,
        afterFixtureId: fixture.id,
        stats: homeAccumulator.snapshot(leagueVolatility),
      });
      rows.push({
        teamId: fixture.awayTeamId,
        afterFixtureId: fixture.id,
        stats: awayAccumulator.snapshot(leagueVolatility),
      });
    }

    return rows;
  }

  private findFirstIncompleteFixtureIndex(
    fixtures: SeasonFixture[],
    existingRows: Map<string, ExistingTeamStatsRow>,
  ): number {
    for (let i = 0; i < fixtures.length; i += 1) {
      const fixture = fixtures[i];
      const hasHomeRow = existingRows.has(
        this.teamStatsKey(fixture.homeTeamId, fixture.id),
      );
      const hasAwayRow = existingRows.has(
        this.teamStatsKey(fixture.awayTeamId, fixture.id),
      );

      if (!hasHomeRow || !hasAwayRow) {
        return i;
      }
    }

    return -1;
  }

  private getTeamAccumulator(
    index: Map<string, TeamSeasonAccumulator>,
    teamId: string,
    coachStartsByTeam: Map<string, Date[]>,
  ): TeamSeasonAccumulator {
    let accumulator = index.get(teamId);
    if (!accumulator) {
      accumulator = new TeamSeasonAccumulator();
      accumulator.setCoachStarts(coachStartsByTeam.get(teamId) ?? []);
      index.set(teamId, accumulator);
    }
    return accumulator;
  }

  // Sorted ascending per team — TeamSeasonAccumulator walks this with a
  // forward-only pointer as it processes that team's fixtures in
  // chronological order, so ascending order here is load-bearing.
  private async loadCoachStartsByTeam(
    teamIds: readonly string[],
  ): Promise<Map<string, Date[]>> {
    if (teamIds.length === 0) return new Map();

    const rows = await this.prisma.client.coachTenure.findMany({
      where: { teamId: { in: [...teamIds] } },
      select: { teamId: true, startDate: true },
      orderBy: { startDate: 'asc' },
    });

    const byTeam = new Map<string, Date[]>();
    for (const row of rows) {
      const starts = byTeam.get(row.teamId);
      if (starts) {
        starts.push(row.startDate);
      } else {
        byTeam.set(row.teamId, [row.startDate]);
      }
    }
    return byTeam;
  }

  private teamIdsFromFixtures(fixtures: SeasonFixture[]): string[] {
    const ids = new Set<string>();
    for (const fixture of fixtures) {
      ids.add(fixture.homeTeamId);
      ids.add(fixture.awayTeamId);
    }
    return [...ids];
  }

  private async loadExistingTeamStats(
    seasonId: string,
  ): Promise<Map<string, ExistingTeamStatsRow>> {
    const rows = await this.prisma.client.teamStats.findMany({
      where: { afterFixture: { seasonId } },
      select: {
        teamId: true,
        afterFixtureId: true,
        recentForm: true,
        xgFor: true,
        xgAgainst: true,
        homeWinRate: true,
        awayWinRate: true,
        drawRate: true,
        leagueVolatility: true,
      },
    });

    return new Map(
      rows.map((row) => [
        this.teamStatsKey(row.teamId, row.afterFixtureId),
        row,
      ]),
    );
  }

  private async persistSeasonRows(
    rows: TeamStatsRow[],
    existingRows: Map<string, ExistingTeamStatsRow>,
  ): Promise<{ createdCount: number; updatedCount: number }> {
    const creates: Prisma.TeamStatsCreateManyInput[] = [];
    const updates: TeamStatsRow[] = [];

    for (const row of rows) {
      const key = this.teamStatsKey(row.teamId, row.afterFixtureId);
      const existing = existingRows.get(key);

      if (!existing) {
        creates.push(this.serializeTeamStatsRow(row));
        continue;
      }

      if (this.hasStatsChanged(existing, row.stats)) {
        updates.push(row);
      }
    }

    if (creates.length > 0) {
      await this.prisma.client.teamStats.createMany({
        data: creates,
        skipDuplicates: true,
      });
    }

    for (const batch of this.chunk(updates, TEAM_STATS_UPDATE_BATCH_SIZE)) {
      await this.prisma.client.$transaction(
        batch.map((row) =>
          this.prisma.client.teamStats.update({
            where: {
              teamId_afterFixtureId: {
                teamId: row.teamId,
                afterFixtureId: row.afterFixtureId,
              },
            },
            data: this.serializeTeamStatsData(row.stats),
          }),
        ),
      );
    }

    return { createdCount: creates.length, updatedCount: updates.length };
  }

  private serializeTeamStatsRow(
    row: TeamStatsRow,
  ): Prisma.TeamStatsCreateManyInput {
    return {
      teamId: row.teamId,
      afterFixtureId: row.afterFixtureId,
      ...this.serializeTeamStatsData(row.stats),
    };
  }

  private serializeTeamStatsData(
    stats: FeatureSnapshot,
  ): Pick<
    Prisma.TeamStatsCreateManyInput,
    | 'recentForm'
    | 'xgFor'
    | 'xgAgainst'
    | 'homeWinRate'
    | 'awayWinRate'
    | 'drawRate'
    | 'leagueVolatility'
  > {
    return {
      recentForm: toPrismaDecimal(stats.recentForm, 4),
      xgFor: toPrismaDecimal(stats.xgFor, 3),
      xgAgainst: toPrismaDecimal(stats.xgAgainst, 3),
      homeWinRate: toPrismaDecimal(stats.homeWinRate, 4),
      awayWinRate: toPrismaDecimal(stats.awayWinRate, 4),
      drawRate: toPrismaDecimal(stats.drawRate, 4),
      leagueVolatility: toPrismaDecimal(stats.leagueVolatility, 4),
    };
  }

  private hasStatsChanged(
    existing: ExistingTeamStatsRow,
    next: FeatureSnapshot,
  ): boolean {
    return (
      !new Decimal(existing.recentForm).equals(next.recentForm) ||
      !new Decimal(existing.xgFor).equals(next.xgFor) ||
      !new Decimal(existing.xgAgainst).equals(next.xgAgainst) ||
      !new Decimal(existing.homeWinRate).equals(next.homeWinRate) ||
      !new Decimal(existing.awayWinRate).equals(next.awayWinRate) ||
      !new Decimal(existing.drawRate).equals(next.drawRate) ||
      !new Decimal(existing.leagueVolatility).equals(next.leagueVolatility)
    );
  }

  private teamStatsKey(teamId: string, afterFixtureId: string): string {
    return `${teamId}:${afterFixtureId}`;
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }
}
