import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@evcore/db';
import type { PrismaService } from '@/prisma.service';
import { PlayableOddsRepository } from './playable-odds.repository';

function repositoryReturning(
  rows: {
    fixtureId: string;
    market: string;
    pick: string;
    bookmaker: string;
    odds: number;
    snapshotAt?: Date;
  }[],
) {
  const at = new Date('2026-10-29T06:00:00Z');
  const prisma = {
    client: {
      $queryRaw: vi
        .fn()
        .mockResolvedValue(rows.map((r) => ({ snapshotAt: at, ...r }))),
    },
  } as unknown as PrismaService;
  return new PlayableOddsRepository(prisma);
}

describe('PlayableOddsRepository.findPlayableQuotes', () => {
  it("computes the margin on 1xBet's own group, never mixing books", async () => {
    const repository = repositoryReturning([
      {
        fixtureId: 'f1',
        market: 'BTTS',
        pick: 'YES',
        bookmaker: '1xBet',
        odds: 1.8,
      },
      {
        fixtureId: 'f1',
        market: 'BTTS',
        pick: 'NO',
        bookmaker: '1xBet',
        odds: 1.9,
      },
      // Bet365 plus généreux sur NON : il ne doit pas entrer dans la marge 1xBet.
      {
        fixtureId: 'f1',
        market: 'BTTS',
        pick: 'NO',
        bookmaker: 'Bet365',
        odds: 2.1,
      },
    ]);
    const quotes = await repository.findPlayableQuotes([
      { fixtureId: 'f1', market: 'BTTS', pick: 'YES' },
    ]);
    const quote = quotes.get('f1|BTTS|YES');
    expect(quote?.operatorOdds).toBe(1.8);
    // 1/1,8 + 1/1,9 − 1 = 8,2 %.
    expect(quote?.operatorMargin).toBeCloseTo(0.0819, 3);
    // Shin on 1xBet's own pair, never Bet365's price.
    expect(quote?.operatorFairProbability).toBe(0.5146);
  });

  it("reads double chance on 1xBet's 1X2, by Shin", async () => {
    const repository = repositoryReturning([
      {
        fixtureId: 'f1',
        market: 'ONE_X_TWO',
        pick: 'HOME',
        bookmaker: '1xBet',
        odds: 1.5,
      },
      {
        fixtureId: 'f1',
        market: 'ONE_X_TWO',
        pick: 'DRAW',
        bookmaker: '1xBet',
        odds: 4.2,
      },
      {
        fixtureId: 'f1',
        market: 'ONE_X_TWO',
        pick: 'AWAY',
        bookmaker: '1xBet',
        odds: 6.5,
      },
      {
        fixtureId: 'f1',
        market: 'DOUBLE_CHANCE',
        pick: '1X',
        bookmaker: '1xBet',
        odds: 1.12,
      },
    ]);
    const quotes = await repository.findPlayableQuotes([
      { fixtureId: 'f1', market: 'DOUBLE_CHANCE', pick: '1X' },
      { fixtureId: 'f1', market: 'ONE_X_TWO', pick: 'AWAY' },
    ]);
    // 0,6427 + 0,2201 (independent reference: 0,862757).
    expect(quotes.get('f1|DOUBLE_CHANCE|1X')?.operatorFairProbability).toBe(
      0.8628,
    );
    expect(quotes.get('f1|ONE_X_TWO|AWAY')?.operatorFairProbability).toBe(
      0.1372,
    );
    // The 1X2 read for the double chance is not returned unasked.
    expect(quotes.has('f1|ONE_X_TWO|HOME')).toBe(false);
  });

  it('leaves the margin unknown when 1xBet does not quote the whole group', async () => {
    const repository = repositoryReturning([
      {
        fixtureId: 'f1',
        market: 'BTTS',
        pick: 'YES',
        bookmaker: '1xBet',
        odds: 1.8,
      },
      {
        fixtureId: 'f1',
        market: 'BTTS',
        pick: 'NO',
        bookmaker: 'Bet365',
        odds: 2.0,
      },
    ]);
    const quotes = await repository.findPlayableQuotes([
      { fixtureId: 'f1', market: 'BTTS', pick: 'YES' },
    ]);
    expect(quotes.get('f1|BTTS|YES')?.operatorMargin).toBeNull();
    expect(quotes.get('f1|BTTS|YES')?.operatorFairProbability).toBeNull();
  });

  it('ignores an outcome left on an older 1xBet snapshot', async () => {
    const repository = repositoryReturning([
      {
        fixtureId: 'f1',
        market: 'BTTS',
        pick: 'YES',
        bookmaker: '1xBet',
        odds: 1.8,
        snapshotAt: new Date('2026-10-29T18:00:00Z'),
      },
      {
        fixtureId: 'f1',
        market: 'BTTS',
        pick: 'NO',
        bookmaker: '1xBet',
        odds: 1.9,
        snapshotAt: new Date('2026-10-29T06:00:00Z'),
      },
    ]);
    const quotes = await repository.findPlayableQuotes([
      { fixtureId: 'f1', market: 'BTTS', pick: 'YES' },
    ]);
    expect(quotes.get('f1|BTTS|YES')?.operatorMargin).toBeNull();
  });

  it('reads the price as known at asOf when asked, never later', async () => {
    const asOf = new Date('2026-10-20T20:30:00Z');
    const repository = repositoryReturning([]);
    const prisma = (repository as unknown as { prisma: PrismaService }).prisma;
    const queryRaw = vi.mocked(prisma.client.$queryRaw);

    await repository.findPlayableQuotes(
      [{ fixtureId: 'f1', market: 'BTTS', pick: 'YES' }],
      { asOf },
    );
    await repository.findPlayableQuotes([
      { fixtureId: 'f1', market: 'BTTS', pick: 'YES' },
    ]);

    const sqlOf = (call: unknown[]) => JSON.stringify(call);
    const [withAsOf, withoutAsOf] = queryRaw.mock.calls;
    expect(sqlOf(withAsOf ?? [])).toContain('observedAt');
    expect(sqlOf(withAsOf ?? [])).toContain(asOf.toISOString());
    expect(sqlOf(withoutAsOf ?? [])).not.toContain('observedAt');
  });

  it('prices a corners line on the over/under pair of the same 1xBet snapshot', async () => {
    const at = new Date('2026-10-30T10:00:00Z');
    const older = new Date('2026-10-30T08:00:00Z');
    const prisma = {
      client: {
        $queryRaw: vi.fn().mockResolvedValue([
          {
            fixtureId: 'f1',
            market: 'CORNERS',
            pick: 'OVER',
            line: 9.5,
            bookmaker: '1xBet',
            odds: 1.9,
            snapshotAt: at,
          },
          {
            fixtureId: 'f1',
            market: 'CORNERS',
            pick: 'UNDER',
            line: 9.5,
            bookmaker: '1xBet',
            odds: 1.8,
            snapshotAt: at,
          },
          {
            fixtureId: 'f1',
            market: 'CORNERS',
            pick: 'OVER',
            line: 10.5,
            bookmaker: '1xBet',
            odds: 2.3,
            snapshotAt: at,
          },
          // L'autre côté sur un relevé plus ancien : marge inconnue.
          {
            fixtureId: 'f1',
            market: 'CORNERS',
            pick: 'UNDER',
            line: 10.5,
            bookmaker: '1xBet',
            odds: 1.5,
            snapshotAt: older,
          },
        ]),
      },
    } as unknown as PrismaService;
    const repository = new PlayableOddsRepository(prisma);

    const quotes = await repository.findPlayableQuotes([
      { fixtureId: 'f1', market: 'CORNERS', pick: 'OVER', line: 9.5 },
      { fixtureId: 'f1', market: 'CORNERS', pick: 'OVER', line: 10.5 },
    ]);

    const main = quotes.get('f1|CORNERS|OVER|9.5');
    expect(main?.operatorOdds).toBe(1.9);
    // 1/1,9 + 1/1,8 − 1 = 8,1 %.
    expect(main?.operatorMargin).toBeCloseTo(0.0819, 3);
    expect(main?.operatorFairProbability).toBe(0.4854);
    expect(quotes.get('f1|CORNERS|OVER|10.5')?.operatorMargin).toBeNull();
    expect(
      quotes.get('f1|CORNERS|OVER|10.5')?.operatorFairProbability,
    ).toBeNull();
    // Une clé sans ligne garde sa forme.
    expect(quotes.has('f1|CORNERS|OVER')).toBe(false);
  });
});

describe('PlayableOddsRepository — where the prices are read', () => {
  function sqlOf(asOf?: Date): Promise<string> {
    const query = vi.fn().mockResolvedValue([]);
    const repository = new PlayableOddsRepository({
      client: { $queryRaw: query },
    } as unknown as PrismaService);
    return repository
      .findPlayableQuotes([{ fixtureId: 'f1', market: 'BTTS', pick: 'YES' }], {
        asOf,
      })
      .then(() => {
        const [strings, ...values] = query.mock.calls[0] as [
          TemplateStringsArray,
          ...unknown[],
        ];
        return Prisma.sql(strings, ...values).text;
      });
  }

  it('reads the latest prices, the history only for a match without any', async () => {
    const sql = await sqlOf();
    expect(sql).toContain('public.odds_latest');
    expect(sql).toMatch(/NOT EXISTS[\s\S]*odds_latest[\s\S]*odds_snapshot/);
  });

  it('reads the history alone for a price known at a past instant', async () => {
    const sql = await sqlOf(new Date('2026-10-29T12:00:00Z'));
    expect(sql).not.toContain('odds_latest');
    expect(sql).toContain('public.odds_snapshot');
  });
});
