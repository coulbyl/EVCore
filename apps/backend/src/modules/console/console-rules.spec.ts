import { describe, expect, it } from 'vitest';
import { consoleStatusOf } from './console-rules';
import type { ConsoleSignals } from './console.types';

const NOW = new Date('2026-11-01T18:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

/** Everything fine: the three lights green, « Rien à faire ». */
function healthy(over: Partial<ConsoleSignals> = {}): ConsoleSignals {
  return {
    now: NOW,
    lastOddsAt: ago(1),
    etlFailures: { count: 0, lastBody: null, quotaBody: null },
    statsLate: { fixtures: 0, competitions: 0 },
    tomorrowCoupons: 7,
    lastAnalysisAt: ago(2),
    lastAiAt: ago(3),
    absences: [],
    suspendedMarkets: [],
    lastPlayerSeenAt: ago(1),
    unansweredMessages: 0,
    ...over,
  };
}

describe('consoleStatusOf', () => {
  it('all green and nothing to do when everything runs', () => {
    expect(consoleStatusOf(healthy())).toMatchObject({
      lights: { data: 'green', engine: 'green', players: 'green' },
      todo: [],
    });
  });

  it('Data is red without odds for 24 h, with the hours said', () => {
    const status = consoleStatusOf(healthy({ lastOddsAt: ago(30) }));
    expect(status.lights.data).toBe('red');
    expect(status.todo).toEqual([
      { kind: 'odds_stale', light: 'data', severity: 'red', hours: 30 },
    ]);
  });

  it('the quota is its own line, apart from the other failures', () => {
    const status = consoleStatusOf(
      healthy({
        etlFailures: {
          count: 3,
          lastBody: 'odds-prematch-sync failed',
          quotaBody: 'API-Football quota at 81/100',
        },
      }),
    );
    expect(status.todo.map((t) => t.kind)).toEqual(['quota', 'etl_failed']);
    expect(status.todo[1]).toMatchObject({ count: 2 });
  });

  it('late stats only turn Data orange', () => {
    const status = consoleStatusOf(
      healthy({ statsLate: { fixtures: 12, competitions: 2 } }),
    );
    expect(status.lights.data).toBe('orange');
  });

  it('no coupon for tomorrow is red after 17:30 UTC, not before', () => {
    const late = consoleStatusOf(healthy({ tomorrowCoupons: 0 }));
    expect(late.lights.engine).toBe('red');
    expect(late.todo[0]).toMatchObject({
      kind: 'coupons_missing',
      forDate: '2026-11-02',
    });
    const early = consoleStatusOf(
      healthy({
        now: new Date('2026-11-01T17:00:00.000Z'),
        tomorrowCoupons: 0,
      }),
    );
    expect(early.lights.engine).toBe('green');
  });

  it('a product absent three days of seven, or today, is a line', () => {
    const status = consoleStatusOf(
      healthy({
        absences: [
          { product: 'HUNTER_CORNERS', days: 4, today: false },
          { product: 'FAVOURITE', days: 1, today: true },
          { product: 'DOUBLE', days: 2, today: false },
        ],
      }),
    );
    expect(status.lights.engine).toBe('orange');
    expect(
      status.todo.map((t) => (t.kind === 'product_absent' ? t.product : '')),
    ).toEqual(['HUNTER_CORNERS', 'FAVOURITE']);
  });

  it('never seen counts as stale; a red line comes before an orange one', () => {
    const status = consoleStatusOf(
      healthy({
        lastPlayerSeenAt: null,
        unansweredMessages: 2,
        lastAiAt: null,
      }),
    );
    expect(status.lights).toMatchObject({ engine: 'orange', players: 'red' });
    expect(status.todo[0]).toMatchObject({
      kind: 'players_silent',
      hours: null,
    });
  });
});
