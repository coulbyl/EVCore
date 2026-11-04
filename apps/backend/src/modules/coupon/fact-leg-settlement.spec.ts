import { describe, expect, it } from 'vitest';
import { BetStatus, Market } from '@evcore/db';
import type { MatchFacts } from '@evcore/analysis-core';
import { settleFactLeg } from './fact-leg-settlement';

const DAY = 24 * 60 * 60 * 1000;
const KICKOFF = new Date('2026-11-01T15:00:00Z');

const facts = (corners: { home: number | null; away: number | null }) =>
  ({
    score: { home: 1, away: 0 },
    teams: {
      home: {
        corners: corners.home,
        shotsTotal: null,
        shotsOn: null,
        yellowCards: null,
        redCards: null,
      },
      away: {
        corners: corners.away,
        shotsTotal: null,
        shotsOn: null,
        yellowCards: null,
        redCards: null,
      },
    },
    events: null,
    lineups: null,
    playerStats: null,
  }) satisfies MatchFacts;

const corners = (input: {
  facts: MatchFacts | null;
  daysAfter: number;
}): BetStatus | null =>
  settleFactLeg({
    market: Market.CORNERS,
    pick: 'OVER',
    line: 9.5,
    facts: input.facts,
    kickoff: KICKOFF,
    now: new Date(KICKOFF.getTime() + input.daysAfter * DAY),
  });

describe('settleFactLeg', () => {
  it('grades on the facts, the same answer on a second pass', () => {
    const known = facts({ home: 6, away: 5 });
    expect(corners({ facts: known, daysAfter: 1 })).toBe(BetStatus.WON);
    expect(corners({ facts: known, daysAfter: 1 })).toBe(BetStatus.WON);
  });

  it('waits while a count is unknown, refunds past the grace period', () => {
    const unknown = facts({ home: 6, away: null });
    expect(corners({ facts: unknown, daysAfter: 2 })).toBeNull();
    expect(corners({ facts: null, daysAfter: 2 })).toBeNull();
    expect(corners({ facts: unknown, daysAfter: 15 })).toBe(BetStatus.VOID);
  });

  it('late facts grade a refunded leg, a correction regrades it', () => {
    expect(corners({ facts: facts({ home: 6, away: 5 }), daysAfter: 20 })).toBe(
      BetStatus.WON,
    );
    expect(corners({ facts: facts({ home: 5, away: 4 }), daysAfter: 20 })).toBe(
      BetStatus.LOST,
    );
  });

  it('never refunds a leg its market cannot settle as lost', () => {
    expect(
      settleFactLeg({
        market: Market.GOAL_SCORER_ANYTIME,
        pick: 'P11',
        line: null,
        facts: null,
        kickoff: KICKOFF,
        now: new Date(KICKOFF.getTime() + 15 * DAY),
      }),
    ).toBe(BetStatus.VOID);
  });
});
