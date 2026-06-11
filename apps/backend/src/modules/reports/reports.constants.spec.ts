import { describe, it, expect } from 'vitest';
import { computeVerdict, PROMOTION_MIN_SAMPLE } from './reports.constants';
import type { SegmentComparison } from './reports.types';

function comparison(over: Partial<SegmentComparison>): SegmentComparison {
  return {
    sampleSize: PROMOTION_MIN_SAMPLE,
    baselineBrier: 0.25,
    correctedBrier: 0.25,
    baselineRoi: 0.0,
    correctedRoi: 0.0,
    ...over,
  };
}

describe('computeVerdict', () => {
  it('GO when Brier improves ≥5% and corrected ROI ≥ baseline', () => {
    const { verdict, brierImprovement } = computeVerdict(
      comparison({
        baselineBrier: 0.25,
        correctedBrier: 0.235, // 6% better
        baselineRoi: 0.02,
        correctedRoi: 0.05,
      }),
    );
    expect(verdict).toBe('GO');
    expect(brierImprovement).toBeCloseTo(0.06, 4);
  });

  it('WATCH when Brier improves but below the 5% bar', () => {
    expect(
      computeVerdict(
        comparison({ baselineBrier: 0.25, correctedBrier: 0.245 }), // 2%
      ).verdict,
    ).toBe('WATCH');
  });

  it('WATCH when Brier improves enough but corrected ROI falls below baseline', () => {
    expect(
      computeVerdict(
        comparison({
          baselineBrier: 0.25,
          correctedBrier: 0.235,
          baselineRoi: 0.05,
          correctedRoi: 0.01,
        }),
      ).verdict,
    ).toBe('WATCH');
  });

  it('NO_GO when corrected calibration is worse than baseline', () => {
    expect(
      computeVerdict(comparison({ baselineBrier: 0.24, correctedBrier: 0.26 }))
        .verdict,
    ).toBe('NO_GO');
  });

  it('INSUFFICIENT below the sample floor', () => {
    expect(
      computeVerdict(comparison({ sampleSize: PROMOTION_MIN_SAMPLE - 1 }))
        .verdict,
    ).toBe('INSUFFICIENT');
  });

  it('INSUFFICIENT when baseline Brier is zero (no usable data)', () => {
    expect(computeVerdict(comparison({ baselineBrier: 0 })).verdict).toBe(
      'INSUFFICIENT',
    );
  });

  it('does not GO when corrected ROI is null (no pick clears the policy gate)', () => {
    expect(
      computeVerdict(
        comparison({
          baselineBrier: 0.25,
          correctedBrier: 0.235,
          correctedRoi: null,
        }),
      ).verdict,
    ).toBe('WATCH');
  });
});
