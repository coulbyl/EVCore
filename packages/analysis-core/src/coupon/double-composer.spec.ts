import { describe, expect, it } from "vitest";
import {
  composeDouble,
  priceDoubleCandidates,
  type DoubleCandidate,
} from "./double-composer";

/** Un marché à deux issues coté complet, au même prix chez le joueur. */
function overUnder(
  fixtureId: string,
  over: number,
  under: number,
  line = "1_5",
): DoubleCandidate[] {
  return [
    {
      fixtureId,
      market: "OVER_UNDER",
      pick: `OVER_${line}`,
      odds: over,
      playableOdds: over,
    },
    {
      fixtureId,
      market: "OVER_UNDER",
      pick: `UNDER_${line}`,
      odds: under,
      playableOdds: under,
    },
  ];
}

describe("priceDoubleCandidates", () => {
  it("removes the margin on a complete outcome group", () => {
    const [over] = priceDoubleCandidates(overUnder("f1", 1.4, 2.8));
    // 1/1,4 + 1/2,8 = 1,0714 : marge 7,14 %, proba 0,7143 / 1,0714 = 0,6667.
    expect(over?.fair.toFixed(4)).toBe("0.6667");
    expect(over?.margin.toFixed(4)).toBe("0.0714");
  });

  it("drops a candidate whose group is incomplete or has no clean group", () => {
    const priced = priceDoubleCandidates([
      {
        fixtureId: "f1",
        market: "OVER_UNDER",
        pick: "OVER_1_5",
        odds: 1.4,
        playableOdds: 1.4,
      },
      {
        fixtureId: "f1",
        market: "TO_WIN_EITHER_HALF",
        pick: "HOME",
        odds: 1.5,
        playableOdds: 1.5,
      },
    ]);
    expect(priced).toHaveLength(0);
  });
});

describe("composeDouble", () => {
  it("includes a pair exactly on the 2.00 floor", () => {
    // 1,25 × 1,60 = 2,00 : la borne est incluse et lue exactement.
    const result = composeDouble([
      ...overUnder("f1", 1.25, 3.6),
      ...overUnder("f2", 1.6, 2.2),
    ]);
    expect(result.outcome).toBe("composed");
    if (result.outcome !== "composed") return;
    expect(result.playableCombinedOdds.toFixed(2)).toBe("2.00");
  });

  it("takes the pair the market rates most likely inside the 2–3 window", () => {
    const result = composeDouble([
      ...overUnder("f1", 1.45, 2.65),
      ...overUnder("f2", 1.45, 2.65),
      // Plus probable seule, mais aucune paire avec elle n'atteint 2,00
      // (1,20 × 1,60 = 1,92).
      ...overUnder("f3", 1.2, 4.4),
      // Paire possible avec f1 (2,32), mais moins probable.
      ...overUnder("f4", 1.6, 2.3),
    ]);
    expect(result.outcome).toBe("composed");
    if (result.outcome !== "composed") return;
    expect(result.legs.map((leg) => leg.fixtureId).sort()).toEqual([
      "f1",
      "f2",
    ]);
    expect(result.playableCombinedOdds.toFixed(4)).toBe("2.1025");
    expect(result.probability.toNumber()).toBeCloseTo(
      result.legs[0]!.fair.times(result.legs[1]!.fair).toNumber(),
      10,
    );
  });

  it("at the same odds, picks the pair that pays the least margin", () => {
    // Même cote 1,45 partout ; la marge plus basse de f1 et f2 relève leur
    // probabilité sans marge : classer par le marché, c'est classer par le prix.
    const result = composeDouble([
      ...overUnder("f1", 1.45, 2.9),
      ...overUnder("f2", 1.45, 2.9),
      ...overUnder("f3", 1.45, 2.4),
      ...overUnder("f4", 1.45, 2.4),
    ]);
    expect(result.outcome).toBe("composed");
    if (result.outcome !== "composed") return;
    expect(result.legs.map((leg) => leg.fixtureId).sort()).toEqual([
      "f1",
      "f2",
    ]);
  });

  it("never uses draw no bet, even when it is the most likely leg", () => {
    const dnb = (fixtureId: string): DoubleCandidate[] => [
      {
        fixtureId,
        market: "DRAW_NO_BET",
        pick: "HOME",
        odds: 1.45,
        playableOdds: 1.45,
      },
      {
        fixtureId,
        market: "DRAW_NO_BET",
        pick: "AWAY",
        odds: 2.9,
        playableOdds: 2.9,
      },
    ];
    const result = composeDouble([
      ...dnb("f1"),
      ...dnb("f2"),
      ...overUnder("f3", 1.45, 2.4),
      ...overUnder("f4", 1.45, 2.4),
    ]);
    expect(result.outcome).toBe("composed");
    if (result.outcome !== "composed") return;
    expect(result.legs.every((leg) => leg.market !== "DRAW_NO_BET")).toBe(true);
  });

  it("never pairs two legs of the same match", () => {
    const result = composeDouble([
      ...overUnder("f1", 1.45, 2.65, "1_5"),
      ...overUnder("f1", 1.5, 2.5, "2_5"),
    ]);
    expect(result.outcome).toBe("abstained");
  });

  it("falls back to three short legs only when no pair exists", () => {
    const result = composeDouble([
      ...overUnder("f1", 1.28, 3.6),
      ...overUnder("f2", 1.28, 3.6),
      ...overUnder("f3", 1.28, 3.6),
    ]);
    expect(result.outcome).toBe("composed");
    if (result.outcome !== "composed") return;
    expect(result.legs).toHaveLength(3);
    expect(result.playableCombinedOdds.toNumber()).toBeGreaterThanOrEqual(2);
  });

  it("reads the window on the player's odds, not the reference", () => {
    // Référence 1,45 × 1,45 = 2,10, mais 1,38 chez le joueur : 1,90.
    const lower = (rows: DoubleCandidate[]) =>
      rows.map((r) => ({
        ...r,
        playableOdds: r.pick.startsWith("OVER") ? 1.38 : r.playableOdds,
      }));
    const result = composeDouble([
      ...lower(overUnder("f1", 1.45, 2.65)),
      ...lower(overUnder("f2", 1.45, 2.65)),
    ]);
    expect(result.outcome).toBe("abstained");
  });
});

