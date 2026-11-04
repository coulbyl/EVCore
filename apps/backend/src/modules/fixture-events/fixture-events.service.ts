import { Injectable } from '@nestjs/common';
import { FIXTURE_EVENTS } from '@config/etl.constants';
import { createLogger } from '@utils/logger';
import {
  FixtureByIdDetailsSchema,
  droppedCount,
  type FixtureByIdDetails,
} from '../etl/schemas/fixture-full.schema';
import { FixtureEventRepository } from './fixture-event.repository';
import { FixtureLineupRepository } from './fixture-lineup.repository';
import { FixturePlayerStatisticRepository } from './fixture-player-statistic.repository';
import { PlayerRepository } from './player.repository';
import { toFixtureDetailRows, UnknownTeamError } from './fixture-events.mapper';
import type { FixtureDetailWriteResult } from './fixture-events.types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const logger = createLogger('fixture-events');

/**
 * The one writer of a match's events, lineups and player statistics. Every
 * /fixtures?ids= answer goes through `writeEntry` — the settlement pass at
 * the whistle, the stats sync and its backfill after — under one rule of
 * « synced » (`isSynced`).
 */
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
   * Validates and writes one raw /fixtures?ids= entry. Never throws: a
   * rejection says its cause, and leaves the match pending for the next
   * answer.
   */
  async writeEntry(input: {
    fixtureExternalId: number;
    observedAt: Date;
    entry: unknown;
  }): Promise<FixtureDetailWriteResult> {
    const { fixtureExternalId: externalId } = input;
    const parsed = FixtureByIdDetailsSchema.safeParse(input.entry);
    if (!parsed.success) {
      logger.warn(
        { externalId, issues: parsed.error.issues },
        'Events, lineups or players block missing — left pending',
      );
      return {
        status: 'rejected',
        cause: 'missing-block',
        reason: parsed.error.issues
          .map((issue) => issue.path.join('.'))
          .join(', '),
        match: null,
      };
    }
    if (droppedCount(parsed.data) > 0) {
      logger.warn(
        { externalId, dropped: parsed.data.dropped },
        'Invalid events/lineups/players left out — the rest is written',
      );
    }
    try {
      const written = await this.persistDetails({
        fixtureExternalId: externalId,
        observedAt: input.observedAt,
        details: parsed.data,
      });
      if (written.status === 'rejected') {
        logger.warn(
          { externalId, cause: written.cause, reason: written.reason },
          'Events/lineups/players rejected — left pending',
        );
      }
      return written;
    } catch (error) {
      logger.error(
        { externalId, err: error },
        'Writing events/lineups/players failed — left pending',
      );
      return {
        status: 'rejected',
        cause: 'write-failed',
        reason: error instanceof Error ? error.message : String(error),
        match: null,
      };
    }
  }

  /**
   * Writes one match's validated events, lineups and player statistics,
   * replacing what was there: a re-sync writes the same rows. An empty
   * block never erases rows already written.
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
      return {
        status: 'rejected',
        cause: 'unknown-fixture',
        reason: `Fixture not found: ${input.fixtureExternalId}`,
        match: null,
      };
    }

    let rows: ReturnType<typeof toFixtureDetailRows>;
    try {
      rows = toFixtureDetailRows({
        details: input.details,
        teams: identity.teams,
      });
    } catch (error) {
      if (error instanceof UnknownTeamError) {
        return {
          status: 'rejected',
          cause: 'unknown-team',
          reason: error.message,
          match: identity.label,
        };
      }
      throw error;
    }

    const observedAt = input.observedAt;
    const synced = isSynced({
      complete: rows.complete,
      kickoff: identity.scheduledAt,
      observedAt,
    });
    // A block the API sent empty never erases one already written: the
    // answer may come before the API has it (lineups, player statistics).
    try {
      await this.players.upsertMany(rows.players);
      await this.events.transaction(async (tx) => {
        const write = { tx, fixtureId: identity.fixtureId, observedAt };
        if (rows.events.length > 0) {
          await this.events.replaceForFixture({ ...write, rows: rows.events });
        }
        if (rows.lineups.length > 0) {
          await this.lineups.replaceForFixture({
            ...write,
            rows: rows.lineups,
          });
        }
        if (rows.playerStatistics.length > 0) {
          await this.playerStatistics.replaceForFixture({
            ...write,
            rows: rows.playerStatistics,
          });
        }
        if (synced) await this.events.markSynced(write);
      });
    } catch (error) {
      return {
        status: 'rejected',
        cause: 'write-failed',
        reason: error instanceof Error ? error.message : String(error),
        match: identity.label,
      };
    }

    return {
      status: 'written',
      events: rows.events.length,
      lineups: rows.lineups.length,
      playerStatistics: rows.playerStatistics.length,
      synced,
      dropped: input.details.dropped,
    };
  }
}

/**
 * The one rule of « synced » (fixture.eventsSyncedAt, nothing left to
 * fetch): the API returned all three blocks at least FINAL_AFTER_HOURS
 * after kick-off — the whistle's answer is written but corrected after —,
 * or the match is old enough that what came is all there is
 * (INCOMPLETE_GRACE_DAYS).
 */
export function isSynced(input: {
  complete: boolean;
  kickoff: Date;
  observedAt: Date;
}): boolean {
  const age = input.observedAt.getTime() - input.kickoff.getTime();
  return (
    (input.complete && age >= FIXTURE_EVENTS.FINAL_AFTER_HOURS * HOUR_MS) ||
    age >= FIXTURE_EVENTS.INCOMPLETE_GRACE_DAYS * DAY_MS
  );
}
