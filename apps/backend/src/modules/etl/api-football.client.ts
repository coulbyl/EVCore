import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { ETL_CONSTANTS } from '@config/etl.constants';
import { createLogger } from '@utils/logger';

// Shared API-Football HTTP client. Every ETL worker used to carry its own
// copy of this curl plumbing (marker parsing, transient-error mapping, quota
// detection) — this client is the single implementation. Workers stay pure
// orchestrators: fetch → Zod → repository.
//
// curl (not fetch/undici) is deliberate: it inherits the historical behavior
// of the workers, including proxy/DNS resolution semantics in the deploy
// environment. Do not swap the transport without re-validating in prod.

export type ApiFootballResponse = {
  status: number;
  body: unknown;
};

export type ApiFootballFetchResult = {
  response: ApiFootballResponse | null;
  transientErrorCode?: string;
};

export type ApiFootballQuotaUsage = {
  current: number;
  limitDay: number;
};

const CURL_HTTP_CODE_MARKER = '__EVCORE_HTTP_CODE__';

const logger = createLogger('api-football-client');

@Injectable()
export class ApiFootballClient {
  constructor(private readonly config: ConfigService) {}

  // Fetches a JSON endpoint. `attempts` ≥ 1: transient network errors
  // (timeout/DNS/reset) are retried immediately; HTTP errors are returned
  // as-is for the caller to handle (each worker has its own skip/abort
  // policy and logging context).
  async fetchJson(url: string, attempts = 1): Promise<ApiFootballFetchResult> {
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');
    let last: ApiFootballFetchResult = { response: null };

    for (let attempt = 1; attempt <= attempts; attempt++) {
      last = await fetchJsonViaCurl(url, apiKey);
      if (last.response !== null) return last;

      if (attempt < attempts) {
        logger.warn(
          {
            url,
            networkCode: last.transientErrorCode ?? 'UNKNOWN',
            attempt,
            nextAttempt: attempt + 1,
          },
          'Transient network error — retrying immediately',
        );
      }
    }

    return last;
  }

  // Reads the daily request counter from /status. Returns null on any
  // failure — quota tracking is best-effort observability, never a reason
  // to fail a sync job.
  async getQuotaUsage(): Promise<ApiFootballQuotaUsage | null> {
    const result = await this.fetchJson(
      `${ETL_CONSTANTS.API_FOOTBALL_BASE}/status`,
    );
    const res = result.response;
    if (res === null || res.status < 200 || res.status >= 300) return null;

    const body = res.body as {
      response?: { requests?: { current?: unknown; limit_day?: unknown } };
    } | null;
    const requests = body?.response?.requests;
    if (
      !requests ||
      typeof requests.current !== 'number' ||
      typeof requests.limit_day !== 'number'
    ) {
      return null;
    }
    return { current: requests.current, limitDay: requests.limit_day };
  }
}

// API-Football signals quota exhaustion with a 200 response whose `errors`
// field is a non-array object (e.g. { requests: "You have reached..." }).
export function isQuotaExceededError(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'errors' in body &&
    typeof (body as Record<string, unknown>)['errors'] === 'object' &&
    !Array.isArray((body as Record<string, unknown>)['errors']) &&
    (body as Record<string, unknown>)['errors'] !== null
  );
}

async function fetchJsonViaCurl(
  url: string,
  apiKey: string,
): Promise<ApiFootballFetchResult> {
  try {
    const stdout = await runCurlJsonRequest(url, apiKey);
    const lastMarker = stdout.lastIndexOf(`\n${CURL_HTTP_CODE_MARKER}:`);
    if (lastMarker === -1) {
      throw new Error('curl output missing HTTP code marker');
    }

    const bodyText = stdout.slice(0, lastMarker);
    const statusText = stdout
      .slice(lastMarker + `\n${CURL_HTTP_CODE_MARKER}:`.length)
      .trim();
    const status = Number.parseInt(statusText, 10);

    if (Number.isNaN(status)) {
      throw new Error(`curl returned invalid HTTP code: ${statusText}`);
    }

    return { response: { status, body: parseBody(bodyText, status) } };
  } catch (error) {
    const transientErrorCode = getCurlTransientErrorCode(error);
    if (transientErrorCode !== undefined) {
      return { response: null, transientErrorCode };
    }
    throw error;
  }
}

// The API's edge proxy answers some 5xx with a PLAIN-TEXT body ("upstream
// connect error or disconnect/reset before headers…"). Parsing that as JSON
// used to throw a SyntaxError that bypassed the caller's HTTP-status handling
// entirely (seen in prod on the settlement worker, 2026-07-04). A non-JSON
// body is never fatal here: keep the status, null the body, and let each
// caller apply its own non-ok / Zod-failure policy.
function parseBody(bodyText: string, status: number): unknown {
  if (bodyText.trim().length === 0) return null;
  try {
    return JSON.parse(bodyText);
  } catch {
    logger.warn(
      { status, bodySnippet: bodyText.slice(0, 120) },
      'API-FOOTBALL returned a non-JSON body — treating body as empty',
    );
    return null;
  }
}

function runCurlJsonRequest(url: string, apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      [
        '--silent',
        '--show-error',
        '--location',
        '--write-out',
        `\n${CURL_HTTP_CODE_MARKER}:%{http_code}`,
        '-H',
        `x-apisports-key: ${apiKey}`,
        url,
      ],
      (error, stdout) => {
        if (error) {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function getCurlTransientErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;

  const message = error.message.toLowerCase();
  if (message.includes('timed out')) return 'ETIMEDOUT';
  if (message.includes('could not resolve host')) return 'ENOTFOUND';
  if (message.includes('connection reset')) return 'ECONNRESET';

  const exitCode = 'code' in error ? (error.code as number | undefined) : null;
  if (exitCode === 28) return 'ETIMEDOUT';
  if (exitCode === 6) return 'ENOTFOUND';
  if (exitCode === 56) return 'ECONNRESET';

  return undefined;
}
