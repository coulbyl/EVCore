import { describe, it, expect } from 'vitest';
import {
  buildBttsNoSweep,
  buildChannelThresholdSweep,
  buildGoalsLineSweep,
  buildTeamTotalSweep,
} from './tuning.metrics';
import type { ChannelTuningRow } from './backtest.repository';

function row(partial: Partial<ChannelTuningRow>): ChannelTuningRow {
  return {
    competitionCode: 'XX',
    competitionName: 'Test League',
    homeScore: 0,
    awayScore: 0,
    homeHtScore: 0,
    awayHtScore: 0,
    probHome: 0.4,
    probDraw: 0.3,
    probAway: 0.3,
    probBttsYes: 0.5,
    probBttsNo: 0.5,
    probOver15: 0.7,
    probUnder15: 0.3,
    probOver25: 0.5,
    probUnder25: 0.5,
    probOver35: 0.3,
    probUnder35: 0.7,
    probOver45: 0.15,
    probUnder45: 0.85,
    probCleanSheetHome: 0.3,
    probCleanSheetAway: 0.2,
    probWinEitherHalfHome: 0.55,
    probWinEitherHalfAway: 0.45,
    probTeamTotalHome: null,
    probTeamTotalAway: null,
    oddsHome: 2.0,
    oddsDraw: 3.3,
    oddsAway: 3.5,
    oddsBttsYes: 1.9,
    oddsBttsNo: 1.9,
    oddsOver15: 1.4,
    oddsUnder15: 2.9,
    oddsOver25: 1.9,
    oddsUnder25: 2.0,
    oddsOver35: 2.8,
    oddsUnder35: 1.45,
    oddsOver45: 4.5,
    oddsUnder45: 1.2,
    oddsCleanSheetHome: 2.5,
    oddsCleanSheetAway: 3.5,
    oddsWinEitherHalfHome: 1.7,
    oddsWinEitherHalfAway: 2.1,
    oddsTeamTotalHome: null,
    oddsTeamTotalAway: null,
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

describe('buildChannelThresholdSweep — CLEAN_SHEET', () => {
  it('picks argmax(home, away) and wins when that side kept a clean sheet', () => {
    const rows: ChannelTuningRow[] = [
      // HOME argmax, away scores 0 → HOME clean sheet → won
      row({
        probCleanSheetHome: 0.62,
        probCleanSheetAway: 0.2,
        oddsCleanSheetHome: 2.1,
        homeScore: 2,
        awayScore: 0,
      }),
      // AWAY argmax, home scores 0 → AWAY clean sheet → won
      row({
        probCleanSheetHome: 0.2,
        probCleanSheetAway: 0.55,
        oddsCleanSheetAway: 3.2,
        homeScore: 0,
        awayScore: 1,
      }),
      // HOME argmax but away also scores → lost
      row({
        probCleanSheetHome: 0.6,
        probCleanSheetAway: 0.15,
        oddsCleanSheetHome: 2.0,
        homeScore: 2,
        awayScore: 1,
      }),
      // no odds on either side → dropped
      row({
        probCleanSheetHome: 0.7,
        probCleanSheetAway: 0.1,
        oddsCleanSheetHome: null,
        oddsCleanSheetAway: null,
        homeScore: 3,
        awayScore: 0,
      }),
    ];
    const sweep = buildChannelThresholdSweep('CLEAN_SHEET', rows);
    expect(sweep.candidates).toBe(3);
    const at55 = sweep.points.find((p) => p.threshold === 0.55)!;
    expect(at55.total).toBe(3); // 0.62, 0.6 and 0.55 all clear the 0.55 gate
    expect(at55.won).toBe(2); // first two win, the HOME-argmax-but-conceded one loses
  });
});

describe('buildChannelThresholdSweep — WIN_EITHER_HALF', () => {
  it('picks argmax(home, away) and wins when that side won at least one half', () => {
    const rows: ChannelTuningRow[] = [
      // HOME argmax, home led at HT → won
      row({
        probWinEitherHalfHome: 0.62,
        probWinEitherHalfAway: 0.4,
        oddsWinEitherHalfHome: 1.6,
        homeHtScore: 1,
        awayHtScore: 0,
        homeScore: 1,
        awayScore: 1,
      }),
      // HOME argmax, home never led either half → lost
      row({
        probWinEitherHalfHome: 0.6,
        probWinEitherHalfAway: 0.4,
        oddsWinEitherHalfHome: 1.7,
        homeHtScore: 0,
        awayHtScore: 1,
        homeScore: 1,
        awayScore: 2,
      }),
      // missing HT scores → dropped entirely
      row({
        probWinEitherHalfHome: 0.7,
        probWinEitherHalfAway: 0.3,
        oddsWinEitherHalfHome: 1.5,
        homeHtScore: null,
        awayHtScore: null,
        homeScore: 2,
        awayScore: 0,
      }),
    ];
    const sweep = buildChannelThresholdSweep('WIN_EITHER_HALF', rows);
    expect(sweep.candidates).toBe(2);
    const at60 = sweep.points.find((p) => p.threshold === 0.6)!;
    expect(at60.total).toBe(2);
    expect(at60.won).toBe(1);
  });
});

describe('buildBttsNoSweep', () => {
  it('wins when NOT both teams score, using the NO probability + odds', () => {
    const rows: ChannelTuningRow[] = [
      row({ probBttsNo: 0.66, oddsBttsNo: 1.9, homeScore: 1, awayScore: 0 }), // no BTTS → won
      row({ probBttsNo: 0.6, oddsBttsNo: 2.0, homeScore: 2, awayScore: 1 }), // both score → lost
      row({ probBttsNo: 0.7, oddsBttsNo: null, homeScore: 0, awayScore: 0 }), // no odds → dropped
    ];
    const sweep = buildBttsNoSweep(rows);
    expect(sweep.candidates).toBe(2); // third dropped (no odds)
    const at60 = sweep.points.find((p) => p.threshold === 0.6)!;
    expect(at60.total).toBe(2);
    expect(at60.won).toBe(1);
  });
});

describe('recommendation', () => {
  it('returns null when no threshold clears the promotion rule', () => {
    const rows = [row({ probHome: 0.46, probDraw: 0.27, probAway: 0.27 })];
    const sweep = buildChannelThresholdSweep('DOMINANT', rows);
    expect(sweep.recommended).toBeNull(); // far below minSample
  });
});

describe('buildGoalsLineSweep — OVER 2.5', () => {
  it('wins when total goals > 2 and skips fixtures missing OVER odds', () => {
    const rows: ChannelTuningRow[] = [
      row({ probOver25: 0.62, oddsOver25: 1.9, homeScore: 2, awayScore: 1 }), // 3 goals → won
      row({ probOver25: 0.6, oddsOver25: 1.95, homeScore: 1, awayScore: 1 }), // 2 goals → lost
      row({ probOver25: 0.7, oddsOver25: null, homeScore: 3, awayScore: 0 }), // no odds → dropped
    ];
    const sweep = buildGoalsLineSweep(2.5, 'OVER', rows);
    expect(sweep.side).toBe('OVER');
    expect(sweep.line).toBe(2.5);
    expect(sweep.candidates).toBe(2); // third dropped (no odds)
    const at60 = sweep.points.find((p) => p.threshold === 0.6)!;
    expect(at60.total).toBe(2);
    expect(at60.won).toBe(1);
  });
});

describe('buildGoalsLineSweep — UNDER 2.5', () => {
  it('wins when total goals < 3 using the UNDER odds and probability', () => {
    const rows: ChannelTuningRow[] = [
      row({ probUnder25: 0.6, oddsUnder25: 2.0, homeScore: 1, awayScore: 1 }), // 2 goals → won
      row({ probUnder25: 0.58, oddsUnder25: 2.1, homeScore: 2, awayScore: 2 }), // 4 goals → lost
    ];
    const sweep = buildGoalsLineSweep(2.5, 'UNDER', rows);
    expect(sweep.candidates).toBe(2);
    const at55 = sweep.points.find((p) => p.threshold === 0.55)!;
    expect(at55.total).toBe(2);
    expect(at55.won).toBe(1);
  });

  it('recommends an ROI-positive threshold (no hit-rate floor)', () => {
    // 25 fixtures, all UNDER wins at odds 2.0 → ROI +100%, sample clears min.
    const rows: ChannelTuningRow[] = Array.from({ length: 25 }, () =>
      row({ probUnder25: 0.6, oddsUnder25: 2.0, homeScore: 0, awayScore: 1 }),
    );
    const sweep = buildGoalsLineSweep(2.5, 'UNDER', rows);
    expect(sweep.recommended?.verdict).toBe('PASS');
    expect(sweep.recommended!.roi).toBeGreaterThan(0);
  });
});

describe('buildGoalsLineSweep — OVER 1.5 (non-default line)', () => {
  it('reads the 1.5-line prob/odds fields and wins when total goals > 1.5', () => {
    const rows: ChannelTuningRow[] = [
      row({ probOver15: 0.75, oddsOver15: 1.3, homeScore: 1, awayScore: 1 }), // 2 goals → won
      row({ probOver15: 0.7, oddsOver15: 1.35, homeScore: 0, awayScore: 1 }), // 1 goal → lost
      row({ probOver15: 0.8, oddsOver15: null, homeScore: 3, awayScore: 0 }), // no odds → dropped
    ];
    const sweep = buildGoalsLineSweep(1.5, 'OVER', rows);
    expect(sweep.side).toBe('OVER');
    expect(sweep.line).toBe(1.5);
    expect(sweep.candidates).toBe(2);
    const at70 = sweep.points.find((p) => p.threshold === 0.65)!;
    expect(at70.total).toBe(2);
    expect(at70.won).toBe(1);
  });
});

describe('buildTeamTotalSweep', () => {
  it('reads the team-specific pick map and wins when that team alone clears the line', () => {
    const rows: ChannelTuningRow[] = [
      // HOME scores 2 → OVER 1.5 (home) wins
      row({
        probTeamTotalHome: { OVER_1_5: 0.58 },
        oddsTeamTotalHome: { OVER_1_5: 1.8 },
        homeScore: 2,
        awayScore: 0,
      }),
      // HOME scores 1 → OVER 1.5 (home) loses
      row({
        probTeamTotalHome: { OVER_1_5: 0.55 },
        oddsTeamTotalHome: { OVER_1_5: 1.85 },
        homeScore: 1,
        awayScore: 3,
      }),
      // no odds for this pick → dropped
      row({
        probTeamTotalHome: { OVER_1_5: 0.6 },
        oddsTeamTotalHome: null,
        homeScore: 2,
        awayScore: 0,
      }),
    ];
    const sweep = buildTeamTotalSweep(
      { team: 'HOME', line: 1.5, side: 'OVER' },
      rows,
    );
    expect(sweep.team).toBe('HOME');
    expect(sweep.line).toBe(1.5);
    expect(sweep.candidates).toBe(2);
    const at55 = sweep.points.find((p) => p.threshold === 0.55)!;
    expect(at55.total).toBe(2);
    expect(at55.won).toBe(1);
  });

  it('keeps HOME and AWAY selections independent — an AWAY row never leaks into a HOME sweep', () => {
    const rows: ChannelTuningRow[] = [
      row({
        probTeamTotalAway: { UNDER_0_5: 0.7 },
        oddsTeamTotalAway: { UNDER_0_5: 1.4 },
        homeScore: 2,
        awayScore: 0,
      }),
    ];
    const sweep = buildTeamTotalSweep(
      { team: 'HOME', line: 0.5, side: 'UNDER' },
      rows,
    );
    expect(sweep.candidates).toBe(0);
  });
});
