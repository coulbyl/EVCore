import { describe, it, expect } from 'vitest';
import type { Fixture } from '@evcore/db';
import { Prisma } from '@evcore/db';
import {
  calculateRecentForm,
  calculateRollingXg,
  calculateDomExtPerf,
  calculateLeagueVolatility,
} from './rolling-stats.utils';

function makeFixture(overrides: Partial<Fixture>): Fixture {
  return {
    id: 'fixture-id',
    externalId: 1,
    seasonId: 'season-id',
    homeTeamId: 'home',
    awayTeamId: 'away',
    matchday: 1,
    scheduledAt: new Date('2022-08-01T00:00:00.000Z'),
    status: 'FINISHED',
    homeScore: 0,
    awayScore: 0,
    homeXg: new Prisma.Decimal(0),
    awayXg: new Prisma.Decimal(0),
    xgUnavailable: false,
    createdAt: new Date('2022-08-01T00:00:00.000Z'),
    updatedAt: new Date('2022-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('calculateRecentForm', () => {
  it('returns 0 when there is no history', () => {
    expect(calculateRecentForm([]).toNumber()).toBe(0);
  });

  it('normalizes a perfect recent run to 1', () => {
    expect(calculateRecentForm(['W', 'W', 'W', 'W', 'W']).toNumber()).toBe(1);
  });

  it('weights recent results higher than old ones', () => {
    const betterRecent = calculateRecentForm([
      'L',
      'L',
      'L',
      'W',
      'W',
    ]).toNumber();
    const worseRecent = calculateRecentForm([
      'W',
      'W',
      'L',
      'L',
      'L',
    ]).toNumber();
    expect(betterRecent).toBeGreaterThan(worseRecent);
  });
});

describe('calculateRollingXg', () => {
  it('returns zeroes when no xg data exists', () => {
    const fixtures = [
      makeFixture({
        homeTeamId: 'team-a',
        awayTeamId: 'team-b',
        homeXg: null,
        awayXg: null,
      }),
    ];

    const { xgFor, xgAgainst } = calculateRollingXg(fixtures, 'team-a');
    expect(xgFor.toNumber()).toBe(0);
    expect(xgAgainst.toNumber()).toBe(0);
  });

  it('computes rolling averages from the latest 10 fixtures only', () => {
    const fixtures = Array.from({ length: 12 }, (_, i) =>
      makeFixture({
        id: `f-${i}`,
        homeTeamId: i % 2 === 0 ? 'team-a' : 'team-b',
        awayTeamId: i % 2 === 0 ? 'team-b' : 'team-a',
        homeXg: new Prisma.Decimal(i + 1),
        awayXg: new Prisma.Decimal(i + 2),
      }),
    );

    const { xgFor, xgAgainst } = calculateRollingXg(fixtures, 'team-a');

    expect(xgFor.toNumber()).toBeCloseTo(8, 6);
    expect(xgAgainst.toNumber()).toBeCloseTo(8, 6);
  });
});

describe('calculateDomExtPerf', () => {
  it('computes home/away win rates and global draw rate', () => {
    const fixtures = [
      makeFixture({
        homeTeamId: 'team-a',
        awayTeamId: 'team-b',
        homeScore: 2,
        awayScore: 1,
      }),
      makeFixture({
        homeTeamId: 'team-c',
        awayTeamId: 'team-a',
        homeScore: 0,
        awayScore: 2,
      }),
      makeFixture({
        homeTeamId: 'team-a',
        awayTeamId: 'team-d',
        homeScore: 1,
        awayScore: 1,
      }),
      makeFixture({
        homeTeamId: 'team-e',
        awayTeamId: 'team-a',
        homeScore: 1,
        awayScore: 1,
      }),
    ];

    const { homeWinRate, awayWinRate, drawRate } = calculateDomExtPerf(
      fixtures,
      'team-a',
    );

    expect(homeWinRate.toNumber()).toBeCloseTo(0.5, 6);
    expect(awayWinRate.toNumber()).toBeCloseTo(0.5, 6);
    expect(drawRate.toNumber()).toBeCloseTo(0.5, 6);
  });
});

describe('calculateLeagueVolatility', () => {
  it('returns 0 when there are fewer than 2 finished fixtures', () => {
    const fixtures = [
      makeFixture({ homeScore: 1, awayScore: 0 }),
      makeFixture({ homeScore: null, awayScore: null }),
    ];

    expect(calculateLeagueVolatility(fixtures).toNumber()).toBe(0);
  });

  it('computes population standard deviation of total goals', () => {
    const fixtures = [
      makeFixture({ homeScore: 1, awayScore: 0 }), // total 1
      makeFixture({ homeScore: 2, awayScore: 1 }), // total 3
      makeFixture({ homeScore: 4, awayScore: 1 }), // total 5
    ];

    expect(calculateLeagueVolatility(fixtures).toNumber()).toBeCloseTo(
      1.632993,
      6,
    );
  });
});
