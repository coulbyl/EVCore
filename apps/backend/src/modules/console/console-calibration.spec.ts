import { describe, expect, it } from 'vitest';
import { cellOf } from './console-calibration';

const cell = (over: Partial<Parameters<typeof cellOf>[0]>) =>
  cellOf({
    channel: 'DOUBLE_CHANCE',
    competitionCode: 'BL1',
    competitionName: 'Bundesliga',
    sample: 200,
    announced: 0.8,
    realised: 0.8,
    enough: true,
    ...over,
  });

describe('cellOf', () => {
  it('ratio and its interval on the realised rate', () => {
    const c = cell({ realised: 0.72 });
    expect(c.ratio).toBeCloseTo(0.9);
    expect(c.low).toBeLessThan(0.9);
    expect(c.high).toBeGreaterThan(0.9);
    expect(c.word).toBe('conforme');
  });

  it('below 0,85 but the interval reaches it: optimistic, not an alert', () => {
    expect(cell({ sample: 40, realised: 0.62 }).word).toBe('optimistic');
  });

  it('even the interval top under 0,85: the loss is established', () => {
    expect(cell({ sample: 400, realised: 0.6 }).word).toBe('alert');
  });

  it('too few legs: no ratio, no word but « pas assez de recul »', () => {
    expect(cell({ enough: false })).toMatchObject({
      ratio: null,
      word: 'not_enough',
    });
  });
});
