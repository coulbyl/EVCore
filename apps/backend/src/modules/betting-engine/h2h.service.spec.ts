import { describe, it, expect, vi } from 'vitest';
import { H2HService } from './h2h.service';
import type { PrismaService } from '@/prisma.service';

function makePrismaMock(fixtures: unknown[]): PrismaService {
  return {
    client: {
      fixture: {
        findMany: vi.fn().mockResolvedValue(fixtures),
      },
    },
  } as unknown as PrismaService;
}

describe('H2HService', () => {
  it('returns null when no historical H2H fixtures exist', async () => {
    const service = new H2HService(makePrismaMock([]));

    await expect(
      service.computeH2HScore({
        homeTeamId: 'home',
        awayTeamId: 'away',
        favoriteTeamId: 'home',
        fixtureDate: new Date('2026-03-03T00:00:00.000Z'),
      }),
    ).resolves.toBeNull();
  });

  it('returns null when fewer than 3 valid fixtures are found', async () => {
    const service = new H2HService(
      makePrismaMock([
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 2, awayScore: 1 },
        { homeTeamId: 'away', awayTeamId: 'home', homeScore: 0, awayScore: 1 },
      ]),
    );

    await expect(
      service.computeH2HScore({
        homeTeamId: 'home',
        awayTeamId: 'away',
        favoriteTeamId: 'home',
        fixtureDate: new Date('2026-03-03T00:00:00.000Z'),
      }),
    ).resolves.toBeNull();
  });

  it('excludes fixtures with incomplete scores from the sample count', async () => {
    const service = new H2HService(
      makePrismaMock([
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 2, awayScore: 1 },
        {
          homeTeamId: 'away',
          awayTeamId: 'home',
          homeScore: null,
          awayScore: null,
        },
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 1, awayScore: 1 },
      ]),
    );

    await expect(
      service.computeH2HScore({
        homeTeamId: 'home',
        awayTeamId: 'away',
        favoriteTeamId: 'home',
        fixtureDate: new Date('2026-03-03T00:00:00.000Z'),
      }),
    ).resolves.toBeNull();
  });

  it('counts a draw as 0.5 instead of a favorite loss', async () => {
    const service = new H2HService(
      makePrismaMock([
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 1, awayScore: 1 },
        { homeTeamId: 'away', awayTeamId: 'home', homeScore: 1, awayScore: 1 },
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 1, awayScore: 1 },
      ]),
    );

    await expect(
      service.computeH2HScore({
        homeTeamId: 'home',
        awayTeamId: 'away',
        favoriteTeamId: 'home',
        fixtureDate: new Date('2026-03-03T00:00:00.000Z'),
      }),
    ).resolves.toBeCloseTo(0.5, 8);
  });

  it('weights the most recent (first) fixture more heavily via 0.8 decay', async () => {
    // Most recent (index 0) is a favorite win; older two are favorite losses.
    // Unweighted ratio would be 1/3, but decay should pull the result above that.
    const service = new H2HService(
      makePrismaMock([
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 2, awayScore: 0 },
        { homeTeamId: 'away', awayTeamId: 'home', homeScore: 2, awayScore: 0 },
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 0, awayScore: 2 },
      ]),
    );

    const result = await service.computeH2HScore({
      homeTeamId: 'home',
      awayTeamId: 'away',
      favoriteTeamId: 'home',
      fixtureDate: new Date('2026-03-03T00:00:00.000Z'),
    });

    // weights: 1, 0.8, 0.64 -> weighted sum = 1*1 + 0.8*0 + 0.64*0 = 1, total = 2.44
    expect(result).toBeCloseTo(1 / 2.44, 8);
    expect(result).toBeGreaterThan(1 / 3);
  });

  it('returns decay-weighted ratio of favorite wins across up to 5 H2H fixtures', async () => {
    const service = new H2HService(
      makePrismaMock([
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 2, awayScore: 1 },
        { homeTeamId: 'away', awayTeamId: 'home', homeScore: 0, awayScore: 1 },
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 1, awayScore: 1 },
        { homeTeamId: 'away', awayTeamId: 'home', homeScore: 2, awayScore: 0 },
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 3, awayScore: 0 },
      ]),
    );

    const result = await service.computeH2HScore({
      homeTeamId: 'home',
      awayTeamId: 'away',
      favoriteTeamId: 'home',
      fixtureDate: new Date('2026-03-03T00:00:00.000Z'),
    });

    // outcomes (recent -> old): win, win, draw(0.5), loss, win
    // weights: 1, 0.8, 0.64, 0.512, 0.4096
    const weightedSum = 1 * 1 + 0.8 * 1 + 0.64 * 0.5 + 0.512 * 0 + 0.4096 * 1;
    const weightTotal = 1 + 0.8 + 0.64 + 0.512 + 0.4096;
    expect(result).toBeCloseTo(weightedSum / weightTotal, 8);
  });
});

