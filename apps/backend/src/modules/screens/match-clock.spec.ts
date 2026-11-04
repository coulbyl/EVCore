import { describe, expect, it } from 'vitest';
import { matchClockOf, shownScoreOf } from './match-clock';

const NOW = new Date('2026-11-03T21:10:00Z');
const row = (overrides: Partial<Parameters<typeof matchClockOf>[0]>) => ({
  status: 'IN_PROGRESS',
  scheduledAt: new Date('2026-11-03T20:00:00Z'),
  liveStatus: '2H',
  liveElapsed: 67,
  ...overrides,
});

describe('matchClockOf', () => {
  it('reads the minute of a match in progress', () => {
    expect(matchClockOf(row({}), NOW)).toEqual({ kind: 'live', minute: 67 });
  });

  it('reads half-time and the break before extra time', () => {
    for (const liveStatus of ['HT', 'BT']) {
      expect(matchClockOf(row({ liveStatus }), NOW)).toEqual({
        kind: 'half_time',
      });
    }
  });

  it('has no minute for a match kicked off but not yet seen in progress', () => {
    expect(
      matchClockOf(
        row({ status: 'SCHEDULED', liveStatus: null, liveElapsed: null }),
        NOW,
      ),
    ).toEqual({ kind: 'live', minute: null });
  });

  it('is finished once the match is, whatever the stored clock', () => {
    expect(matchClockOf(row({ status: 'FINISHED' }), NOW)).toEqual({
      kind: 'finished',
    });
  });

  it('has no clock before kick-off nor for a postponed match', () => {
    expect(
      matchClockOf(
        row({
          status: 'SCHEDULED',
          scheduledAt: new Date('2026-11-03T22:00:00Z'),
        }),
        NOW,
      ),
    ).toBeNull();
    expect(matchClockOf(row({ status: 'POSTPONED' }), NOW)).toBeNull();
  });
});

describe('shownScoreOf', () => {
  it('shows the live score and the final one', () => {
    for (const status of ['IN_PROGRESS', 'FINISHED']) {
      expect(shownScoreOf({ status, homeScore: 0, awayScore: 2 })).toEqual({
        home: 0,
        away: 2,
      });
    }
  });

  it('shows no score before kick-off or when one side is unknown', () => {
    expect(
      shownScoreOf({ status: 'SCHEDULED', homeScore: 0, awayScore: 0 }),
    ).toBeNull();
    expect(
      shownScoreOf({ status: 'IN_PROGRESS', homeScore: 1, awayScore: null }),
    ).toBeNull();
  });
});
