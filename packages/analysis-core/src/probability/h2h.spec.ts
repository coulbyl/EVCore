import { describe, it, expect } from "vitest";
import {
  computeH2HScoreFromLegs,
  computeH2HMarketSignalsFromLegs,
  computeH2HScorelineSignalFromLegs,
  H2H_MIN_SAMPLE,
  type H2HLeg,
} from "./h2h";

// Regression coverage for the H2H math moved here 2026-08-18 from
// H2HService — the live engine and the backtest harness must produce
// byte-identical signals from the same legs.

const HOME = "home-team";
const AWAY = "away-team";

function leg(homeScore: number, awayScore: number): H2HLeg {
  return { homeTeamId: HOME, awayTeamId: AWAY, homeScore, awayScore };
}

describe("computeH2HScoreFromLegs", () => {
  it("returns null below H2H_MIN_SAMPLE legs", () => {
    const legs = Array.from({ length: H2H_MIN_SAMPLE - 1 }, () => leg(1, 0));
    expect(computeH2HScoreFromLegs(legs, HOME)).toBeNull();
  });

  it("scores 1.0 when the favourite has won every leg", () => {
    const legs = [leg(2, 0), leg(1, 0), leg(3, 1)];
    expect(computeH2HScoreFromLegs(legs, HOME)).toBe(1);
  });

  it("scores 0.5 on a leg the favourite drew (H2H_DRAW_SCORE)", () => {
    const legs = [leg(1, 1), leg(1, 1), leg(1, 1)];
    expect(computeH2HScoreFromLegs(legs, HOME)).toBe(0.5);
  });

  it("weights more recent legs (index 0) heavier via decay", () => {
    // Same 2 wins / 1 loss in both — only the POSITION of the loss differs,
    // isolating the recency effect from the raw win count.
    const lossIsOldest = [leg(2, 0), leg(2, 0), leg(0, 2)];
    const lossIsMostRecent = [leg(0, 2), leg(2, 0), leg(2, 0)];
    expect(computeH2HScoreFromLegs(lossIsOldest, HOME)!).toBeGreaterThan(
      computeH2HScoreFromLegs(lossIsMostRecent, HOME)!,
    );
  });
});

describe("computeH2HMarketSignalsFromLegs", () => {
  it("returns all-null signals below H2H_MIN_SAMPLE, with the real sample size", () => {
    const legs = [leg(1, 1)];
    const result = computeH2HMarketSignalsFromLegs(legs, {
      homeTeamId: HOME,
      awayTeamId: AWAY,
    });
    expect(result).toEqual({
      btts: null,
      over25: null,
      cleanSheetHome: null,
      cleanSheetAway: null,
      winToNilHome: null,
      winToNilAway: null,
      sampleSize: 1,
    });
  });

  it("computes BTTS/over2.5/clean-sheet/win-to-nil rates from settled legs", () => {
    // 3 legs, all BTTS + over 2.5, home team wins to nil in none of them.
    const legs = [leg(2, 1), leg(1, 2), leg(3, 1)];
    const result = computeH2HMarketSignalsFromLegs(legs, {
      homeTeamId: HOME,
      awayTeamId: AWAY,
    });
    expect(result.btts).toBe(1);
    expect(result.over25).toBe(1);
    expect(result.winToNilHome).toBe(0);
    expect(result.sampleSize).toBe(3);
  });
});

describe("computeH2HScorelineSignalFromLegs", () => {
  it("returns null below H2H_MIN_SAMPLE legs", () => {
    const legs = [leg(2, 1)];
    expect(
      computeH2HScorelineSignalFromLegs(legs, { homeTeamId: HOME }),
    ).toEqual({ scoreline: null, confidence: null, sampleSize: 1 });
  });

  it("orients past legs to the target fixture's home/away sides", () => {
    // Two legs where AWAY played at home and won 2-1 — oriented to today's
    // fixture (HOME at home), that's a 1-2 scoreline, not 2-1.
    const legs: H2HLeg[] = [
      { homeTeamId: AWAY, awayTeamId: HOME, homeScore: 2, awayScore: 1 },
      { homeTeamId: AWAY, awayTeamId: HOME, homeScore: 2, awayScore: 1 },
      { homeTeamId: AWAY, awayTeamId: HOME, homeScore: 2, awayScore: 1 },
    ];
    const result = computeH2HScorelineSignalFromLegs(legs, {
      homeTeamId: HOME,
    });
    expect(result.scoreline).toBe("1:2");
    expect(result.confidence).toBe(1);
    expect(result.sampleSize).toBe(3);
  });

  it("picks the most heavily-weighted scoreline among several", () => {
    const legs = [leg(1, 0), leg(1, 0), leg(0, 0)];
    const result = computeH2HScorelineSignalFromLegs(legs, {
      homeTeamId: HOME,
    });
    expect(result.scoreline).toBe("1:0");
  });
});
