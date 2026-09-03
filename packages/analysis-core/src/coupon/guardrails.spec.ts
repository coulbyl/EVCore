import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  calibratedLegProbability,
  calibrateLegProbability,
  clearsMaxLegEdge,
  clearsMinLegOdds,
  clearsTeamTotalMaxOdds,
  clearsValueEdgeFloor,
  depthRank,
  LEG_PROBABILITY_MODEL_WEIGHT,
} from "./guardrails";

// Same values as guardrails.ts's own CALIBRATED_PROBABILITY_CAP_MIN/MAX and
// TEAM_TOTAL_MAX_ODDS (not exported — these are the two callers' only
// readers, so the test asserts against the literal values directly rather
// than importing private constants).
const CALIBRATED_PROBABILITY_CAP_MIN = 0.05;
const CALIBRATED_PROBABILITY_CAP_MAX = 0.8;
const TEAM_TOTAL_MAX_ODDS = 2.3;

describe("calibratedLegProbability", () => {
  it("blends model probability and canal calibrated rate", () => {
    const value = calibratedLegProbability({
      probability: 0.8,
      calibratedHitRate: 0.6,
    });
    expect(value).toBeCloseTo(
      0.8 * LEG_PROBABILITY_MODEL_WEIGHT +
        0.6 * (1 - LEG_PROBABILITY_MODEL_WEIGHT),
      10,
    );
  });
});

describe("calibrateLegProbability", () => {
  const identity = { a: 1, b: 0, n: 0 };
  // Slope < 1 flattens an over-confident channel toward its base rate — the
  // shape every channel measured on 2026-08-22 actually needs.
  const flattening = { a: 0.4, b: -0.3, n: 5000 };

  const makeWindow = (byChannel: Record<string, typeof identity>) => ({
    channelReliability: byChannel,
    pooledReliability: flattening,
  });

  it("leaves a probability untouched under an identity curve", () => {
    const value = calibrateLegProbability(
      { probability: 0.66, canal: "DRAW" },
      makeWindow({ DRAW: identity }),
    );
    expect(value).toBeCloseTo(0.66, 10);
  });

  it("applies the leg own channel curve, not another channel curve", () => {
    const window = makeWindow({ DRAW: identity, VALUE: flattening });
    const drawValue = calibrateLegProbability(
      { probability: 0.8, canal: "DRAW" },
      window,
    );
    const valueValue = calibrateLegProbability(
      { probability: 0.8, canal: "VALUE" },
      window,
    );
    expect(drawValue).toBeCloseTo(0.8, 10);
    expect(valueValue).toBeLessThan(0.8);
  });

  it("pulls an over-confident probability down and a low one up (flatter slope)", () => {
    const window = makeWindow({ VALUE: flattening });
    expect(
      calibrateLegProbability({ probability: 0.85, canal: "VALUE" }, window),
    ).toBeLessThan(0.85);
    expect(
      calibrateLegProbability({ probability: 0.15, canal: "VALUE" }, window),
    ).toBeGreaterThan(0.15);
  });

  it("falls back to the pooled curve for a channel with no fit of its own", () => {
    const window = makeWindow({ DRAW: identity });
    const unknown = calibrateLegProbability(
      { probability: 0.8, canal: "HALF_TIME_FULL_TIME" },
      window,
    );
    const pooled = calibrateLegProbability(
      { probability: 0.8, canal: "VALUE" },
      makeWindow({ VALUE: flattening }),
    );
    expect(unknown).toBeCloseTo(pooled, 10);
  });

  it("clamps the calibrated probability into [capMin, capMax]", () => {
    const extreme = { a: 5, b: 6, n: 5000 };
    const value = calibrateLegProbability(
      { probability: 0.99, canal: "DRAW" },
      makeWindow({ DRAW: extreme }),
    );
    expect(value).toBeLessThanOrEqual(CALIBRATED_PROBABILITY_CAP_MAX);
    expect(value).toBeGreaterThanOrEqual(CALIBRATED_PROBABILITY_CAP_MIN);
  });
});

