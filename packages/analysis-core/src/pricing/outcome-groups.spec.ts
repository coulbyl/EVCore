import { describe, expect, it } from "vitest";
import { Market } from "../types";
import { outcomeGroup } from "./outcome-groups";

describe("outcomeGroup", () => {
  it("rend le triplet 1X2 pour un choix à trois issues", () => {
    expect(outcomeGroup(Market.ONE_X_TWO, "DRAW")).toEqual({
      picks: ["HOME", "DRAW", "AWAY"],
      outcomeTotal: 1,
    });
    expect(outcomeGroup(Market.FIRST_HALF_WINNER, "AWAY")?.picks).toHaveLength(
      3,
    );
  });

  it("somme la double chance à 2, ses issues se recouvrant", () => {
    expect(outcomeGroup(Market.DOUBLE_CHANCE, "1X")).toEqual({
      picks: ["1X", "X2", "12"],
      outcomeTotal: 2,
    });
  });

  it("apparie chaque ligne de total avec son opposée, et elle seule", () => {
    expect(outcomeGroup(Market.OVER_UNDER, "OVER")?.picks).toEqual([
      "OVER",
      "UNDER",
    ]);
    expect(outcomeGroup(Market.OVER_UNDER, "UNDER_3_5")?.picks).toEqual([
      "OVER_3_5",
      "UNDER_3_5",
    ]);
    expect(outcomeGroup(Market.TEAM_TOTAL_AWAY, "UNDER_1_5")?.picks).toEqual([
      "OVER_1_5",
      "UNDER_1_5",
    ]);
    expect(outcomeGroup(Market.OVER_UNDER_HT, "OVER_0_5")?.picks).toEqual([
      "OVER_0_5",
      "UNDER_0_5",
    ]);
  });

  it("déplie résultat × total sur la ligne du choix", () => {
    const group = outcomeGroup(Market.RESULT_TOTAL_GOALS, "HOME_UNDER_4_5");
    expect(group?.picks).toHaveLength(6);
    expect(group?.picks).toContain("AWAY_OVER_4_5");
    expect(group?.picks).not.toContain("HOME_UNDER_2_5");
  });

  it("déplie résultat × BTTS en six issues", () => {
    expect(outcomeGroup(Market.RESULT_BTTS, "DRAW_NO")?.picks).toEqual([
      "HOME_YES",
      "HOME_NO",
      "DRAW_YES",
      "DRAW_NO",
      "AWAY_YES",
      "AWAY_NO",
    ]);
  });

  it("couvre les neuf issues mi-temps / fin de match", () => {
    expect(
      outcomeGroup(Market.HALF_TIME_FULL_TIME, "DRAW_HOME")?.picks,
    ).toHaveLength(9);
  });

  it("refuse les marchés sans partition propre et les choix inconnus", () => {
    expect(outcomeGroup(Market.TO_WIN_EITHER_HALF, "HOME")).toBeNull();
    expect(outcomeGroup(Market.CORRECT_SCORE, "1:0")).toBeNull();
    expect(outcomeGroup(Market.ASIAN_HANDICAP, "HOME")).toBeNull();
    expect(outcomeGroup(Market.ONE_X_TWO, "1X")).toBeNull();
    expect(outcomeGroup(Market.OVER_UNDER, "YES")).toBeNull();
    expect(outcomeGroup(Market.RESULT_TOTAL_GOALS, "HOME_OVER")).toBeNull();
  });
});
