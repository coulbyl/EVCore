import { describe, expect, it, vi } from 'vitest';
import { Market } from '@evcore/db';
import type { MatchFacts } from '@evcore/analysis-core';
import type {
  MarketPriceRow,
  PlayableOddsRepository,
} from '@modules/betting-engine/pricing/playable-odds.repository';
import type { MatchFactsRepository } from '@modules/fixture-events/match-facts.repository';
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
  /** Every book's prices on the new markets, per match. */
  marketRows?: Record<string, MarketPriceRow[]>;
  facts?: Map<string, MatchFacts>;
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
        clock: { kind: 'finished' },
      },
    ],
  });
  const findMarketPrices = vi.fn(({ fixtureId }: { fixtureId: string }) =>
    Promise.resolve(input.marketRows?.[fixtureId] ?? []),
  );
  const findFacts = vi.fn().mockResolvedValue(input.facts ?? new Map());
  const findPlayableQuotes = vi.fn().mockResolvedValue(
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
  );
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
      findPlayableQuotes,
      findMarketPrices,
    } as unknown as PlayableOddsRepository,
    { heroOfDay } as unknown as TodayService,
    { record } as unknown as VerifiedTicketService,
    { findFacts } as unknown as MatchFactsRepository,
  );
  return {
    service,
    record,
    heroOfDay,
    findMarketPrices,
    findFacts,
    findPlayableQuotes,
  };
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
  it('eight bets at 1.50 with a fair frequency of 0.62: odds and chance multiply', () => {
    const legs: TicketQuoteLeg[] = Array.from({ length: 8 }, (_, n) => ({
      fixtureId: id(n),
      market: 'ONE_X_TWO',
      pick: 'HOME',
      line: null,
      kickoffAt: null,
      state: 'open',
      odds: 1.5,
      fair: 0.62,
      result: null,
      score: null,
    }));
    // 1.5^8 = 25.629; 0.62^8 = 0.0218…, in decimal.js.
    expect(totalsOf(legs)).toEqual({
      legCount: 8,
      odds: 25.629,
      chance: 0.0218340106,
    });
  });
});

