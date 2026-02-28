import { Injectable } from '@nestjs/common';
import { Fixture, FixtureStatus } from '@evcore/db';
import { FixtureRepository } from './fixture.repository';

type UpsertCompetitionInput = { name: string; code: string; country: string };
type UpsertSeasonInput = {
  competitionId: string;
  name: string;
  startDate: Date;
  endDate: Date;
};

// API-agnostic fixture input — mapping from raw API response is done in the worker
export type FixtureInput = {
  externalId: number;
  homeTeam: { externalId: number; name: string; shortName: string };
  awayTeam: { externalId: number; name: string; shortName: string };
  matchday: number;
  scheduledAt: Date;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
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

@Injectable()
export class FixtureService {
  constructor(private readonly fixtureRepository: FixtureRepository) {}

  async upsertFixtureChain(
    input: UpsertFixtureChainInput,
  ): Promise<{ id: string }> {
    const { competitionId, seasonId, fixture } = input;

    const [homeTeam, awayTeam] = await Promise.all([
      this.fixtureRepository.upsertTeam({
        externalId: fixture.homeTeam.externalId,
        name: fixture.homeTeam.name,
        shortName: fixture.homeTeam.shortName,
        competitionId,
      }),
      this.fixtureRepository.upsertTeam({
        externalId: fixture.awayTeam.externalId,
        name: fixture.awayTeam.name,
        shortName: fixture.awayTeam.shortName,
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

  findByDateAndTeams(date: Date, homeTeamName: string, awayTeamName: string) {
    return this.fixtureRepository.findByDateAndTeams(
      date,
      homeTeamName,
      awayTeamName,
    );
  }

  async updateScores(
    externalId: number,
    homeScore: number,
    awayScore: number,
  ): Promise<void> {
    return this.fixtureRepository.updateScores(
      externalId,
      homeScore,
      awayScore,
    );
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

  findFinishedWithoutXg(seasonId: string): Promise<{ externalId: number }[]> {
    return this.fixtureRepository.findFinishedWithoutXg(seasonId);
  }

  async upsertOneXTwoOddsSnapshot(
    data: UpsertOneXTwoOddsSnapshotInput,
  ): Promise<{ id: string }> {
    return this.fixtureRepository.upsertOneXTwoOddsSnapshot(data);
  }
}
