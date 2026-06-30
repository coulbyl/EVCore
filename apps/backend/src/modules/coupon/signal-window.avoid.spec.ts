import { describe, it, expect } from 'vitest';
import { isExtremeDivergence } from './signal-window.service';
import { AVOID_CONFIG } from '@modules/betting-engine/strategies/channel-strategy.config';

// AVOID enforcement at staking time — drops legs whose model edge over the
// market (probability − 1/odds) reaches AVOID_CONFIG.maxEdge. Mirrors the AVOID
// channel's threshold so detection (channel) and enforcement (pool) stay in sync.
describe('isExtremeDivergence', () => {
  it('keeps legs with a normal edge', () => {
    // 0.60 − 1/1.90 ≈ 0.074 < maxEdge
    expect(isExtremeDivergence(0.6, 1.9)).toBe(false);
  });

  it('drops legs above maxEdge', () => {
    // 0.72 − 1/2.50 = 0.32 > maxEdge → dropped
    expect(isExtremeDivergence(0.72, 2.5)).toBe(true);
    expect(AVOID_CONFIG.maxEdge).toBe(0.3);
  });

  it('keeps legs just under maxEdge', () => {
    // 0.69 − 1/2.50 = 0.29 < maxEdge → kept
    expect(isExtremeDivergence(0.69, 2.5)).toBe(false);
  });

  it('drops clearly implausible divergence', () => {
    // 0.90 − 1/2.50 = 0.50
    expect(isExtremeDivergence(0.9, 2.5)).toBe(true);
  });

  it('is safe when odds are missing or invalid', () => {
    expect(isExtremeDivergence(0.9, null)).toBe(false);
    expect(isExtremeDivergence(0.9, 1)).toBe(false);
  });
});
