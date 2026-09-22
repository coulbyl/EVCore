import { Injectable } from '@nestjs/common';
import { FixtureStatisticsRepository } from './fixture-statistics.repository';
import { normalizeTeamStatistics } from './fixture-statistics.mapper';
import type { PersistFixtureStatisticsInput } from './fixture-statistics.types';

@Injectable()
export class FixtureStatisticsService {
  constructor(private readonly repository: FixtureStatisticsRepository) {}

  async persistFinalStatistics(
    input: PersistFixtureStatisticsInput,
  ): Promise<number> {
    const identity = await this.repository.findFixtureTeamIdentity(
      input.fixtureExternalId,
    );
    if (!identity) {
      throw new Error(`Fixture not found: ${input.fixtureExternalId}`);
    }

    const statistics = input.teams.flatMap((team) => {
      const teamId = identity.teams.get(team.externalTeamId);
      if (!teamId) {
        throw new Error(
          `Unexpected team ${team.externalTeamId} for fixture ${input.fixtureExternalId}`,
        );
      }
      return normalizeTeamStatistics({ teamId, statistics: team.statistics });
    });

    await this.repository.replaceFixtureStatistics({
      fixtureId: identity.fixtureId,
      observedAt: input.observedAt,
      statistics,
    });
    return statistics.length;
  }

  markUnavailable(fixtureExternalId: number): Promise<void> {
    return this.repository.markUnavailable(fixtureExternalId);
  }
}
