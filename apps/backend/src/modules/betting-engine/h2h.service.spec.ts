import { describe, it, expect, vi } from 'vitest';
import { H2HService } from './h2h.service';
import type { PrismaService } from '@/prisma.service';

describe('H2HService', () => {
  it('returns null when no historical H2H fixtures exist', async () => {
    const prismaMock = {
      client: {
        fixture: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    } as unknown as PrismaService;
    const service = new H2HService(prismaMock);

    await expect(
      service.computeH2HScore({
        homeTeamId: 'home',
        awayTeamId: 'away',
        favoriteTeamId: 'home',
        fixtureDate: new Date('2026-03-03T00:00:00.000Z'),
      }),
    ).resolves.toBeNull();
  });

  it('returns ratio of favorite wins across last 5 H2H fixtures', async () => {
    const prismaMock = {
      client: {
        fixture: {
          findMany: vi.fn().mockResolvedValue([
            {
              homeTeamId: 'home',
              awayTeamId: 'away',
              homeScore: 2,
              awayScore: 1,
            },
            {
              homeTeamId: 'away',
              awayTeamId: 'home',
              homeScore: 0,
              awayScore: 1,
            },
            {
              homeTeamId: 'home',
              awayTeamId: 'away',
              homeScore: 1,
              awayScore: 1,
            },
            {
              homeTeamId: 'away',
              awayTeamId: 'home',
              homeScore: 2,
              awayScore: 0,
            },
            {
              homeTeamId: 'home',
              awayTeamId: 'away',
              homeScore: 3,
              awayScore: 0,
            },
          ]),
        },
      },
    } as unknown as PrismaService;
    const service = new H2HService(prismaMock);

    await expect(
      service.computeH2HScore({
        homeTeamId: 'home',
        awayTeamId: 'away',
        favoriteTeamId: 'home',
        fixtureDate: new Date('2026-03-03T00:00:00.000Z'),
      }),
    ).resolves.toBeCloseTo(3 / 5, 8);
  });
});
