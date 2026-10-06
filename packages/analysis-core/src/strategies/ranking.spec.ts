import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { rankLineCandidates } from "./ranking";

const candidate = (probability: number, odds: number | null) => ({
  probability: new Decimal(probability),
  priced:
    odds === null
      ? {}
      : {
          odds: new Decimal(odds),
          ev: new Decimal(probability * odds - 1),
        },
});

describe("rankLineCandidates", () => {
  const under45 = candidate(0.9, 1.05); // ev -0.055
  const under35 = candidate(0.78, 1.3); // ev +0.014
  const under25 = candidate(0.55, 1.95); // ev +0.0725
  const unpriced = candidate(0.7, null);

  it("ranks by EV by default, priced before unpriced, probability as tie-break", () => {
    const ranked = rankLineCandidates([unpriced, under45, under35, under25]);
    expect(ranked.map((c) => c.probability.toNumber())).toEqual([
      0.55, 0.78, 0.9, 0.7,
    ]);
  });

  it("in band mode keeps only priced lines inside the band and ranks them by probability", () => {
    const ranked = rankLineCandidates([unpriced, under45, under35, under25], {
      ranking: "probability_in_band",
    });
    // 1.05 is below 1.20, 1.95 is above 1.80: only UNDER 3.5 at 1.30 remains.
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.probability.toNumber()).toBe(0.78);
  });

  it("in band mode prefers the higher probability, not the higher EV", () => {
    const a = candidate(0.7, 1.5); // ev +0.05
    const b = candidate(0.65, 1.7); // ev +0.105
    const ranked = rankLineCandidates([b, a], {
      ranking: "probability_in_band",
    });
    expect(ranked[0]).toBe(a);
  });

  it("returns an empty ranking when nothing is in the band", () => {
    expect(
      rankLineCandidates([under45, under25], {
        ranking: "probability_in_band",
      }),
    ).toEqual([]);
  });

  it("does not mutate its input", () => {
    const input = [under25, under45];
    rankLineCandidates(input);
    expect(input[0]).toBe(under25);
  });
});