describe("composeDouble pruning", () => {
  /** Toutes les paires, sans élagage : la référence du résultat attendu. */
  function bruteForce(candidates: DoubleCandidate[]) {
    const legs = priceDoubleCandidates(candidates).filter(
      (leg) => leg.playableOdds >= 1.2 && leg.playableOdds <= 1.8,
    );
    let best: { key: string; score: number; margin: number } | null = null;
    for (let i = 0; i < legs.length; i++) {
      for (let j = i + 1; j < legs.length; j++) {
        const a = legs[i]!;
        const b = legs[j]!;
        if (a.fixtureId === b.fixtureId) continue;
        const odds = a.playableOdds * b.playableOdds;
        if (odds < 2 - 1e-9 || odds > 3 + 1e-9) continue;
        const score = a.fair.times(b.fair).toNumber();
        const margin = a.margin.plus(b.margin).toNumber();
        if (
          !best ||
          score > best.score + 1e-12 ||
          (Math.abs(score - best.score) <= 1e-12 && margin < best.margin)
        ) {
          best = {
            key: [a, b]
              .map((l) => l.fixtureId + l.pick)
              .sort()
              .join("|"),
            score,
            margin,
          };
        }
      }
    }
    return best;
  }

  it("finds the same pair as the exhaustive search on random pools", () => {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let pool = 0; pool < 40; pool++) {
      const candidates: DoubleCandidate[] = [];
      for (let f = 0; f < 30; f++) {
        const over = Math.round((1.15 + rnd() * 0.8) * 100) / 100;
        const under = Math.round((1 / (1.06 - 1 / over)) * 100) / 100;
        candidates.push(...overUnder(`f${pool}-${f}`, over, under));
      }
      const expected = bruteForce(candidates);
      const result = composeDouble(candidates);
      if (!expected) {
        expect(result.outcome).toBe("abstained");
        continue;
      }
      expect(result.outcome).toBe("composed");
      if (result.outcome !== "composed") continue;
      const key = result.legs
        .map((l) => l.fixtureId + l.pick)
        .sort()
        .join("|");
      expect(key).toBe(expected.key);
    }
  });
});
