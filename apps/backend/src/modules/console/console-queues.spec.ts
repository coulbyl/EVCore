import { describe, expect, it } from 'vitest';
import { queueListOf, queueViewOf, type QueueReading } from './console-queues';

const NOW = new Date('2026-11-01T08:05:00.000Z');
const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => NOW.getTime() - hours * HOUR;

function reading(over: Partial<QueueReading>): QueueReading {
  return {
    key: 'settlement',
    paused: false,
    failed: [],
    running: [],
    lastDoneAt: ago(0.1),
    nextAt: NOW.getTime() + 0.4 * HOUR,
    ...over,
  };
}

describe('queueViewOf', () => {
  it('a recent failure still in the queue is « failed », with its reason', () => {
    const view = queueViewOf(
      reading({
        key: 'elo',
        lastDoneAt: ago(29),
        failed: [{ finishedAt: ago(5), reason: 'Elo TSV download failed' }],
      }),
      NOW,
    );
    expect(view.state).toBe('failed');
    expect(view.failure).toEqual({
      count: 1,
      at: new Date(ago(5)).toISOString(),
      reason: 'Elo TSV download failed',
    });
  });

  it('a failure older than a day no longer turns the line red', () => {
    const view = queueViewOf(
      reading({ failed: [{ finishedAt: ago(30), reason: 'old' }] }),
      NOW,
    );
    expect(view.state).toBe('on_time');
    expect(view.failure).toBeNull();
  });

  it('a failure followed by a success is no longer a problem', () => {
    const view = queueViewOf(
      reading({
        failed: [{ finishedAt: ago(12), reason: 'db down' }],
        lastDoneAt: ago(0.1),
      }),
      NOW,
    );
    expect(view.state).toBe('on_time');
  });

  it('running says since when; paused and on demand are said', () => {
    expect(
      queueViewOf(reading({ running: [{ since: ago(0.05) }] }), NOW),
    ).toMatchObject({
      state: 'running',
      runningSince: new Date(ago(0.05)).toISOString(),
    });
    expect(
      queueViewOf(reading({ key: 'stats_backfill', paused: true }), NOW).state,
    ).toBe('paused');
    expect(
      queueViewOf(reading({ key: 'rebuild', nextAt: null }), NOW).state,
    ).toBe('on_demand');
  });
});

describe('queueListOf', () => {
  it('failures first, then running, then by next run; the watch only when failing', () => {
    const list = queueListOf(
      [
        reading({ key: 'analysis', nextAt: NOW.getTime() + 13 * HOUR }),
        reading({ key: 'odds', nextAt: NOW.getTime() + 0.1 * HOUR }),
        reading({ key: 'rebuild', nextAt: null }),
        reading({ key: 'analysis_soon', running: [{ since: ago(0.03) }] }),
        reading({
          key: 'elo',
          lastDoneAt: null,
          failed: [{ finishedAt: ago(5), reason: 'x' }],
        }),
        reading({ key: 'watch' }),
      ],
      NOW,
    );
    expect(list.map((v) => v.key)).toEqual([
      'elo',
      'analysis_soon',
      'odds',
      'analysis',
      'rebuild',
    ]);
  });
});
