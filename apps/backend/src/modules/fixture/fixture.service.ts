import { Injectable } from '@nestjs/common';
import { Fixture, FixtureStatus } from '@evcore/db';
import {
  FixtureRepository,
  type UpsertFixtureResult,
  type UpsertOddsSnapshotInput,
  type UpsertSecondaryMarketOddsInput,
} from './fixture.repository';

type UpsertCompetitionInput = {
  leagueId: number;
  code: string;
  name: string;
  country: string;
  isActive: boolean;
  csvDivisionCode?: string;
  seasonStartMonth?: number;
};
type UpsertSeasonInput = {
  competitionId: string;
  name: string;
  startDate: Date;
  endDate: Date;
};

// API-agnostic fixture input — mapping from raw API response is done in the worker
export type FixtureInput = {
  externalId: number;
  homeTeam: {
    externalId: number;
    name: string;
    shortName: string;
    logoUrl: string;
  };
  awayTeam: {
    externalId: number;
    name: string;
    shortName: string;
    logoUrl: string;
  };
  matchday: number;
  scheduledAt: Date;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeHtScore: number | null;
  awayHtScore: number | null;
};

type UpsertFixtureChainInput = {
  competitionId: string;
  seasonId: string;
  fixture: FixtureInput;
};

type UpsertOneXTwoOddsSnapshotInput = {
  fixtureId: string;
  bookmaker: string;
  snapshotAt: Date;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
};

type HasOneXTwoOddsSnapshotInput = {
  fixtureId: string;
  bookmaker: string;
  snapshotAt: Date;
};

type FindByDateAndTeamsInput = {
  date: Date;
  homeTeamName: string;
  awayTeamName: string;
  competitionCode?: string;
};

type UpdateScoresInput = {
  externalId: number;
  homeScore: number;
  awayScore: number;
  homeHtScore: number | null;
  awayHtScore: number | null;
};

type SyncFixtureStateInput = {
  externalId: number;
  scheduledAt: Date;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeHtScore: number | null;
  awayHtScore: number | null;
};

@Injectable()
export class FixtureService {
  constructor(private readonly fixtureRepository: FixtureRepository) {}

  async upsertFixtureChain(
    input: UpsertFixtureChainInput,
  ): Promise<UpsertFixtureResult> {
    const { competitionId, seasonId, fixture } = input;

    const [homeTeam, awayTeam] = await Promise.all([
      this.fixtureRepository.upsertTeam({
        externalId: fixture.homeTeam.externalId,
        name: fixture.homeTeam.name,
        shortName: fixture.homeTeam.shortName,
        logoUrl: fixture.homeTeam.logoUrl,
        competitionId,
      }),
      this.fixtureRepository.upsertTeam({
        externalId: fixture.awayTeam.externalId,
        name: fixture.awayTeam.name,
        shortName: fixture.awayTeam.shortName,
        logoUrl: fixture.awayTeam.logoUrl,
        competitionId,
      }),
    ]);

    return this.fixtureRepository.upsertFixture({
      externalId: fixture.externalId,
      seasonId,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      matchday: fixture.matchday,
      scheduledAt: fixture.scheduledAt,
      status: fixture.status,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      homeHtScore: fixture.homeHtScore,
      awayHtScore: fixture.awayHtScore,
    });
  }

  async upsertCompetition(
    data: UpsertCompetitionInput,
  ): Promise<{ id: string }> {
    return this.fixtureRepository.upsertCompetition(data);
  }

  async upsertSeason(data: UpsertSeasonInput): Promise<{ id: string }> {
    return this.fixtureRepository.upsertSeason(data);
  }

  findByDateAndTeams(input: FindByDateAndTeamsInput) {
    return this.fixtureRepository.findByDateAndTeams(input);
  }

  async updateScores(input: UpdateScoresInput): Promise<void> {
    return this.fixtureRepository.updateScores(input);
  }

  async syncFixtureState(input: SyncFixtureStateInput): Promise<void> {
    return this.fixtureRepository.syncFixtureState(input);
  }

  async updateXg(
    externalId: number,
    homeXg: number,
    awayXg: number,
  ): Promise<void> {
    return this.fixtureRepository.updateXg(externalId, homeXg, awayXg);
  }

  async findByExternalId(externalId: number): Promise<Fixture | null> {
    return this.fixtureRepository.findByExternalId(externalId);
  }

  async findFinishedBySeason(seasonId: string): Promise<Fixture[]> {
    return this.fixtureRepository.findFinishedBySeason(seasonId);
  }

  findScheduledForDate(
    date: Date,
  ): Promise<{ id: string; externalId: number; scheduledAt: Date }[]> {
    return this.fixtureRepository.findScheduledForDate(date);
  }

  findScheduledInRange(
    startDate: Date,
    endDate: Date,
  ): Promise<{ id: string; externalId: number; scheduledAt: Date }[]> {
    return this.fixtureRepository.findScheduledInRange(startDate, endDate);
  }

  findFinishedWithoutXg(seasonId: string): Promise<{ externalId: number }[]> {
    return this.fixtureRepository.findFinishedWithoutXg(seasonId);
  }

  findScheduledBySeason(seasonId: string): Promise<
    {
      id: string;
      externalId: number;
      scheduledAt: Date;
      homeTeam: { externalId: number };
      awayTeam: { externalId: number };
    }[]
  > {
    return this.fixtureRepository.findScheduledBySeason(seasonId);
  }

  async markXgUnavailable(externalId: number): Promise<void> {
    return this.fixtureRepository.markXgUnavailable(externalId);
  }

  async deleteOddsSnapshotsOlderThan(cutoff: Date): Promise<number> {
    return this.fixtureRepository.deleteOddsSnapshotsOlderThan(cutoff);
  }

  findPendingSettlementFixtures(now: Date): Promise<
    {
      id: string;
      externalId: number;
      scheduledAt: Date;
      season: {
        competition: {
          leagueId: number;
          code: string;
        };
      };
    }[]
  > {
    return this.fixtureRepository.findPendingSettlementFixtures(now);
  }

  async upsertOddsSnapshot(
    data: UpsertOddsSnapshotInput,
  ): Promise<{ id: string }> {
    return this.fixtureRepository.upsertOddsSnapshot(data);
  }

  async upsertSecondaryMarketOdds(
    data: UpsertSecondaryMarketOddsInput,
  ): Promise<void> {
    return this.fixtureRepository.upsertSecondaryMarketOdds(data);
  }

  // Alias kept for backward compatibility with existing tests.
  async upsertOneXTwoOddsSnapshot(
    data: UpsertOneXTwoOddsSnapshotInput,
  ): Promise<{ id: string }> {
    return this.fixtureRepository.upsertOneXTwoOddsSnapshot(data);
  }

  async hasOneXTwoOddsSnapshot(
    input: HasOneXTwoOddsSnapshotInput,
  ): Promise<boolean> {
    return this.fixtureRepository.hasOneXTwoOddsSnapshot(input);
  }
}