describe("clearsValueEdgeFloor", () => {
  const getMinEdge = () => new Decimal("0.10");

  it("never gates non-VALUE canals", () => {
    const leg = {
      canal: "SAFE",
      calibratedProbability: null,
      oddsSnapshot: null,
      featureSnapshot: {},
    };
    expect(clearsValueEdgeFloor(leg, getMinEdge)).toBe(true);
  });

  it("rejects a VALUE leg without a calibrated probability or odds", () => {
    const leg = {
      canal: "VALUE",
      calibratedProbability: null,
      oddsSnapshot: 2.5,
      featureSnapshot: {},
    };
    expect(clearsValueEdgeFloor(leg, getMinEdge)).toBe(false);
  });

  it("rejects a VALUE leg below the edge floor", () => {
    const leg = {
      canal: "VALUE",
      calibratedProbability: 0.55, // 1/odds = 0.5 → edge = 0.05 < 0.10
      oddsSnapshot: 2.0,
      featureSnapshot: {},
    };
    expect(clearsValueEdgeFloor(leg, getMinEdge)).toBe(false);
  });

  it("accepts a VALUE leg at or above the edge floor", () => {
    const leg = {
      canal: "VALUE",
      calibratedProbability: 0.65, // 1/odds = 0.5 → edge = 0.15 ≥ 0.10
      oddsSnapshot: 2.0,
      featureSnapshot: {},
    };
    expect(clearsValueEdgeFloor(leg, getMinEdge)).toBe(true);
  });

  it("uses the per-league override (e.g. a suspended league) over the default floor", () => {
    const leg = {
      canal: "VALUE",
      calibratedProbability: 0.65,
      oddsSnapshot: 2.0,
      featureSnapshot: { competitionCode: "FRI" },
    };
    const getSuspended = (code: string | null) =>
      code === "FRI" ? new Decimal("1") : undefined;
    expect(clearsValueEdgeFloor(leg, getSuspended)).toBe(false);
  });
});

describe("clearsTeamTotalMaxOdds", () => {
  it("never gates non-TEAM_TOTAL canals, however long the odds", () => {
    const leg = { canal: "SAFE", oddsSnapshot: 50.0 };
    expect(clearsTeamTotalMaxOdds(leg)).toBe(true);
  });

  it("rejects a TEAM_TOTAL leg without odds", () => {
    const leg = { canal: "TEAM_TOTAL", oddsSnapshot: null };
    expect(clearsTeamTotalMaxOdds(leg)).toBe(false);
  });

  it("rejects a TEAM_TOTAL leg at or above the odds ceiling (measured: 21.4% real vs 59.4% announced above it)", () => {
    const leg = { canal: "TEAM_TOTAL", oddsSnapshot: TEAM_TOTAL_MAX_ODDS };
    expect(clearsTeamTotalMaxOdds(leg)).toBe(false);
  });

  it("accepts a TEAM_TOTAL leg below the odds ceiling", () => {
    const leg = { canal: "TEAM_TOTAL", oddsSnapshot: 1.8 };
    expect(clearsTeamTotalMaxOdds(leg)).toBe(true);
  });
});

describe("depthRank", () => {
  it("ranks BALANCED offensiveBalance above unknown above ASYMMETRIC above STRONGLY_ASYMMETRIC", () => {
    const base = { shadowConflict: null, priorAnalysisCount: 0 };
    const balanced = depthRank({ ...base, offensiveBalance: "BALANCED" });
    const unknown = depthRank({ ...base, offensiveBalance: null });
    const asymmetric = depthRank({ ...base, offensiveBalance: "ASYMMETRIC" });
    const stronglyAsymmetric = depthRank({
      ...base,
      offensiveBalance: "STRONGLY_ASYMMETRIC",
    });
    expect(balanced).toBeGreaterThan(unknown);
    expect(unknown).toBeGreaterThan(asymmetric);
    expect(asymmetric).toBeGreaterThan(stronglyAsymmetric);
  });

  it("ranks no shadow conflict above unknown above conflict", () => {
    const base = { offensiveBalance: null, priorAnalysisCount: 0 };
    const noConflict = depthRank({ ...base, shadowConflict: false });
    const unknown = depthRank({ ...base, shadowConflict: null });
    const conflict = depthRank({ ...base, shadowConflict: true });
    expect(noConflict).toBeGreaterThan(unknown);
    expect(unknown).toBeGreaterThan(conflict);
  });

  it("prefers a higher priorAnalysisCount as a minor tie-break", () => {
    const base = { offensiveBalance: null, shadowConflict: null };
    const more = depthRank({ ...base, priorAnalysisCount: 5 });
    const fewer = depthRank({ ...base, priorAnalysisCount: 0 });
    expect(more).toBeGreaterThan(fewer);
    // Capped — priorAnalysisCount alone must never outweigh offensiveBalance
    // or shadowConflict, only break ties within the same tier.
    const manyAnalysesButAsymmetric = depthRank({
      offensiveBalance: "ASYMMETRIC",
      shadowConflict: null,
      priorAnalysisCount: 100,
    });
    const noAnalysesButBalanced = depthRank({
      offensiveBalance: "BALANCED",
      shadowConflict: null,
      priorAnalysisCount: 0,
    });
    expect(noAnalysesButBalanced).toBeGreaterThan(manyAnalysesButAsymmetric);
  });
});

