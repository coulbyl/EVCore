import { describe, it, expect } from 'vitest';
import {
  brierScoreOneXTwo,
  calibrationError,
  getOneXTwoOutcome,
} from './backtest.report';

describe('getOneXTwoOutcome', () => {
  it('maps scorelines to HOME/DRAW/AWAY', () => {
    expect(getOneXTwoOutcome(2, 1)).toBe('HOME');
    expect(getOneXTwoOutcome(1, 1)).toBe('DRAW');
    expect(getOneXTwoOutcome(0, 3)).toBe('AWAY');
  });
});

describe('brierScoreOneXTwo', () => {
  it('returns 0 for a perfect forecast', () => {
    const score = brierScoreOneXTwo([
      { home: 1, draw: 0, away: 0, actual: 'HOME' },
    ]);
    expect(score).toBe(0);
  });

  it('computes multiclass brier score per fixture', () => {
    const score = brierScoreOneXTwo([
      { home: 0.6, draw: 0.2, away: 0.2, actual: 'HOME' },
      { home: 0.3, draw: 0.4, away: 0.3, actual: 'DRAW' },
    ]);
    expect(score).toBeCloseTo(0.39, 6);
  });
});

describe('calibrationError', () => {
  it('returns 0 for perfectly calibrated points in each bucket', () => {
    const score = calibrationError([
      { prob: 0.2, actual: 0 },
      { prob: 0.8, actual: 1 },
    ]);
    expect(score).toBeCloseTo(0.2, 6);
  });

  it('returns 0 with empty input', () => {
    expect(calibrationError([])).toBe(0);
  });
});
