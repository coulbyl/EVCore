import { Injectable } from '@nestjs/common';
import { addDays } from 'date-fns';
import { createLogger } from '@utils/logger';
import { sleep } from '@utils/async.utils';
import { ETL_CONSTANTS, PLAYER_SQUADS } from '@config/etl.constants';
import { PlayerSquadRepository } from '@modules/fixture-events/player-squad.repository';
import { ApiFootballClient, isQuotaExceededError } from './api-football.client';
import {
  ApiFootballSquadsResponseSchema,
  squadPlayersOf,
} from './schemas/squads.schema';

const logger = createLogger('squads-sync');

export type SquadsLotResult = {
  status: 'lot-done' | 'lot-aborted' | 'nothing-left';
  teams: number;
  written: number;
  players: number;
  calls: number;
};

/**
 * The squads lot of a stats backfill tick (plan des stratégies, phase 3):
 * the teams playing in the next ten days whose squad is missing or a week
 * old, one call each. A quota answer stops the lot; a team that fails
 * (network, status, Zod) is left for the next tick, three times at most
 * until the process restarts.
 */
@Injectable()
export class SquadsSyncService {
  private readonly failedAttempts = new Map<number, number>();

  constructor(
    private readonly apiFootball: ApiFootballClient,
    private readonly squads: PlayerSquadRepository,
  ) {}

  async syncDue(budget: number, now = new Date()): Promise<SquadsLotResult> {
    const excluded = [...this.failedAttempts.entries()]
      .filter(([, attempts]) => attempts >= PLAYER_SQUADS.MAX_ATTEMPTS)
      .map(([externalId]) => externalId);
    const teams = await this.squads.findTeamsDue({
      from: now,
      to: addDays(now, PLAYER_SQUADS.HORIZON_DAYS),
      staleBefore: addDays(now, -PLAYER_SQUADS.REFRESH_DAYS),
      limit: Math.min(PLAYER_SQUADS.MAX_TEAMS_PER_LOT, budget),
      excludeExternalIds: excluded,
    });
    const result: SquadsLotResult = {
      status: teams.length === 0 ? 'nothing-left' : 'lot-done',
      teams: teams.length,
      written: 0,
      players: 0,
      calls: 0,
    };

    for (const [index, team] of teams.entries()) {
      if (index > 0) await sleep(PLAYER_SQUADS.RATE_LIMIT_MS);
      const outcome = await this.syncTeam(team);
      result.calls++;
      if (outcome === 'quota') {
        result.status = 'lot-aborted';
        break;
      }
      if (outcome === null) {
        this.failedAttempts.set(
          team.externalId,
          (this.failedAttempts.get(team.externalId) ?? 0) + 1,
        );
        continue;
      }
      result.written++;
      result.players += outcome;
    }

    if (result.teams > 0) logger.info(result, 'Squads lot complete');
    return result;
  }

  /** Players written, null on a failure to retry, 'quota' to stop. */
  private async syncTeam(team: {
    teamId: string;
    externalId: number;
  }): Promise<number | null | 'quota'> {
    const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/players/squads?team=${team.externalId}`;
    const fetched = await this.apiFootball.fetchJson(url);
    const res = fetched.response;
    if (res === null) {
      logger.warn({ externalId: team.externalId }, 'Squad call failed');
      return null;
    }
    if (res.status === 429 || isQuotaExceededError(res.body)) {
      logger.warn(
        { externalId: team.externalId, status: res.status },
        'API-Football quota or rate limit reached — squads lot stopped',
      );
      return 'quota';
    }
    if (res.status < 200 || res.status >= 300) {
      logger.warn(
        { externalId: team.externalId, status: res.status },
        'Squad call answered an error',
      );
      return null;
    }
    const parsed = ApiFootballSquadsResponseSchema.safeParse(res.body);
    if (!parsed.success) {
      logger.warn(
        { externalId: team.externalId, issues: parsed.error.issues },
        'Zod validation failed on /players/squads — nothing written',
      );
      return null;
    }
    const players = squadPlayersOf(parsed.data, team.externalId);
    await this.squads.replaceSquad({
      teamId: team.teamId,
      players,
      observedAt: new Date(),
    });
    return players.length;
  }
}
