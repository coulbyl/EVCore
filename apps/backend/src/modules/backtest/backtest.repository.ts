import { Injectable } from '@nestjs/common';
import {
  BetStatus,
  FixtureStatus,
  Market,
  Prisma,
  StrategyChannel,
} from '@evcore/db';
import { PrismaService } from '@/prisma.service';

/** One settled channel selection, localised by competition/season. */
export type SettledChannelRow = {
  channel: StrategyChannel;
  competitionCode: string;
  competitionName: string;
  seasonName: string;
  probability: Prisma.Decimal;
  ev: Prisma.Decimal | null;
  odds: Prisma.Decimal | null;
  won: boolean;
};

/** One finished fixture's model 1X2 probabilities + realised outcome. */
export type ModelProbabilityRow = {
  competitionCode: string;
  competitionName: string;
  seasonName: string;
  features: Prisma.JsonValue;
  homeScore: number;
  awayScore: number;
};

/**
 * One finished fixture's tuning inputs: the channel signals (from the model
 * feature snapshot), the latest prematch odds, and the realised score. Feeds
 * the offline threshold sweep — every config channel's selection is recoverable
 * from this row at any candidate threshold without re-running the engine.
 */
export type ChannelTuningRow = {
  competitionCode: string;
  competitionName: string;
  homeScore: number;
  awayScore: number;
  // Half-time scores — only WIN_EITHER_HALF's outcome needs them; null when
  // the fixture has no recorded HT score (pre-live-sync history).
  homeHtScore: number | null;
  awayHtScore: number | null;
  probHome: number;
  probDraw: number;
  probAway: number;
  probBttsYes: number | null;
  probBttsNo: number | null;
  // GOALS (Over/Under) — 2.5 has the deepest odds history (the-odds-api
  // backfill); 1.5/3.5/4.5 odds coverage confirmed 2026-07-28 (PREMATCH sync,
  // 2600/2603/1611 fixtures respectively) — swept the same way now.
  probOver15: number | null;
  probUnder15: number | null;
  probOver25: number | null;
  probUnder25: number | null;
  probOver35: number | null;
  probUnder35: number | null;
  probOver45: number | null;
  probUnder45: number | null;
  // CLEAN_SHEET / WIN_EITHER_HALF — forward-only odds coverage (PREMATCH sync,
  // started 2026-07-18), see CLEAN_SHEET_CONFIG/WIN_EITHER_HALF_CONFIG header.
  probCleanSheetHome: number | null;
  probCleanSheetAway: number | null;
  probWinEitherHalfHome: number | null;
  probWinEitherHalfAway: number | null;
  // TEAM_TOTAL — raw pick->probability maps (mirrors ModelRun.features.
  // probabilities.teamTotalHome/Away, keys like "OVER_1_5") instead of one
  // flat field per (line × side): avoids a ~20-field explosion for a market
  // with 5 lines × 2 sides per team. Forward-only odds (PREMATCH sync,
  // confirmed 2026-07-28, 417 fixtures per team).
  probTeamTotalHome: Record<string, number> | null;
  probTeamTotalAway: Record<string, number> | null;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  oddsBttsYes: number | null;
  oddsBttsNo: number | null;
  oddsOver15: number | null;
  oddsUnder15: number | null;
  oddsOver25: number | null;
  oddsUnder25: number | null;
  oddsOver35: number | null;
  oddsUnder35: number | null;
  oddsOver45: number | null;
  oddsUnder45: number | null;
  oddsCleanSheetHome: number | null;
  oddsCleanSheetAway: number | null;
  oddsWinEitherHalfHome: number | null;
  oddsWinEitherHalfAway: number | null;
  oddsTeamTotalHome: Record<string, number> | null;
  oddsTeamTotalAway: Record<string, number> | null;
};

/**
 * DB reads for the redesigned, per-channel backtest. Everything is sourced from
 * the engine's own outputs (`channel_selection`, `model_run.features`) — the
 * backtest never re-implements scoring.
 */
