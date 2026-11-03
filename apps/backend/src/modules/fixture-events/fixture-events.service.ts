import { Injectable } from '@nestjs/common';
import { FIXTURE_EVENTS } from '@config/etl.constants';
import type { FixtureByIdDetails } from '../etl/schemas/fixture-full.schema';
import { FixtureEventRepository } from './fixture-event.repository';
import { FixtureLineupRepository } from './fixture-lineup.repository';
import { FixturePlayerStatisticRepository } from './fixture-player-statistic.repository';
import { PlayerRepository } from './player.repository';
import { toFixtureDetailRows, UnknownTeamError } from './fixture-events.mapper';
import type { FixtureDetailWriteResult } from './fixture-events.types';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FixtureEventsService {
  // eslint-disable-next-line max-params -- one repository per table written.
  constructor(
    private readonly events: FixtureEventRepository,
    private readonly lineups: FixtureLineupRepository,
    private readonly playerStatistics: FixturePlayerStatisticRepository,
    private readonly players: PlayerRepository,
  ) {}

  /**
   * Writes one match's events, lineups and player statistics from a
   * validated /fixtures?ids= entry, replacing what was there: a re-sync
   * writes the same rows. The match is marked synced once the API returned
   * all three, or once it is old enough that what came is all there is
   * (FIXTURE_EVENTS.INCOMPLETE_GRACE_DAYS); until then the backfill takes
   * it again. An answer with none of the three never erases rows already
   * written.
   */
  async persistDetails(input: {
    fixtureExternalId: number;
    observedAt: Date;
    details: FixtureByIdDetails;
  }): Promise<FixtureDetailWriteResult> {
    const identity = await this.events.findFixtureIdentity(
      input.fixtureExternalId,
    );
    if (!identity) {
      throw new Error(`Fixture not found: ${input.fixtureExternalId}`);
    }

    let rows: ReturnType<typeof toFixtureDetailRows>;
    try {
      rows = toFixtureDetailRows({
        details: input.details,
        teams: identity.teams,
      });
    } catch (error) {
      if (error instanceof UnknownTeamError) {
        return { status: 'rejected', reason: error.message };
      }
      throw error;
    }

    const observedAt = input.observedAt;
    const synced =
      rows.complete ||
      observedAt.getTime() - identity.scheduledAt.getTime() >=
        FIXTURE_EVENTS.INCOMPLETE_GRACE_DAYS * DAY_MS;
    const empty =
      rows.events.length === 0 &&
      rows.lineups.length === 0 &&
      rows.playerStatistics.length === 0;

    await this.players.upsertMany(rows.players);
    await this.events.transaction(async (tx) => {
      if (!empty) {
        const write = { tx, fixtureId: identity.fixtureId, observedAt };
        await this.events.replaceForFixture({ ...write, rows: rows.events });
        await this.lineups.replaceForFixture({ ...write, rows: rows.lineups });
        await this.playerStatistics.replaceForFixture({
          ...write,
          rows: rows.playerStatistics,
        });
      }
      if (synced) {
        await this.events.markSynced({
          tx,
          fixtureId: identity.fixtureId,
          observedAt,
        });
      }
    });

    return {
      status: 'written',
      events: rows.events.length,
      lineups: rows.lineups.length,
      playerStatistics: rows.playerStatistics.length,
      synced,
    };
  }
}
