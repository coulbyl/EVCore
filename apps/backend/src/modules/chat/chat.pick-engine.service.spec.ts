import { describe, expect, it, vi } from 'vitest';
import type {
  ScoredPick,
  SignalWindowService,
} from '@modules/coupon/signal-window.service';
import type { CouponComposerService } from '@modules/coupon/coupon-composer.service';
import { ChatPickEngineService } from './chat.pick-engine.service';

const inOneHour = () => new Date(Date.now() + 3_600_000);
const inTwoHours = () => new Date(Date.now() + 7_200_000);

function buildPick(overrides: Partial<ScoredPick>): ScoredPick {
  return {
    fixtureId: 'fixture-1',
    homeTeam: 'Team A',
    awayTeam: 'Team B',
    competition: 'PL',
    country: 'England',
    scheduledAt: inOneHour(),
    canal: 'SAFE',
    market: 'OVER_UNDER',
    pick: 'UNDER',
    probability: 0.7,
    calibratedHitRate: 0.7,
    oddsSnapshot: 1.5,
    signalScore: 0.5,
    ...overrides,
  } as ScoredPick;
}

function buildService(pool: ScoredPick[]): ChatPickEngineService {
  const signalWindow = {
    computeSignalWindow: vi.fn().mockResolvedValue({}),
    getTodayPool: vi.fn().mockResolvedValue(pool),
  } as unknown as SignalWindowService;
  const composer = {
    scorePicks: vi.fn().mockImplementation((picks: ScoredPick[]) => picks),
  } as unknown as CouponComposerService;
  return new ChatPickEngineService(signalWindow, composer);
}

describe('ChatPickEngineService.planLadder', () => {
  it('selects one pick per fixture and orders steps by kickoff', async () => {
    const service = buildService([
      // Best pick of fixture-1, late kickoff.
      buildPick({
        fixtureId: 'fixture-1',
        probability: 0.9,
        calibratedHitRate: 0.9,
        scheduledAt: inTwoHours(),
        oddsSnapshot: 1.5,
      }),
      // Same fixture, weaker — must be deduplicated.
      buildPick({
        fixtureId: 'fixture-1',
        probability: 0.6,
        calibratedHitRate: 0.6,
        scheduledAt: inTwoHours(),
      }),
      // Other fixture, earlier kickoff — must come first in the ladder.
      buildPick({
        fixtureId: 'fixture-2',
        homeTeam: 'Team C',
        awayTeam: 'Team D',
        probability: 0.8,
        calibratedHitRate: 0.8,
        scheduledAt: inOneHour(),
        oddsSnapshot: 2,
      }),
    ]);

    const result = await service.planLadder({ stake: '1000', steps: 2 });

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.picks.map((pick) => pick.fixtureId)).toEqual([
      'fixture-2',
      'fixture-1',
    ]);
    expect(result.simulation.steps).toHaveLength(2);
    // 1000 × 2 × 1.5 — computed with decimal.js by simulateLadder.
    expect(result.simulation.finalPotentialReturn).toBe('3000.00');
  });

  it('returns an error when no pick has odds', async () => {
    const service = buildService([buildPick({ oddsSnapshot: null })]);

    const result = await service.planLadder({ stake: '1000', steps: 3 });

    expect('error' in result).toBe(true);
  });

  it('filters on the requested canal', async () => {
    const service = buildService([
      buildPick({ fixtureId: 'fixture-1', canal: 'VALUE' }),
      buildPick({ fixtureId: 'fixture-2', canal: 'SAFE' }),
    ]);

    const result = await service.planLadder({
      stake: '500',
      steps: 3,
      canal: 'SAFE',
    });

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.availableSteps).toBe(1);
    expect(result.picks[0]?.fixtureId).toBe('fixture-2');
  });
});
