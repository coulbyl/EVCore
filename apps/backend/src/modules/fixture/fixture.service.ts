import { Injectable } from '@nestjs/common';
import { Fixture, FixtureStatus } from '@evcore/db';
import { FixtureRepository } from './fixture.repository';
import type { FootballDataFixture } from '../etl/schemas/fixture.schema';
import { parseIsoDate } from '@utils/date.utils';

type UpsertCompetitionInput = { name: string; code: string; country: string };
type UpsertSeasonInput = {
  competitionId: string;
  name: string;
  startDate: Date;
  endDate: Date;
};

type UpsertFixtureChainInput = {
  competitionId: string;
  seasonId: string;
  fixture: FootballDataFixture;
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

    // Upsert home and away teams
    const [homeTeam, awayTeam] = await Promise.all([
      this.fixtureRepository.upsertTeam({
        externalId: fixture.homeTeam.id,
        name: fixture.homeTeam.name,
        shortName: fixture.homeTeam.shortName,
        competitionId,
      }),
      this.fixtureRepository.upsertTeam({
        externalId: fixture.awayTeam.id,
        name: fixture.awayTeam.name,
        shortName: fixture.awayTeam.shortName,
        competitionId,
      }),
    ]);

    const dbStatus = this.mapStatus(fixture.status);

    return this.fixtureRepository.upsertFixture({
      externalId: fixture.id,
      seasonId,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      matchday: fixture.matchday,
      scheduledAt: parseIsoDate(fixture.utcDate),
      status: dbStatus,
      homeScore: fixture.score.fullTime.home,
      awayScore: fixture.score.fullTime.away,
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

  async upsertOneXTwoOddsSnapshot(
    data: UpsertOneXTwoOddsSnapshotInput,
  ): Promise<{ id: string }> {
    return this.fixtureRepository.upsertOneXTwoOddsSnapshot(data);
  }

  private mapStatus(apiStatus: FootballDataFixture['status']): FixtureStatus {
    switch (apiStatus) {
      case 'FINISHED':
      case 'AWARDED':
        return 'FINISHED';
      case 'POSTPONED':
        return 'POSTPONED';
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return 'SCHEDULED';
    }
  }
}
