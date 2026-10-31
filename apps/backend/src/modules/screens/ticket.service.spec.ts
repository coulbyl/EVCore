import { describe, expect, it, vi } from 'vitest';
import { Market } from '@evcore/db';
import type { PlayableOddsRepository } from '@modules/betting-engine/pricing/playable-odds.repository';
import type { VerifiedTicketService } from '@modules/verified-ticket/verified-ticket.service';
import type { MatchesRepository } from './matches.repository';
import type { TodayService } from './today.service';
import { TicketService, totalsOf } from './ticket.service';
import type { TicketQuoteLeg } from './ticket.types';

const NOW = new Date('2026-10-31T15:00:00.000Z');
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

type Fixture = {
  id: string;
  scheduledAt: Date;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
};

function harness(input: {
  fixtures: Fixture[];
  quotes: { fixtureId: string; odds: number | null; fair: number | null }[];
}) {
  const record = vi.fn().mockResolvedValue(undefined);
  const heroOfDay = vi.fn().mockResolvedValue({
    id: 'cp-fav',
    product: 'FAVOURITE',
    chance: 0.8,
    state: 'won',
    odds: 1.24,
    paidOdds: null,
    legs: [
      {
        home: { name: 'Paris SG' },
        away: { name: 'Lens' },
        score: { home: 2, away: 0 },
      },
    ],
  });
  const service = new TicketService(
    {
      findTicketFixtures: vi.fn().mockResolvedValue(
        input.fixtures.map((f) => ({
          homeScore: null,
          awayScore: null,
          homeHtScore: null,
          awayHtScore: null,
          ...f,
        })),
      ),
    } as unknown as MatchesRepository,
    {
      findPlayableQuotes: vi.fn().mockResolvedValue(
        new Map(
          input.quotes.map((q) => [
            `${q.fixtureId}|ONE_X_TWO|HOME`,
            {
              fixtureId: q.fixtureId,
              market: 'ONE_X_TWO',
              pick: 'HOME',
              operatorOdds: q.odds,
              operatorBookmaker: '1xBet',
              operatorMargin: 0.05,
              operatorFairProbability: q.fair,
              lowestOdds: q.odds,
              lowestBookmaker: '1xBet',
            },
          ]),
        ),
      ),
    } as unknown as PlayableOddsRepository,
    { heroOfDay } as unknown as TodayService,
    { record } as unknown as VerifiedTicketService,
  );
  return { service, record, heroOfDay };
}

const upcoming = (n: number) => ({
  id: id(n),
  scheduledAt: new Date('2026-10-31T19:00:00.000Z'),
  status: 'SCHEDULED',
});
const leg = (n: number) => ({
  fixtureId: id(n),
  market: Market.ONE_X_TWO,
  pick: 'HOME',
});

describe('TicketService.quote', () => {
  it('prices each bet now and multiplies the open ones (07 § 4)', async () => {
    const { service, record } = harness({
      fixtures: [
        upcoming(1),
        upcoming(2),
        // Kick-off passed: « Commencé », out of the figures.
        { ...upcoming(3), scheduledAt: new Date('2026-10-31T14:00:00.000Z') },
      ],
      quotes: [
        { fixtureId: id(1), odds: 1.5, fair: 0.62 },
        { fixtureId: id(2), odds: 1.5, fair: 0.62 },
        { fixtureId: id(3), odds: 2, fair: 0.45 },
      ],
    });
    const quote = await service.quote({ legs: [leg(1), leg(2), leg(3)] }, NOW);
    expect(quote.legs.map((l) => l.state)).toEqual(['open', 'open', 'started']);
    expect(quote.totals).toEqual({
      legCount: 2,
      odds: 2.25,
      chance: 0.3844,
      // 1 − (0.62 × 1.5)² = 1 − 0.8649
      keep: 0.1351,
    });
    expect(quote.hero).toEqual({
      couponId: 'cp-fav',
      product: 'FAVOURITE',
      chance: 0.8,
      state: 'won',
      odds: 1.24,
      match: { home: 'Paris SG', away: 'Lens', score: { home: 2, away: 0 } },
    });
    expect(record).not.toHaveBeenCalled();
  });

  it('counts the ticket with its own figures when asked, anonymously', async () => {
    const { service, record } = harness({
      fixtures: [upcoming(1)],
      quotes: [{ fixtureId: id(1), odds: 1.5, fair: 0.62 }],
    });
    await service.quote({ legs: [leg(1)], verify: true }, NOW);
    expect(record).toHaveBeenCalledWith(
      { legCount: 1, totalOdds: 1.5, chance: 0.62 },
      NOW,
    );
  });

  it('refuses two bets of one match', async () => {
    const { service } = harness({ fixtures: [upcoming(1)], quotes: [] });
    await expect(
      service.quote({ legs: [leg(1), { ...leg(1), pick: 'DRAW' }] }, NOW),
    ).rejects.toThrow('One bet per match');
  });

  it('postponed, unknown or no longer priced: out of the figures', async () => {
    const { service, record } = harness({
      fixtures: [{ ...upcoming(1), status: 'POSTPONED' }, upcoming(2)],
      quotes: [
        { fixtureId: id(1), odds: 1.5, fair: 0.62 },
        { fixtureId: id(2), odds: null, fair: null },
      ],
    });
    const quote = await service.quote(
      { legs: [leg(1), leg(2), leg(3)], verify: true },
      NOW,
    );
    expect(quote.legs.map((l) => l.state)).toEqual([
      'postponed',
      'open',
      'unknown',
    ]);
    // A match the server no longer knows does not leave the ticket pending.
    expect(quote.legs[2]?.result).toBe('void');
    expect(quote.totals).toBeNull();
    expect(record).not.toHaveBeenCalled();
  });
});

describe('TicketService.quote, the ticket of yesterday (07 § 6)', () => {
  it('settles each bet by the selections rules and compares with that day', async () => {
    const finished = (n: number, home: number, away: number) => ({
      ...upcoming(n),
      scheduledAt: new Date('2026-10-30T19:00:00.000Z'),
      status: 'FINISHED',
      homeScore: home,
      awayScore: away,
    });
    const { service, heroOfDay } = harness({
      fixtures: [
        finished(1, 2, 0),
        finished(2, 1, 1),
        { ...upcoming(3), status: 'POSTPONED' },
        { ...upcoming(4), status: 'IN_PROGRESS' },
      ],
      quotes: [],
    });
    const quote = await service.quote(
      { legs: [leg(1), leg(2), leg(3), leg(4)], day: '2026-10-30' },
      NOW,
    );
    expect(quote.legs.map((l) => [l.result, l.score])).toEqual([
      ['won', { home: 2, away: 0 }],
      ['lost', { home: 1, away: 1 }],
      ['void', null],
      [null, null],
    ]);
    expect(heroOfDay).toHaveBeenCalledWith(new Date('2026-10-30'), NOW);
  });
});

describe('totalsOf', () => {
  it('eight bets at 1.50 with a fair frequency of 0.62: 1xBet keeps 44 %', () => {
    const legs: TicketQuoteLeg[] = Array.from({ length: 8 }, (_, n) => ({
      fixtureId: id(n),
      market: 'ONE_X_TWO',
      pick: 'HOME',
      kickoffAt: null,
      state: 'open',
      odds: 1.5,
      fair: 0.62,
      result: null,
      score: null,
    }));
    // (0.93)^8 = 0.5596 (07 § 4).
    expect(totalsOf(legs)?.keep).toBe(0.4404);
  });
});
