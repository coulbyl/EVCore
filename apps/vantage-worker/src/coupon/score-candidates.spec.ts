import { describe, expect, it } from "vitest";
import { STRATEGY_CHANNEL } from "@evcore/analysis-core";
import {
  admissibleCandidates,
  reduceToLlmPool,
  scoreCandidates,
  type ScoredCandidate,
} from "./score-candidates";
import type { PoolCandidate } from "./pool-query";

const IDENTITY = { a: 1, b: 0, n: 0 };

function makeCandidate(overrides: Partial<PoolCandidate> = {}): PoolCandidate {
  return {
    fixtureId: "f1",
    homeTeam: "Home",
    awayTeam: "Away",
    competition: "Premier League",
    country: "England",
    scheduledAt: new Date("2026-09-06T15:00:00.000Z"),
    dayBucket: "2026-09-06",
    canal: STRATEGY_CHANNEL.DOMINANT,
    market: "ONE_X_TWO",
    pick: "HOME",
    probability: 0.6,
    legEV: 0.02,
    oddsSnapshot: 1.8,
    referenceOdds: 1.75,
    pMarketFair: 0.58,
    bookmakerMargin: 0.05,
    lambdaHome: 1.4,
    lambdaAway: 1.0,
    xg: 2.4,
    finalScore: 0.7,
    dataCoverage: 1,
    shadowConflict: false,
    offensiveBalance: "BALANCED",
    priorAnalysisCount: 3,
    isCorrect: null,
    pickSource: "STAKED",
    featureSnapshot: { competitionCode: "PL" },
    homeLogo: null,
    awayLogo: null,
    homeScore: null,
    awayScore: null,
    homeHtScore: null,
    awayHtScore: null,
    channelSelectionId: "sel1",
    modelRunId: "run1",
    ...overrides,
  };
}

describe("scoreCandidates", () => {
  it("calibrates probability under an identity curve (no change)", () => {
    const [scored] = scoreCandidates([makeCandidate({ probability: 0.66 })], {
      channelReliability: { DOMINANT: IDENTITY },
      pooledReliability: IDENTITY,
    });
    expect(scored?.calibratedProbability).toBeCloseTo(0.66, 10);
    expect(scored?.calibratedHitRate).toBe(scored?.calibratedProbability);
  });

  it("recomputes legEV on the calibrated probability, not the raw one", () => {
    const flattening = { a: 0.4, b: -0.3, n: 5000 };
    const [scored] = scoreCandidates(
      [makeCandidate({ canal: STRATEGY_CHANNEL.VALUE, probability: 0.8 })],
      {
        channelReliability: { VALUE: flattening },
        pooledReliability: IDENTITY,
      },
    );
    expect(scored?.calibratedProbability).toBeLessThan(0.8);
  });

  it("leaves legEV null when there is no real odds", () => {
    const [scored] = scoreCandidates(
      [makeCandidate({ oddsSnapshot: null })],
      { channelReliability: {}, pooledReliability: IDENTITY },
    );
    expect(scored?.legEV).toBeNull();
  });

  it("leaves edge null when pMarketFair is unavailable", () => {
    const [scored] = scoreCandidates([makeCandidate({ pMarketFair: null })], {
      channelReliability: {},
      pooledReliability: IDENTITY,
    });
    expect(scored?.edge).toBeNull();
  });
});

function score(overrides: Partial<PoolCandidate> = {}): ScoredCandidate {
  const [scored] = scoreCandidates([makeCandidate(overrides)], {
    channelReliability: {},
    pooledReliability: IDENTITY,
  });
  if (!scored) throw new Error("expected one scored candidate");
  return scored;
}

describe("admissibleCandidates", () => {
  it("drops a candidate with no real odds", () => {
    expect(admissibleCandidates([score({ oddsSnapshot: null })])).toEqual([]);
  });

  it("drops a leg priced below the product floor (MIN_LEG_ODDS)", () => {
    expect(admissibleCandidates([score({ oddsSnapshot: 1.1 })])).toEqual([]);
  });

  it("drops a TEAM_TOTAL leg above the odds ceiling", () => {
    expect(
      admissibleCandidates([
        score({ canal: STRATEGY_CHANNEL.TEAM_TOTAL, oddsSnapshot: 2.5 }),
      ]),
    ).toEqual([]);
  });

  it("keeps a well-formed candidate", () => {
    expect(admissibleCandidates([score()])).toHaveLength(1);
  });
});

describe("reduceToLlmPool", () => {
  it("merges the reliability and value rankings, deduplicated", () => {
    const anchor = score({
      fixtureId: "anchor",
      probability: 0.85,
      pMarketFair: 0.84, // low edge — reliability pick, not a value pick
    });
    const valuePick = score({
      fixtureId: "value",
      probability: 0.55,
      pMarketFair: 0.4, // high edge — value pick, not a reliability pick
    });
    const pool = reduceToLlmPool([anchor, valuePick], {
      reliabilityTopN: 1,
      valueTopN: 1,
    });
    expect(pool.map((c) => c.fixtureId).sort()).toEqual(["anchor", "value"]);
  });

  it("never returns the same (fixture, market, pick) twice", () => {
    const candidate = score({ fixtureId: "dup" });
    const pool = reduceToLlmPool([candidate], {
      reliabilityTopN: 5,
      valueTopN: 5,
    });
    expect(pool).toHaveLength(1);
  });

  it("caps each ranking at its own topN", () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      score({ fixtureId: `f${i}`, probability: 0.5 + i * 0.05 }),
    );
    const pool = reduceToLlmPool(candidates, {
      reliabilityTopN: 2,
      valueTopN: 0,
    });
    expect(pool).toHaveLength(2);
    // Highest calibrated probability first.
    expect(pool[0]?.fixtureId).toBe("f4");
    expect(pool[1]?.fixtureId).toBe("f3");
  });
});