describe("clearsMaxLegEdge", () => {
  const leg = (probability: number, oddsSnapshot: number | null) => ({
    calibratedProbability: probability,
    probability,
    calibratedHitRate: probability,
    oddsSnapshot,
  });

  it("accepts a leg whose model↔market divergence stays inside the measured band", () => {
    expect(clearsMaxLegEdge(leg(0.55, 2.0))).toBe(true); // edge 0.05
  });

  it("rejects a leg claiming more edge than the model has been measured to have", () => {
    // edge 0.30 — la tranche qui ne réalise que 0.537 de ce qu'elle annonce
    expect(clearsMaxLegEdge(leg(0.7, 2.5))).toBe(false);
  });

  it("accepts a leg the model prices BELOW the market (negative edge)", () => {
    // ratio 1.062 dans cette zone : le modèle y est sous-confiant
    expect(clearsMaxLegEdge(leg(0.4, 2.0))).toBe(true);
  });

  it("rejects a leg with no real odds — edge is undefined without a price", () => {
    expect(clearsMaxLegEdge(leg(0.6, null))).toBe(false);
  });

  // Le point critique du passage au meilleur prix : miser plus cher ne doit
  // pas relâcher le plafond de divergence. Même jambe, prix de mise amélioré
  // de 2.0 à 2.6 — l'edge mesuré ne bouge pas, parce qu'il se calcule sur la
  // cote de référence.
  it("measures the edge on the reference odds, not on the improved stake price", () => {
    const improved = {
      calibratedProbability: 0.55,
      probability: 0.55,
      calibratedHitRate: 0.55,
      oddsSnapshot: 2.6, // meilleur prix : 0.55 - 1/2.6 = 0.165 > MAX_LEG_EDGE
      referenceOdds: 2.0, // référence   : 0.55 - 1/2.0 = 0.05  <= MAX_LEG_EDGE
    };
    expect(clearsMaxLegEdge(improved)).toBe(true);

    const genuinelyDivergent = { ...improved, referenceOdds: 2.6 };
    expect(clearsMaxLegEdge(genuinelyDivergent)).toBe(false);
  });
});

describe("clearsMinLegOdds", () => {
  it("rejects a leg priced below the product floor", () => {
    // Le cas réel du 2026-08-22 : une jambe à 1.04 dans un coupon à 1.30.
    expect(clearsMinLegOdds({ oddsSnapshot: 1.04 })).toBe(false);
    expect(clearsMinLegOdds({ oddsSnapshot: 1.19 })).toBe(false);
  });

  it("accepts a leg at or above the floor", () => {
    expect(clearsMinLegOdds({ oddsSnapshot: 1.2 })).toBe(true);
    expect(clearsMinLegOdds({ oddsSnapshot: 2.4 })).toBe(true);
  });

  it("rejects a leg with no real odds", () => {
    expect(clearsMinLegOdds({ oddsSnapshot: null })).toBe(false);
  });

  // Ce qui différencie les classes : chacune n'admet que sa bande de cote, et
  // les bandes sont disjointes — un même pick ne peut donc jamais apparaître
  // dans deux classes.
  it("confines a leg to its class band, exclusive at the upper bound", () => {
    const safe = { minLegOdds: 1.2, maxLegOdds: 1.6 };
    const balanced = { minLegOdds: 1.6, maxLegOdds: 2.3 };

    expect(clearsMinLegOdds({ oddsSnapshot: 1.45 }, safe)).toBe(true);
    expect(clearsMinLegOdds({ oddsSnapshot: 1.45 }, balanced)).toBe(false);

    // 1.60 appartient à BALANCED, pas à SAFE — borne haute exclusive, sans
    // quoi les bandes se chevaucheraient d'un pick.
    expect(clearsMinLegOdds({ oddsSnapshot: 1.6 }, safe)).toBe(false);
    expect(clearsMinLegOdds({ oddsSnapshot: 1.6 }, balanced)).toBe(true);
  });
});
