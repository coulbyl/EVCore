import { describe, expect, it } from "vitest";
import { composeAiCombo, type AiComboCandidate } from "./ai-combo-composer";

const play = (
  over: Partial<AiComboCandidate> & { fixtureId: string },
): AiComboCandidate => ({
  competition: over.fixtureId,
  market: "BTTS",
  pick: "YES",
  operatorOdds: 1.6,
  operatorMargin: 0.06,
  probability: 0.6,
  ...over,
});

describe("composeAiCombo", () => {
  it("takes the cheapest plays, one per league, until the combined odds reach 4", () => {
    const result = composeAiCombo([
      play({ fixtureId: "a", operatorMargin: 0.09 }),
      play({ fixtureId: "b", operatorMargin: 0.04 }),
      play({ fixtureId: "c", operatorMargin: 0.05, competition: "b" }),
      play({ fixtureId: "d", operatorMargin: 0.05 }),
      play({ fixtureId: "e", operatorMargin: 0.07 }),
    ]);
    expect(result.outcome).toBe("composed");
    if (result.outcome !== "composed") return;
    // b (0.04), then c is the same league as b, d (0.05), e (0.07): 1.6³ = 4.096.
    expect(result.legs.map((l) => l.fixtureId)).toEqual(["b", "d", "e"]);
    expect(result.combinedOdds).toBe(4.096);
    expect(result.jointProbability).toBe(0.216);
  });

  it("leaves out a play out of the 1.45–1.80 band", () => {
    const result = composeAiCombo([
      play({ fixtureId: "a", operatorOdds: 2.2 }),
      play({ fixtureId: "b", operatorOdds: 1.3 }),
    ]);
    expect(result).toEqual({
      outcome: "abstained",
      reason: "no_ai_play_in_band",
      candidateCount: 0,
    });
  });

  it("abstains when four plays do not reach 4, and never passes 10", () => {
    const short = composeAiCombo([
      play({ fixtureId: "a", operatorOdds: 1.45 }),
      play({ fixtureId: "b", operatorOdds: 1.45 }),
    ]);
    expect(short).toMatchObject({
      outcome: "abstained",
      reason: "combined_odds_out_of_band",
    });
    const capped = composeAiCombo(
      ["a", "b", "c", "d", "e"].map((id) =>
        play({ fixtureId: id, operatorOdds: 1.8 }),
      ),
    );
    expect(capped.outcome).toBe("composed");
    if (capped.outcome !== "composed") return;
    expect(capped.legs).toHaveLength(3);
    expect(capped.combinedOdds).toBeLessThanOrEqual(10);
  });
});
