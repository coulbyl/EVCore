import { describe, it, expect } from 'vitest';
import { buildChannelThresholdSweep } from './tuning.metrics';
import type { ChannelTuningRow } from './backtest.repository';

function row(partial: Partial<ChannelTuningRow>): ChannelTuningRow {
  return {
    competitionCode: 'XX',
    competitionName: 'Test League',
    homeScore: 0,
    awayScore: 0,
    probHome: 0.4,
    probDraw: 0.3,
    probAway: 0.3,
    probBttsYes: 0.5,
    oddsHome: 2.0,
    oddsDraw: 3.3,
    oddsAway: 3.5,
    oddsBttsYes: 1.9,
    ...partial,
  };
}

describe('buildChannelThresholdSweep — DOMINANT', () => {
  it('selects the argmax outcome and rises in selectivity with the threshold', () => {
    const rows: ChannelTuningRow[] = [
      // strong home pick, home wins → won at every threshold it clears
      row({
        probHome: 0.7,
        probDraw: 0.15,
        probAway: 0.15,
        homeScore: 2,
        awayScore: 0,
      }),
      // moderate home pick, home wins
      row({
        probHome: 0.55,
        probDraw: 0.25,
        probAway: 0.2,
        homeScore: 1,
        awayScore: 0,
      }),
      // weak pick below the lowest grid threshold → never selected
      row({
        probHome: 0.4,
        probDraw: 0.3,
        probAway: 0.3,
        homeScore: 0,
        awayScore: 1,
      }),
    ];
    const sweep = buildChannelThresholdSweep('DOMINANT', rows);
    expect(sweep.candidates).toBe(3);
    const at45 = sweep.points.find((p) => p.threshold === 0.45)!;
    const at65 = sweep.points.find((p) => p.threshold === 0.65)!;
    expect(at45.total).toBe(2); // 0.70 and 0.55 clear 0.45
    expect(at65.total).toBe(1); // only 0.70 clears 0.65
    expect(at65.hitRate).toBe(1);
  });

  it('drops fixtures that fail the dominance margin at any threshold', () => {
    // argmax 0.36 vs 0.34 second → margin 0.02 < 0.05 → excluded entirely
    const rows = [row({ probHome: 0.36, probDraw: 0.34, probAway: 0.3 })];
    const sweep = buildChannelThresholdSweep('DOMINANT', rows);
    expect(sweep.candidates).toBe(0);
  });
});

describe('buildChannelThresholdSweep — DRAW', () => {
  it('uses bookmaker implied probability (1/drawOdds) as the signal', () => {
    const rows: ChannelTuningRow[] = [
      // implied 1/3.0 = 0.333, draw happens
      row({ oddsDraw: 3.0, homeScore: 1, awayScore: 1 }),
      // implied 1/5.0 = 0.20, below grid → never selected
      row({ oddsDraw: 5.0, homeScore: 2, awayScore: 0 }),
    ];
    const sweep = buildChannelThresholdSweep('DRAW', rows);
    const at30 = sweep.points.find((p) => p.threshold === 0.3)!;
    expect(at30.total).toBe(1);
    expect(at30.won).toBe(1);
  });
});

describe('buildChannelThresholdSweep — BTTS', () => {
  it('wins when both teams score and skips fixtures missing BTTS odds', () => {
    const rows: ChannelTuningRow[] = [
      row({ probBttsYes: 0.66, oddsBttsYes: 1.8, homeScore: 2, awayScore: 1 }),
      row({ probBttsYes: 0.6, oddsBttsYes: null, homeScore: 1, awayScore: 1 }),
    ];
    const sweep = buildChannelThresholdSweep('BTTS', rows);
    expect(sweep.candidates).toBe(1); // second dropped (no odds)
    const at65 = sweep.points.find((p) => p.threshold === 0.65)!;
    expect(at65.total).toBe(1);
    expect(at65.won).toBe(1);
  });
});

describe('recommendation', () => {
  it('returns null when no threshold clears the promotion rule', () => {
    const rows = [row({ probHome: 0.46, probDraw: 0.27, probAway: 0.27 })];
    const sweep = buildChannelThresholdSweep('DOMINANT', rows);
    expect(sweep.recommended).toBeNull(); // far below minSample
  });
});