describe('TicketService.quote, the new markets (corners, cards, scorers, shots, minute)', () => {
  const at = new Date('2026-10-31T12:00:00.000Z');
  const price = (
    market: string,
    pick: string,
    more: { odds: number; line?: number | null; book?: string },
  ): MarketPriceRow => ({
    market,
    pick,
    line: more.line ?? null,
    bookmaker: more.book ?? '1xBet',
    odds: more.odds,
    snapshotAt: at,
  });
  const cardsFacts = (yellows: number, reds: number): MatchFacts => ({
    score: { home: 1, away: 0 },
    teams: {
      home: {
        corners: 6,
        shotsTotal: 10,
        shotsOn: 4,
        yellowCards: yellows,
        redCards: 0,
      },
      away: {
        corners: 3,
        shotsTotal: 5,
        shotsOn: 1,
        yellowCards: 0,
        redCards: reds,
      },
    },
    events: [],
    lineups: null,
    playerStats: null,
  });

  it('keeps the line, prices at 1xBet with the pair, and the scorer at another book', async () => {
    const { service, findMarketPrices, findPlayableQuotes } = harness({
      fixtures: [upcoming(1), upcoming(2), upcoming(3)],
      quotes: [{ fixtureId: id(3), odds: 1.5, fair: 0.62 }],
      marketRows: {
        [id(1)]: [
          price('CORNERS', 'OVER', { odds: 1.9, line: 9.5 }),
          price('CORNERS', 'UNDER', { odds: 1.9, line: 9.5 }),
          // Another line of the same market: not this bet.
          price('CORNERS', 'OVER', { odds: 2.4, line: 10.5 }),
        ],
        // 1xBet does not price scorers: Bet365's price, no chance.
        [id(2)]: [
          price('GOAL_SCORER_ANYTIME', 'P9', { odds: 2.75, book: 'Bet365' }),
        ],
      },
    });
    const quote = await service.quote(
      {
        legs: [
          { fixtureId: id(1), market: Market.CORNERS, pick: 'OVER', line: 9.5 },
          {
            fixtureId: id(2),
            market: Market.GOAL_SCORER_ANYTIME,
            pick: 'P9',
          },
          leg(3),
        ],
      },
      NOW,
    );
    expect(quote.legs.map((l) => [l.line, l.odds, l.fair])).toEqual([
      [9.5, 1.9, 0.5],
      [null, 2.75, null],
      [null, 1.5, 0.62],
    ]);
    // The main markets only go to the 1xBet quote.
    expect(findPlayableQuotes).toHaveBeenCalledWith(
      [{ fixtureId: id(3), market: Market.ONE_X_TWO, pick: 'HOME' }],
      { operatorOnly: true },
    );
    expect(findMarketPrices).toHaveBeenCalledTimes(2);
    // The odds of every open bet; the chance unknown with the scorer's.
    expect(quote.totals).toEqual({ legCount: 3, odds: 7.838, chance: null });
  });

  it('a line no book prices any more: no price, out of the figures', async () => {
    const { service } = harness({
      fixtures: [upcoming(1)],
      quotes: [],
      marketRows: {
        [id(1)]: [
          price('CARDS', 'OVER', { odds: 1.8, line: 3.5 }),
          price('CARDS', 'UNDER', { odds: 1.95, line: 3.5 }),
        ],
      },
    });
    const quote = await service.quote(
      {
        legs: [
          { fixtureId: id(1), market: Market.CARDS, pick: 'OVER', line: 4.5 },
        ],
        verify: true,
      },
      NOW,
    );
    expect(quote.legs[0]?.odds).toBeNull();
    expect(quote.totals).toBeNull();
  });

  it('settles on the match facts; unknown waits, then is refunded, never lost', async () => {
    const finished = (n: number, daysAgo: number) => ({
      ...upcoming(n),
      scheduledAt: new Date(NOW.getTime() - daysAgo * 86_400_000),
      status: 'FINISHED',
      homeScore: 1,
      awayScore: 0,
    });
    const cards = (n: number) => ({
      fixtureId: id(n),
      market: Market.CARDS,
      pick: 'OVER',
      line: 4.5,
    });
    const { service, findFacts } = harness({
      fixtures: [
        finished(1, 1),
        finished(2, 1),
        finished(3, 1),
        finished(4, 15),
      ],
      quotes: [],
      facts: new Map([
        // 5 yellows, no red: over 4,5 won.
        [id(1), cardsFacts(5, 0)],
        // 4 yellows and a red: 5 or 6 cards, over 4,5 either way.
        [id(2), cardsFacts(4, 1)],
        // 4 yellows and a red, line 5: refunded at one count, won at the
        // other: unknown.
      ]),
    });
    const quote = await service.quote(
      {
        legs: [
          cards(1),
          cards(2),
          { ...cards(3), line: 5 },
          { ...cards(4), line: 5 },
        ],
      },
      NOW,
    );
    expect(findFacts).toHaveBeenCalledWith([id(1), id(2), id(3), id(4)]);
    expect(quote.legs.map((l) => l.result)).toEqual([
      'won',
      'won',
      // No facts yet, a day after: pending.
      null,
      // Still unknown two weeks after: refunded as the coupons are.
      'void',
    ]);
  });

  it('a second quote of the same settled ticket answers the same', async () => {
    const input = {
      fixtures: [
        {
          ...upcoming(1),
          scheduledAt: new Date('2026-10-30T19:00:00.000Z'),
          status: 'FINISHED',
          homeScore: 1,
          awayScore: 0,
        },
      ],
      quotes: [],
      facts: new Map([[id(1), cardsFacts(2, 0)]]),
    };
    const legs = [
      { fixtureId: id(1), market: Market.CARDS, pick: 'UNDER', line: 3.5 },
    ];
    const first = await harness(input).service.quote({ legs }, NOW);
    const second = await harness(input).service.quote({ legs }, NOW);
    expect(first.legs[0]?.result).toBe('won');
    expect(second.legs).toEqual(first.legs);
  });
});