describe('H2HService.computeH2HMarketSignals', () => {
  it('returns all-null signals with sampleSize when fewer than 3 valid legs are found', async () => {
    const service = new H2HService(
      makePrismaMock([
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 2, awayScore: 1 },
      ]),
    );

    await expect(
      service.computeH2HMarketSignals({
        homeTeamId: 'home',
        awayTeamId: 'away',
        fixtureDate: new Date('2026-03-03T00:00:00.000Z'),
      }),
    ).resolves.toEqual({
      btts: null,
      over25: null,
      cleanSheetHome: null,
      cleanSheetAway: null,
      winToNilHome: null,
      winToNilAway: null,
      sampleSize: 1,
    });
  });

  it('computes decay-weighted BTTS/OVER 2.5 rates, symmetric regardless of leg venue', async () => {
    const service = new H2HService(
      makePrismaMock([
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 2, awayScore: 1 }, // BTTS, 3 goals
        { homeTeamId: 'away', awayTeamId: 'home', homeScore: 0, awayScore: 0 }, // no BTTS, 0 goals
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 1, awayScore: 1 }, // BTTS, 2 goals
      ]),
    );

    const result = await service.computeH2HMarketSignals({
      homeTeamId: 'home',
      awayTeamId: 'away',
      fixtureDate: new Date('2026-03-03T00:00:00.000Z'),
    });

    // weights: 1, 0.8, 0.64 ; btts indicator: 1, 0, 1 ; over25 indicator: 1, 0, 0
    const weightTotal = 1 + 0.8 + 0.64;
    expect(result.btts).toBeCloseTo((1 * 1 + 0.64 * 1) / weightTotal, 8);
    expect(result.over25).toBeCloseTo((1 * 1) / weightTotal, 8);
    expect(result.sampleSize).toBe(3);
  });

  it('orients clean sheet / win-to-nil rates by the current fixture home/away side, not by leg venue', async () => {
    const service = new H2HService(
      makePrismaMock([
        // leg 1 (most recent): 'home' team played away in this leg, won 2-0 (clean sheet + win-to-nil for 'home')
        { homeTeamId: 'away', awayTeamId: 'home', homeScore: 0, awayScore: 2 },
        // leg 2: 'home' team played at home, drew 1-1 (no clean sheet, no win-to-nil for 'home')
        { homeTeamId: 'home', awayTeamId: 'away', homeScore: 1, awayScore: 1 },
        // leg 3: 'away' team played at home, won 3-0 (clean sheet + win-to-nil for 'away')
        { homeTeamId: 'away', awayTeamId: 'home', homeScore: 3, awayScore: 0 },
      ]),
    );

    const result = await service.computeH2HMarketSignals({
      homeTeamId: 'home',
      awayTeamId: 'away',
      fixtureDate: new Date('2026-03-03T00:00:00.000Z'),
    });

    const weightTotal = 1 + 0.8 + 0.64;
    // 'home' team: clean sheet + win-to-nil only in leg 1 (weight 1)
    expect(result.cleanSheetHome).toBeCloseTo(1 / weightTotal, 8);
    expect(result.winToNilHome).toBeCloseTo(1 / weightTotal, 8);
    // 'away' team: clean sheet + win-to-nil only in leg 3 (weight 0.64)
    expect(result.cleanSheetAway).toBeCloseTo(0.64 / weightTotal, 8);
    expect(result.winToNilAway).toBeCloseTo(0.64 / weightTotal, 8);
  });
});
