import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@/prisma.service';
import { FixtureScoringService } from './fixture-scoring.service';

function makeService(fixture: unknown) {
  const findUnique = vi.fn().mockResolvedValue(fixture);
  const prisma = {
    client: { fixture: { findUnique } },
  } as unknown as PrismaService;
  return { service: new FixtureScoringService(prisma), findUnique };
}

const fixture = {
  id: 'fx-1',
  scheduledAt: new Date('2026-10-27T19:00:00Z'),
  status: 'SCHEDULED',
  homeScore: null,
  awayScore: null,
  homeHtScore: null,
  awayHtScore: null,
  homeTeam: { name: 'Arsenal', logoUrl: null },
  awayTeam: { name: 'Burnley', logoUrl: null },
  season: { competition: { name: 'Premier League', country: 'England' } },
  modelRuns: [
    {
      id: 'run-1',
      analyzedAt: new Date('2026-10-27T08:00:00Z'),
      features: {
        lambdaHome: 1.62,
        lambdaAway: 0.94,
        evaluatedPicks: [
          {
            market: 'BTTS',
            pick: 'YES',
            probability: 0.55,
            odds: 1.85,
            ev: 0.018,
            qualityScore: 0.31,
            status: 'rejected',
            rejectionReason: 'probability_too_low',
          },
        ],
      },
    },
  ],
};

describe('FixtureScoringService.getFixtureSheet', () => {
  it('returns null for an unknown fixture', async () => {
    const { service } = makeService(null);
    await expect(service.getFixtureSheet('nope')).resolves.toBeNull();
  });

  it('returns the teams, country and every evaluated reading, without bet-table fields', async () => {
    const { service } = makeService(fixture);

    const sheet = await service.getFixtureSheet('fx-1');

    expect(sheet).toMatchObject({
      fixtureId: 'fx-1',
      homeTeam: 'Arsenal',
      awayTeam: 'Burnley',
      country: 'England',
      competition: 'Premier League',
    });
    expect(sheet?.modelRun?.evaluatedPicks).toHaveLength(1);
    expect(sheet?.modelRun).not.toHaveProperty('ev');
    expect(sheet?.modelRun).not.toHaveProperty('betId');
    expect(sheet).not.toHaveProperty('safeValueBet');
  });
});