@Injectable()
export class BacktestRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Settled channel selections in a date window, optionally one competition. */
  async findSettledChannelRows(opts: {
    from: Date;
    to: Date;
    competitionCode?: string;
  }): Promise<SettledChannelRow[]> {
    const { from, to, competitionCode } = opts;
    const rows = await this.prisma.client.channelSelection.findMany({
      where: {
        result: { in: [BetStatus.WON, BetStatus.LOST] },
        channelDecision: {
          is: {
            modelRun: {
              is: {
                fixture: {
                  is: {
                    scheduledAt: { gte: from, lte: to },
                    ...(competitionCode
                      ? { season: { competition: { code: competitionCode } } }
                      : {}),
                  },
                },
              },
            },
          },
        },
      },
      select: {
        probability: true,
        ev: true,
        odds: true,
        result: true,
        channelDecision: {
          select: {
            channel: true,
            modelRun: {
              select: {
                fixture: {
                  select: {
                    season: {
                      select: {
                        name: true,
                        competition: { select: { code: true, name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return rows.map((r) => {
      const season = r.channelDecision.modelRun.fixture.season;
      return {
        channel: r.channelDecision.channel,
        competitionCode: season.competition.code,
        competitionName: season.competition.name,
        seasonName: season.name,
        probability: r.probability,
        ev: r.ev,
        odds: r.odds,
        won: r.result === BetStatus.WON,
      };
    });
  }

  /**
   * Latest model run per finished fixture in a window, with its feature snapshot
   * (probabilities) and realised score — feeds Brier/ECE model calibration.
   */
  async findModelProbabilityRows(opts: {
    from: Date;
    to: Date;
    competitionCode?: string;
  }): Promise<ModelProbabilityRow[]> {
    const { from, to, competitionCode } = opts;
    const fixtures = await this.prisma.client.fixture.findMany({
      where: {
        status: FixtureStatus.FINISHED,
        homeScore: { not: null },
        awayScore: { not: null },
        scheduledAt: { gte: from, lte: to },
        ...(competitionCode
          ? { season: { competition: { code: competitionCode } } }
          : {}),
      },
      select: {
        homeScore: true,
        awayScore: true,
        season: {
          select: {
            name: true,
            competition: { select: { code: true, name: true } },
          },
        },
        modelRuns: {
          select: { features: true },
          orderBy: { analyzedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    });

    const rows: ModelProbabilityRow[] = [];
    for (const f of fixtures) {
      const run = f.modelRuns[0];
      if (!run || f.homeScore === null || f.awayScore === null) continue;
      rows.push({
        competitionCode: f.season.competition.code,
        competitionName: f.season.competition.name,
        seasonName: f.season.name,
        features: run.features,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
      });
    }
    return rows;
  }

  /**
   * Per-finished-fixture tuning inputs: model signals (1X2 + BTTS) from the
   * latest run's feature snapshot, latest prematch odds (1X2 + BTTS YES), and
   * the realised score. The odds use the most recent snapshot per market — an
   * offline approximation of the live "best bookmaker" selection, good enough
   * to rank candidate thresholds.
   */
  async findChannelTuningRows(opts: {
    from: Date;
    to: Date;
    competitionCode?: string;
  }): Promise<ChannelTuningRow[]> {
    const { from, to, competitionCode } = opts;
    const fixtureWhere = {
      status: FixtureStatus.FINISHED,
      homeScore: { not: null },
      awayScore: { not: null },
      scheduledAt: { gte: from, lte: to },
      ...(competitionCode
        ? { season: { competition: { code: competitionCode } } }
        : {}),
    } satisfies Prisma.FixtureWhereInput;

    const fixtures = await this.prisma.client.fixture.findMany({
      where: fixtureWhere,
      select: {
        id: true,
        homeScore: true,
        awayScore: true,
        homeHtScore: true,
        awayHtScore: true,
        season: {
          select: { competition: { select: { code: true, name: true } } },
        },
        modelRuns: {
          select: { features: true },
          orderBy: { analyzedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    });

    const oneXTwoByFixture = await this.latestOneXTwoOdds(to, fixtureWhere);
    const bttsYesByFixture = await this.latestBttsOdds(to, fixtureWhere, 'YES');
    const bttsNoByFixture = await this.latestBttsOdds(to, fixtureWhere, 'NO');
    const over15ByFixture = await this.latestOverUnderOdds({
      to,
      fixtureWhere,
      side: 'OVER',
      line: 1.5,
    });
    const under15ByFixture = await this.latestOverUnderOdds({
      to,
      fixtureWhere,
      side: 'UNDER',
      line: 1.5,
    });
    const overByFixture = await this.latestOverUnderOdds({
      to,
      fixtureWhere,
      side: 'OVER',
      line: 2.5,
    });
    const underByFixture = await this.latestOverUnderOdds({
      to,
      fixtureWhere,
      side: 'UNDER',
      line: 2.5,
    });
    const over35ByFixture = await this.latestOverUnderOdds({
      to,
      fixtureWhere,
      side: 'OVER',
      line: 3.5,
    });
    const under35ByFixture = await this.latestOverUnderOdds({
      to,
      fixtureWhere,
      side: 'UNDER',
      line: 3.5,
    });
    const over45ByFixture = await this.latestOverUnderOdds({
      to,
      fixtureWhere,
      side: 'OVER',
      line: 4.5,
    });
    const under45ByFixture = await this.latestOverUnderOdds({
      to,
      fixtureWhere,
      side: 'UNDER',
      line: 4.5,
    });
    const teamTotalHomeByFixture = await this.latestTeamTotalOdds(
      to,
      fixtureWhere,
      Market.TEAM_TOTAL_HOME,
    );
    const teamTotalAwayByFixture = await this.latestTeamTotalOdds(
      to,
      fixtureWhere,
      Market.TEAM_TOTAL_AWAY,
    );
    const cleanSheetHomeByFixture = await this.latestSimpleOdds({
      to,
      fixtureWhere,
      market: Market.CLEAN_SHEET_HOME,
      pick: 'YES',
    });
    const cleanSheetAwayByFixture = await this.latestSimpleOdds({
      to,
      fixtureWhere,
      market: Market.CLEAN_SHEET_AWAY,
      pick: 'YES',
    });
    const winEitherHalfHomeByFixture = await this.latestSimpleOdds({
      to,
      fixtureWhere,
      market: Market.TO_WIN_EITHER_HALF,
      pick: 'HOME',
    });
    const winEitherHalfAwayByFixture = await this.latestSimpleOdds({
      to,
      fixtureWhere,
      market: Market.TO_WIN_EITHER_HALF,
      pick: 'AWAY',
    });

    const rows: ChannelTuningRow[] = [];
    for (const f of fixtures) {
      const run = f.modelRuns[0];
      if (!run || f.homeScore === null || f.awayScore === null) continue;
      const probs = readSignalProbabilities(run.features);
      if (!probs) continue;
      const oneXTwo = oneXTwoByFixture.get(f.id) ?? null;
      rows.push({
        competitionCode: f.season.competition.code,
        competitionName: f.season.competition.name,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        homeHtScore: f.homeHtScore,
        awayHtScore: f.awayHtScore,
        probHome: probs.home,
        probDraw: probs.draw,
        probAway: probs.away,
        probBttsYes: probs.bttsYes,
        probBttsNo: probs.bttsNo,
        probOver15: probs.over15,
        probUnder15: probs.under15,
        probOver25: probs.over25,
        probUnder25: probs.under25,
        probOver35: probs.over35,
        probUnder35: probs.under35,
        probOver45: probs.over45,
        probUnder45: probs.under45,
        probCleanSheetHome: probs.cleanSheetHome,
        probCleanSheetAway: probs.cleanSheetAway,
        probWinEitherHalfHome: probs.winEitherHalfHome,
        probWinEitherHalfAway: probs.winEitherHalfAway,
        probTeamTotalHome: probs.teamTotalHome,
        probTeamTotalAway: probs.teamTotalAway,
        oddsHome: oneXTwo?.home ?? null,
        oddsDraw: oneXTwo?.draw ?? null,
        oddsAway: oneXTwo?.away ?? null,
        oddsBttsYes: bttsYesByFixture.get(f.id) ?? null,
        oddsBttsNo: bttsNoByFixture.get(f.id) ?? null,
        oddsOver15: over15ByFixture.get(f.id) ?? null,
        oddsUnder15: under15ByFixture.get(f.id) ?? null,
        oddsOver25: overByFixture.get(f.id) ?? null,
        oddsUnder25: underByFixture.get(f.id) ?? null,
        oddsOver35: over35ByFixture.get(f.id) ?? null,
        oddsUnder35: under35ByFixture.get(f.id) ?? null,
        oddsOver45: over45ByFixture.get(f.id) ?? null,
        oddsUnder45: under45ByFixture.get(f.id) ?? null,
        oddsCleanSheetHome: cleanSheetHomeByFixture.get(f.id) ?? null,
        oddsCleanSheetAway: cleanSheetAwayByFixture.get(f.id) ?? null,
        oddsWinEitherHalfHome: winEitherHalfHomeByFixture.get(f.id) ?? null,
        oddsWinEitherHalfAway: winEitherHalfAwayByFixture.get(f.id) ?? null,
        oddsTeamTotalHome: teamTotalHomeByFixture.get(f.id) ?? null,
        oddsTeamTotalAway: teamTotalAwayByFixture.get(f.id) ?? null,
      });
    }
    return rows;
  }

  /** Latest Over/Under odds (one line × side) per fixture in the window. The
   * 2.5 line is stored with bare 'OVER'/'UNDER' picks (deepest historical
   * coverage, the-odds-api backfill); every other line is suffixed
   * ("OVER_1_5" etc, PREMATCH sync only) — confirmed against odds_snapshot
   * 2026-07-28, no "OVER_2_5" pick exists. */
  private async latestOverUnderOdds(opts: {
    to: Date;
    fixtureWhere: Prisma.FixtureWhereInput;
    side: 'OVER' | 'UNDER';
    line: 1.5 | 2.5 | 3.5 | 4.5;
  }): Promise<Map<string, number>> {
    const { to, fixtureWhere, side, line } = opts;
    const pick =
      line === 2.5 ? side : `${side}_${String(line).replace('.', '_')}`;
    const snapshots = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        market: Market.OVER_UNDER,
        pick,
        odds: { not: null },
        snapshotAt: { lte: to },
        fixture: { is: fixtureWhere },
      },
      select: { fixtureId: true, odds: true },
      orderBy: [{ fixtureId: 'asc' }, { snapshotAt: 'desc' }],
    });
    const byFixture = new Map<string, number>();
    for (const s of snapshots) {
      if (byFixture.has(s.fixtureId) || s.odds === null) continue;
      byFixture.set(s.fixtureId, Number(s.odds));
    }
    return byFixture;
  }

  /** Latest TEAM_TOTAL odds for one team (all lines × sides at once) per
   * fixture in the window — one query instead of 10 (5 lines × 2 sides),
   * bucketed client-side into a {pick: odds} map per fixture (same shape as
   * ModelRun.features.probabilities.teamTotalHome/Away). */
  private async latestTeamTotalOdds(
    to: Date,
    fixtureWhere: Prisma.FixtureWhereInput,
    market: typeof Market.TEAM_TOTAL_HOME | typeof Market.TEAM_TOTAL_AWAY,
  ): Promise<Map<string, Record<string, number>>> {
    const snapshots = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        market,
        pick: { not: null },
        odds: { not: null },
        snapshotAt: { lte: to },
        fixture: { is: fixtureWhere },
      },
      select: { fixtureId: true, pick: true, odds: true },
      orderBy: [{ fixtureId: 'asc' }, { pick: 'asc' }, { snapshotAt: 'desc' }],
    });
    const byFixture = new Map<string, Record<string, number>>();
    const seen = new Set<string>();
    for (const s of snapshots) {
      if (s.pick === null || s.odds === null) continue;
      const key = `${s.fixtureId}:${s.pick}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const picks = byFixture.get(s.fixtureId) ?? {};
      picks[s.pick] = Number(s.odds);
      byFixture.set(s.fixtureId, picks);
    }
    return byFixture;
  }

  /** Latest full 1X2 snapshot per fixture in the window (most recent first). */
  private async latestOneXTwoOdds(
    to: Date,
    fixtureWhere: Prisma.FixtureWhereInput,
  ): Promise<Map<string, { home: number; draw: number; away: number }>> {
    const snapshots = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        market: Market.ONE_X_TWO,
        homeOdds: { not: null },
        drawOdds: { not: null },
        awayOdds: { not: null },
        snapshotAt: { lte: to },
        fixture: { is: fixtureWhere },
      },
      select: {
        fixtureId: true,
        homeOdds: true,
        drawOdds: true,
        awayOdds: true,
      },
      orderBy: [{ fixtureId: 'asc' }, { snapshotAt: 'desc' }],
    });
    const byFixture = new Map<
      string,
      { home: number; draw: number; away: number }
    >();
    for (const s of snapshots) {
      if (byFixture.has(s.fixtureId)) continue;
      if (s.homeOdds === null || s.drawOdds === null || s.awayOdds === null) {
        continue;
      }
      byFixture.set(s.fixtureId, {
        home: Number(s.homeOdds),
        draw: Number(s.drawOdds),
        away: Number(s.awayOdds),
      });
    }
    return byFixture;
  }

  /** Latest BTTS odds (one side) per fixture in the window. */
  private async latestBttsOdds(
    to: Date,
    fixtureWhere: Prisma.FixtureWhereInput,
    pick: 'YES' | 'NO',
  ): Promise<Map<string, number>> {
    const snapshots = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        market: Market.BTTS,
        pick,
        odds: { not: null },
        snapshotAt: { lte: to },
        fixture: { is: fixtureWhere },
      },
      select: { fixtureId: true, odds: true },
      orderBy: [{ fixtureId: 'asc' }, { snapshotAt: 'desc' }],
    });
    const byFixture = new Map<string, number>();
    for (const s of snapshots) {
      if (byFixture.has(s.fixtureId) || s.odds === null) continue;
      byFixture.set(s.fixtureId, Number(s.odds));
    }
    return byFixture;
  }

  /** Latest odds for a single (market, pick) per fixture in the window —
   * generic version of latestBttsOdds/latestOverUnderOdds for markets that
   * only ever need one side's price (CLEAN_SHEET_*, TO_WIN_EITHER_HALF). */
  private async latestSimpleOdds(opts: {
    to: Date;
    fixtureWhere: Prisma.FixtureWhereInput;
    market: Market;
    pick: string;
  }): Promise<Map<string, number>> {
    const { to, fixtureWhere, market, pick } = opts;
    const snapshots = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        market,
        pick,
        odds: { not: null },
        snapshotAt: { lte: to },
        fixture: { is: fixtureWhere },
      },
      select: { fixtureId: true, odds: true },
      orderBy: [{ fixtureId: 'asc' }, { snapshotAt: 'desc' }],
    });
    const byFixture = new Map<string, number>();
    for (const s of snapshots) {
      if (byFixture.has(s.fixtureId) || s.odds === null) continue;
      byFixture.set(s.fixtureId, Number(s.odds));
    }
    return byFixture;
  }
}

/** Reads the 1X2 + BTTS + Over/Under 2.5 + CLEAN_SHEET/WIN_EITHER_HALF
 * probabilities from a feature snapshot. */
function readSignalProbabilities(features: Prisma.JsonValue): {
  home: number;
  draw: number;
  away: number;
  bttsYes: number | null;
  bttsNo: number | null;
  over15: number | null;
  under15: number | null;
  over25: number | null;
  under25: number | null;
  over35: number | null;
  under35: number | null;
  over45: number | null;
  under45: number | null;
  cleanSheetHome: number | null;
  cleanSheetAway: number | null;
  winEitherHalfHome: number | null;
  winEitherHalfAway: number | null;
  teamTotalHome: Record<string, number> | null;
  teamTotalAway: Record<string, number> | null;
} | null {
  if (!features || typeof features !== 'object' || Array.isArray(features)) {
    return null;
  }
  const probs = (features as Record<string, unknown>)['probabilities'];
  if (!probs || typeof probs !== 'object') return null;
  const p = probs as Record<string, unknown>;
  const home = p['home'];
  const draw = p['draw'];
  const away = p['away'];
  const bttsYes = p['bttsYes'];
  const bttsNo = p['bttsNo'];
  const over15 = p['over15'];
  const under15 = p['under15'];
  const over25 = p['over25'];
  const under25 = p['under25'];
  const over35 = p['over35'];
  const under35 = p['under35'];
  const over45 = p['over45'];
  const under45 = p['under45'];
  const cleanSheetHome = p['cleanSheetHome'];
  const cleanSheetAway = p['cleanSheetAway'];
  const winEitherHalfHome = p['winEitherHalfHome'];
  const winEitherHalfAway = p['winEitherHalfAway'];
  const teamTotalHome = p['teamTotalHome'];
  const teamTotalAway = p['teamTotalAway'];
  if (
    typeof home !== 'number' ||
    typeof draw !== 'number' ||
    typeof away !== 'number'
  ) {
    return null;
  }
  // P(NO) is mutually exclusive/exhaustive with P(YES); fall back to 1 − YES
  // when an older snapshot only stored the YES side.
  const resolvedBttsNo =
    typeof bttsNo === 'number'
      ? bttsNo
      : typeof bttsYes === 'number'
        ? 1 - bttsYes
        : null;
  const asNumberRecord = (value: unknown): Record<string, number> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const entries = Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number',
    );
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  };
  return {
    home,
    draw,
    away,
    bttsYes: typeof bttsYes === 'number' ? bttsYes : null,
    bttsNo: resolvedBttsNo,
    over15: typeof over15 === 'number' ? over15 : null,
    under15: typeof under15 === 'number' ? under15 : null,
    over25: typeof over25 === 'number' ? over25 : null,
    under25: typeof under25 === 'number' ? under25 : null,
    over35: typeof over35 === 'number' ? over35 : null,
    under35: typeof under35 === 'number' ? under35 : null,
    over45: typeof over45 === 'number' ? over45 : null,
    under45: typeof under45 === 'number' ? under45 : null,
    cleanSheetHome: typeof cleanSheetHome === 'number' ? cleanSheetHome : null,
    cleanSheetAway: typeof cleanSheetAway === 'number' ? cleanSheetAway : null,
    winEitherHalfHome:
      typeof winEitherHalfHome === 'number' ? winEitherHalfHome : null,
    winEitherHalfAway:
      typeof winEitherHalfAway === 'number' ? winEitherHalfAway : null,
    teamTotalHome: asNumberRecord(teamTotalHome),
    teamTotalAway: asNumberRecord(teamTotalAway),
  };
}
