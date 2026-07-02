import { describe, expect, it, vi } from 'vitest';
import {
  ShadowPredictionsService,
  hasDirectionalConflict,
} from './shadow-predictions.service';
import type { ApiFootballClient } from '../etl/api-football.client';

function buildService(body: unknown, status = 200) {
  const apiFootball = {
    fetchJson: vi.fn().mockResolvedValue({ response: { status, body } }),
  } as unknown as ApiFootballClient;
  return new ShadowPredictionsService(apiFootball);
}

const validBody = {
  response: [
    {
      predictions: {
        winner: { name: 'Argentina' },
        percent: { home: '50%', draw: '50%', away: '0%' },
      },
      comparison: {
        poisson_distribution: { home: '100%', away: '0%' },
        total: { home: '74.0%', away: '26.0%' },
      },
    },
  ],
};

describe('ShadowPredictionsService.fetchShadowPrediction', () => {
  it('parses percent strings into numbers', async () => {
    const service = buildService(validBody);
    const prediction = await service.fetchShadowPrediction(1565179);
    expect(prediction).toEqual({
      winnerName: 'Argentina',
      percent: { home: 50, draw: 50, away: 0 },
      poisson: { home: 100, away: 0 },
    });
  });

  it('returns null on HTTP error, Zod failure, or empty response', async () => {
    expect(await buildService({}, 500).fetchShadowPrediction(1)).toBeNull();
    expect(
      await buildService({ response: [{ bad: true }] }).fetchShadowPrediction(
        1,
      ),
    ).toBeNull();
    expect(
      await buildService({ response: [] }).fetchShadowPrediction(1),
    ).toBeNull();
  });

  it('returns null when the client throws (never breaks the analysis)', async () => {
    const apiFootball = {
      fetchJson: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as ApiFootballClient;
    const service = new ShadowPredictionsService(apiFootball);
    expect(await service.fetchShadowPrediction(1)).toBeNull();
  });
});

describe('hasDirectionalConflict', () => {
  const prediction = {
    winnerName: 'Argentina',
    percent: { home: 50, draw: 50, away: 0 },
    poisson: { home: 100, away: 0 },
  };

  it('flags the Argentina case: their Poisson favors home, our λ favors away', () => {
    expect(
      hasDirectionalConflict(prediction, { home: 0.41, away: 0.56 }),
    ).toBe(true);
  });

  it('stays silent when both models point the same way', () => {
    expect(hasDirectionalConflict(prediction, { home: 2.1, away: 0.4 })).toBe(
      false,
    );
  });

  it('stays silent when either side is neutral', () => {
    expect(hasDirectionalConflict(prediction, { home: 1.2, away: 1.2 })).toBe(
      false,
    );
  });
});
