import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execFile } from 'node:child_process';
import type { ConfigService } from '@nestjs/config';
import { ApiFootballClient } from './api-football.client';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));

const execFileMock = vi.mocked(execFile);

type CurlOutcome = { stdout: string } | { error: Error & { code?: number } };

function mockCurl(outcome: CurlOutcome): void {
  execFileMock.mockImplementation(((
    _file: string,
    _args: string[],
    callback: (error: Error | null, stdout: string) => void,
  ) => {
    if ('error' in outcome) callback(outcome.error, '');
    else callback(null, outcome.stdout);
  }) as unknown as typeof execFile);
}

function curlStdout(body: string, status: number): string {
  return `${body}\n__EVCORE_HTTP_CODE__:${status}`;
}

function buildClient(): ApiFootballClient {
  const config = {
    getOrThrow: vi.fn().mockReturnValue('test-key'),
  } as unknown as ConfigService;
  return new ApiFootballClient(config);
}

describe('ApiFootballClient.fetchJson', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it('parses a JSON body and returns it with the HTTP status', async () => {
    mockCurl({ stdout: curlStdout('{"results":1}', 200) });

    const result = await buildClient().fetchJson('https://api/fixtures?id=1');

    expect(result.response).toEqual({ status: 200, body: { results: 1 } });
  });

  it('returns body null (status preserved) when the edge proxy answers with a plain-text 5xx', async () => {
    // Prod incident 2026-07-04: Envoy 503 body is not JSON — this used to
    // throw a SyntaxError that skipped the caller's HTTP-status handling.
    mockCurl({
      stdout: curlStdout(
        'upstream connect error or disconnect/reset before headers',
        503,
      ),
    });

    const result = await buildClient().fetchJson('https://api/fixtures?id=1');

    expect(result.response).toEqual({ status: 503, body: null });
  });

  it('maps transient curl failures to response null with a network code', async () => {
    const timeout = Object.assign(new Error('curl: (28) timed out'), {
      code: 28,
    });
    mockCurl({ error: timeout });

    const result = await buildClient().fetchJson('https://api/fixtures?id=1');

    expect(result.response).toBeNull();
    expect(result.transientErrorCode).toBe('ETIMEDOUT');
  });
});
