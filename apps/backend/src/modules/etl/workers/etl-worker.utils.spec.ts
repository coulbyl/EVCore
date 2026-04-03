import { describe, expect, it, vi } from 'vitest';
import {
  fetchOrSkip,
  fetchOrSkipWithMeta,
  getTransientNetworkErrorCode,
  isTransientNetworkError,
} from './etl-worker.utils';

describe('etl-worker utils', () => {
  it('extracts transient network error codes', () => {
    const err = Object.assign(new Error('timeout'), {
      cause: { code: 'ETIMEDOUT' },
    });

    expect(getTransientNetworkErrorCode(err)).toBe('ETIMEDOUT');
    expect(isTransientNetworkError(err)).toBe(true);
  });

  it('returns response metadata for transient fetch failures', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('reset'), { cause: { code: 'ECONNRESET' } }),
      );

    await expect(fetchOrSkip('https://example.com', {})).resolves.toBeNull();
    await expect(
      fetchOrSkipWithMeta('https://example.com', {}),
    ).resolves.toEqual({
      response: null,
      transientErrorCode: 'ECONNRESET',
    });
  });
});
