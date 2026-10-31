import { describe, expect, it, vi } from 'vitest';
import { SharedReads } from './shared-reads';

const T0 = 1_800_000_000_000;
const TTL = 60_000;
const KEEP = 600_000;
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('SharedReads', () => {
  it('shares one read between the requests that arrive together', async () => {
    const reads = new SharedReads<number>({
      ttlMs: TTL,
      keepMs: KEEP,
      maxKeys: 100,
    });
    const read = vi.fn().mockResolvedValue(1);
    const [a, b] = await Promise.all([
      reads.get('k', read, T0),
      reads.get('k', read, T0 + 1_000),
    ]);
    expect([a, b]).toEqual([1, 1]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('serves the last answer while a fresh read runs, then the fresh one', async () => {
    const reads = new SharedReads<number>({
      ttlMs: TTL,
      keepMs: KEEP,
      maxKeys: 100,
    });
    await reads.get('k', () => Promise.resolve(1), T0);
    const fresh = vi.fn().mockResolvedValue(2);
    expect(await reads.get('k', fresh, T0 + TTL)).toBe(1);
    expect(fresh).toHaveBeenCalledTimes(1);
    await settle();
    expect(await reads.get('k', fresh, T0 + TTL + 1_000)).toBe(2);
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('keeps keys apart', async () => {
    const reads = new SharedReads<string>({
      ttlMs: TTL,
      keepMs: KEEP,
      maxKeys: 100,
    });
    expect(await reads.get('a', () => Promise.resolve('A'), T0)).toBe('A');
    expect(await reads.get('b', () => Promise.resolve('B'), T0)).toBe('B');
  });

  it('forgets a key nobody read for a while', async () => {
    const reads = new SharedReads<number>({
      ttlMs: TTL,
      keepMs: KEEP,
      maxKeys: 100,
    });
    await reads.get('k', () => Promise.resolve(1), T0);
    const later = vi.fn().mockResolvedValue(2);
    expect(await reads.get('k', later, T0 + KEEP)).toBe(2);
  });

  it('does not keep a failed read, and keeps serving the last answer', async () => {
    const reads = new SharedReads<number>({
      ttlMs: TTL,
      keepMs: KEEP,
      maxKeys: 100,
    });
    await expect(
      reads.get('new', () => Promise.reject(new Error('db down')), T0),
    ).rejects.toThrow('db down');
    await settle();
    expect(await reads.get('new', () => Promise.resolve(3), T0 + 1)).toBe(3);

    await reads.get('k', () => Promise.resolve(1), T0);
    expect(
      await reads.get(
        'k',
        () => Promise.reject(new Error('db down')),
        T0 + TTL,
      ),
    ).toBe(1);
    await settle();
    const retry = vi.fn().mockResolvedValue(4);
    expect(await reads.get('k', retry, T0 + TTL + 1)).toBe(1);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('drops the oldest key past the cap', async () => {
    const reads = new SharedReads<string>({
      ttlMs: TTL,
      keepMs: KEEP,
      maxKeys: 2,
    });
    for (const key of ['a', 'b', 'c']) {
      await reads.get(key, () => Promise.resolve(key), T0);
    }
    const again = vi.fn().mockResolvedValue('a2');
    expect(await reads.get('a', again, T0 + 1)).toBe('a2');
    expect(await reads.get('c', vi.fn(), T0 + 1)).toBe('c');
  });
});
