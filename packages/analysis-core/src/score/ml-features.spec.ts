// Anti-drift guard (docs/ml-worker-sync.md §"garde-fou"): ml-features.ts (TS
// producer) and extract.py (Python consumer, apps/ml-worker) must classify
// competition codes identically. ml-shadow-contract.json is the single
// source of truth both sides are tested against — see the matching Python
// test in apps/ml-worker/tests/test_ml_shadow_contract.py.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildMlShadowFeatures } from "./ml-features";
import type { DeterministicFeatures } from "./deterministic-score";
import Decimal from "decimal.js";
import { computePoissonMarkets } from "../probability";

type Contract = {
  topFiveCompetitions: string[];
  internationalCompetitions: string[];
  liveShadowChannels: string[];
  trainingSegments: string[];
};

const contract: Contract = JSON.parse(
  readFileSync(join(__dirname, "ml-shadow-contract.json"), "utf-8"),
);

const probabilities = computePoissonMarkets(1.4, 1.1);

const features: DeterministicFeatures = {
  recentForm: 0.5,
  xg: 0.5,
  domExtPerf: 0.5,
  leagueVolat: 0.5,
};

function leagueTierOf(competitionCode: string): string {
  const result = buildMlShadowFeatures({
    pick: {
      market: "ONE_X_TWO",
      probability: new Decimal(0.4),
      ev: new Decimal(0.1),
      odds: new Decimal(2.0),
    },
    channel: "VALUE",
    deterministicScore: new Decimal(0.5),
    probabilities,
    features,
    competitionCode,
  });
  return result.league_tier;
}

describe("ml-features league_tier — drift guard vs extract.py", () => {
  it.each(contract.topFiveCompetitions)(
    "%s classifies as top5 (matches extract.py _TOP5_COMPETITIONS)",
    (code) => {
      expect(leagueTierOf(code)).toBe("top5");
    },
  );

  it.each(contract.internationalCompetitions)(
    "%s classifies as international (matches extract.py _INTERNATIONAL)",
    (code) => {
      expect(leagueTierOf(code)).toBe("international");
    },
  );

  it("codes outside both sets classify as secondary", () => {
    expect(leagueTierOf("D2")).toBe("secondary");
  });
});
