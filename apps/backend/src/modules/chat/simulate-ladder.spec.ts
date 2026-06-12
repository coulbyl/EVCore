import { describe, expect, it } from 'vitest';
import { simulateLadder } from './simulate-ladder';

describe('simulateLadder', () => {
  it('computes ladder progression with decimal arithmetic', () => {
    const result = simulateLadder({
      stake: '100000',
      steps: [
        { combinedOdds: '3.27', jointProbability: '0.39' },
        { combinedOdds: '4.05', jointProbability: '0.28' },
        { combinedOdds: '3.22', jointProbability: '0.48' },
      ],
    });

    expect(result.initialStake).toBe('100000.00');
    expect(result.finalPotentialReturn).toBe('4264407.00');
    expect(result.cumulativeProbability).toBe('0.052416');
    expect(result.loseProbability).toBe('0.947584');
    expect(result.expectedValue).toBe('123523.16');
    expect(result.steps).toMatchObject([
      {
        index: 1,
        stake: '100000.00',
        potentialReturn: '327000.00',
        cumulativeProbability: '0.39',
      },
      {
        index: 2,
        stake: '327000.00',
        potentialReturn: '1324350.00',
        cumulativeProbability: '0.1092',
      },
      {
        index: 3,
        stake: '1324350.00',
        potentialReturn: '4264407.00',
        cumulativeProbability: '0.052416',
      },
    ]);
  });
});
