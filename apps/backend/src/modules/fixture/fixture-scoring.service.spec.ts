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

  it('gives each reading the market probability, exact when its outcome group is complete', async () => {
    const withPair = {
      ...fixture,
      modelRuns: [
        {
          ...fixture.modelRuns[0],
          features: {
            ...fixture.modelRuns[0].features,
            evaluatedPicks: [
              ...fixture.modelRuns[0].features.evaluatedPicks,
              {
                market: 'BTTS',
                pick: 'NO',
                probability: 0.45,
                odds: 2.0,
                ev: -0.1,
                qualityScore: 0.2,
                status: 'rejected',
                rejectionReason: 'ev_below_threshold',
              },
              {
                market: 'TO_WIN_EITHER_HALF',
                pick: 'HOME',
                probability: 0.7,
                odds: 1.5,
                ev: 0.05,
                qualityScore: 0.3,
                status: 'rejected',
                rejectionReason: 'ev_below_threshold',
              },
            ],
          },
        },
      ],
    };
    const { service } = makeService(withPair);

    const picks = (await service.getFixtureSheet('fx-1'))?.modelRun
      ?.evaluatedPicks;

    // BTTS complet : 1/1,85 = 0,5405 ; 1/2,00 = 0,5 ; total 1,0405.
    expect(picks?.[0]?.marketProbability).toBe(0.5195);
    // Pas de groupe propre : marge par défaut (6 %).
    expect(picks?.[2]?.marketProbability).toBe(0.6289);
  });
});
