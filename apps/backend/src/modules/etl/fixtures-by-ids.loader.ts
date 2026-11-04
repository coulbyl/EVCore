import { ETL_CONSTANTS } from '@config/etl.constants';
import { sleep } from '@utils/async.utils';
import type { createLogger } from '@utils/logger';
import {
  type ApiFootballClient,
  isQuotaExceededError,
} from './api-football.client';
import {
  ApiFootballFixturesByIdsResponseSchema,
  FixtureByIdIdentitySchema,
} from './schemas/fixture-full.schema';

/** Why an asked fixture came back without its answer. */
export type FixturesByIdsMiss =
  // Network error, no answer at all: transient.
  | 'network'
  // An HTTP error other than the quota's.
  | 'http'
  // The envelope failed its schema: the whole call is rejected.
  | 'envelope'
  // The answer did not hold this fixture.
  | 'absent';

export type FixturesByIdsLoad = {
  /** Each answered fixture's raw entry, by its API-Football id. */
  entries: Map<number, unknown>;
  /** The fixtures asked and not answered, with the reason. */
  missed: Map<number, FixturesByIdsMiss>;
  /** Left unasked (the refused call's included) once the quota is reached. */
  notAsked: number[];
  /** /fixtures?ids= calls spent. */
  calls: number;
  /** Calls whose answer failed the envelope schema. */
  rejectedCalls: number;
  quotaReached: boolean;
};

/**
 * The /fixtures?ids= answers of these fixtures, FIXTURES_BY_IDS_BATCH_SIZE
 * per call with STATS_RATE_LIMIT_MS between calls. Stops at the first quota
 * or rate-limit signal: API-Football answers an exhausted daily quota with
 * a 200 whose `errors` is an object and whose `response` is empty. Each
 * entry is kept raw once its identity reads: its callers validate the
 * blocks they need, so one malformed entry never costs the others theirs.
 */
export async function loadFixturesByIds(input: {
  apiFootball: ApiFootballClient;
  externalIds: readonly number[];
  logger: ReturnType<typeof createLogger>;
}): Promise<FixturesByIdsLoad> {
  const { apiFootball, externalIds, logger } = input;
  const load: FixturesByIdsLoad = {
    entries: new Map(),
    missed: new Map(),
    notAsked: [],
    calls: 0,
    rejectedCalls: 0,
    quotaReached: false,
  };
  const miss = (ids: readonly number[], reason: FixturesByIdsMiss) => {
    for (const id of ids) load.missed.set(id, reason);
  };

  const batchSize = ETL_CONSTANTS.FIXTURES_BY_IDS_BATCH_SIZE;
  for (let start = 0; start < externalIds.length; start += batchSize) {
    const ids = externalIds.slice(start, start + batchSize);
    if (start > 0) await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);

    const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/fixtures?ids=${ids.join('-')}`;
    const curlResult = await apiFootball.fetchJson(url);
    load.calls++;

    if (curlResult.response === null) {
      logger.warn(
        { ids },
        'Transient network error on /fixtures?ids= — skipping batch',
      );
      miss(ids, 'network');
      continue;
    }
    const res = curlResult.response;

    if (res.status === 429 || isQuotaExceededError(res.body)) {
      logger.warn(
        { ids, status: res.status, body: res.body },
        'API-FOOTBALL quota or rate limit reached — /fixtures?ids= stopped',
      );
      load.quotaReached = true;
      load.notAsked = externalIds.slice(start);
      break;
    }

    if (res.status < 200 || res.status >= 300) {
      logger.warn(
        { ids, status: res.status },
        'API-FOOTBALL error on /fixtures?ids= — skipping batch',
      );
      miss(ids, 'http');
      continue;
    }

    // The envelope is the whole call: rejected, every fixture stays pending.
    const envelope = ApiFootballFixturesByIdsResponseSchema.safeParse(res.body);
    if (!envelope.success) {
      logger.warn(
        { ids, issues: envelope.error.issues },
        'Zod validation failed on /fixtures?ids= — skipping batch',
      );
      miss(ids, 'envelope');
      load.rejectedCalls++;
      continue;
    }

    for (const entry of envelope.data.response) {
      const identity = FixtureByIdIdentitySchema.safeParse(entry);
      if (identity.success) load.entries.set(identity.data.fixture.id, entry);
    }
    for (const id of ids) {
      if (load.entries.has(id)) continue;
      logger.warn(
        { externalId: id },
        'Fixture missing from /fixtures?ids= answer',
      );
      load.missed.set(id, 'absent');
    }
  }
  return load;
}
