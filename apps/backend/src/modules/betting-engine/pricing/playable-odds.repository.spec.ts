import { describe, it, expect, vi } from 'vitest';
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
    expect(quotes.get('f1|CORNERS|OVER|10.5')?.operatorMargin).toBeNull();
    // Une clé sans ligne garde sa forme.
    expect(quotes.has('f1|CORNERS|OVER')).toBe(false);
  });
});
