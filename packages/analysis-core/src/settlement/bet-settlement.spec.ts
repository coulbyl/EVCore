import { describe, expect, it } from "vitest";
import { BetStatus, Market } from "../types";
import {
  resolveEarlyBetStatus,
  resolveFirstHalfBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolvePickBetStatus,
  resolveWinEitherHalfBetStatus,
} from "./bet-settlement";

describe("resolvePickBetStatus", () => {
  it("settles 1X2 / OU / BTTS / DC picks from the final score", () => {
    expect(resolvePickBetStatus(Market.ONE_X_TWO, "HOME", 2, 1)).toBe(
      BetStatus.WON,
    );
    expect(resolvePickBetStatus(Market.ONE_X_TWO, "AWAY", 2, 1)).toBe(
      BetStatus.LOST,
    );
    expect(resolvePickBetStatus(Market.OVER_UNDER, "OVER", 2, 1)).toBe(
      BetStatus.WON,
    ); // 3 > 2.5
    expect(resolvePickBetStatus(Market.OVER_UNDER, "UNDER", 1, 1)).toBe(
      BetStatus.WON,
    ); // 2 ≤ 2.5
    expect(resolvePickBetStatus(Market.BTTS, "YES", 1, 1)).toBe(BetStatus.WON);
    expect(resolvePickBetStatus(Market.DOUBLE_CHANCE, "1X", 1, 1)).toBe(
      BetStatus.WON,
    );
  });

  it("VOIDs on missing scores or unknown pick", () => {
    expect(resolvePickBetStatus(Market.ONE_X_TWO, "HOME", null, 1)).toBe(
      BetStatus.VOID,
    );
    expect(resolvePickBetStatus(Market.ONE_X_TWO, "NONSENSE", 1, 0)).toBe(
      BetStatus.VOID,
    );
  });

  it("settles CORRECT_SCORE picks 'H:A' by exact match", () => {
    expect(resolvePickBetStatus(Market.CORRECT_SCORE, "2:1", 2, 1)).toBe(
      BetStatus.WON,
    );
    expect(resolvePickBetStatus(Market.CORRECT_SCORE, "1:0", 2, 1)).toBe(
      BetStatus.LOST,
    );
    expect(resolvePickBetStatus(Market.CORRECT_SCORE, "0:0", 0, 0)).toBe(
      BetStatus.WON,
    );
  });

  it("resolves DRAW_NO_BET: VOIDs (push) on a draw", () => {
    expect(resolvePickBetStatus(Market.DRAW_NO_BET, "HOME", 1, 1)).toBe(
      BetStatus.VOID,
    );
    expect(resolvePickBetStatus(Market.DRAW_NO_BET, "HOME", 2, 1)).toBe(
      BetStatus.WON,
    );
    expect(resolvePickBetStatus(Market.DRAW_NO_BET, "AWAY", 2, 1)).toBe(
      BetStatus.LOST,
    );
  });

  it("resolves TEAM_TOTAL_HOME/AWAY against that team's goals only", () => {
    expect(resolvePickBetStatus(Market.TEAM_TOTAL_HOME, "OVER_1_5", 2, 5)).toBe(
      BetStatus.WON,
    );
    expect(resolvePickBetStatus(Market.TEAM_TOTAL_AWAY, "OVER_1_5", 2, 5)).toBe(
      BetStatus.WON,
    );
    expect(
      resolvePickBetStatus(Market.TEAM_TOTAL_HOME, "UNDER_0_5", 1, 0),
    ).toBe(BetStatus.LOST);
  });

  it("resolves CLEAN_SHEET_HOME/AWAY from the opposing side's goals", () => {
    // home 1-1 away: home conceded, so CLEAN_SHEET_HOME=YES is a loss.
    expect(resolvePickBetStatus(Market.CLEAN_SHEET_HOME, "YES", 1, 1)).toBe(
      BetStatus.LOST,
    );
    expect(resolvePickBetStatus(Market.CLEAN_SHEET_HOME, "YES", 2, 0)).toBe(
      BetStatus.WON,
    );
    expect(resolvePickBetStatus(Market.CLEAN_SHEET_AWAY, "YES", 0, 3)).toBe(
      BetStatus.WON,
    );
    expect(resolvePickBetStatus(Market.CLEAN_SHEET_AWAY, "YES", 1, 3)).toBe(
      BetStatus.LOST,
    );
  });

  it("resolves WIN_TO_NIL_HOME/AWAY: win AND opponent held to zero", () => {
    expect(resolvePickBetStatus(Market.WIN_TO_NIL_HOME, "YES", 2, 0)).toBe(
      BetStatus.WON,
    );
    expect(resolvePickBetStatus(Market.WIN_TO_NIL_HOME, "YES", 2, 1)).toBe(
      BetStatus.LOST,
    );
  });

  it("resolves RESULT_TOTAL_GOALS combined picks", () => {
    expect(
      resolvePickBetStatus(Market.RESULT_TOTAL_GOALS, "HOME_OVER_1_5", 2, 1),
    ).toBe(BetStatus.WON);
    // Result matches but total-goals side doesn't.
    expect(
      resolvePickBetStatus(Market.RESULT_TOTAL_GOALS, "HOME_OVER_1_5", 1, 0),
    ).toBe(BetStatus.LOST);
    // Result doesn't match.
    expect(
      resolvePickBetStatus(Market.RESULT_TOTAL_GOALS, "HOME_OVER_1_5", 1, 2),
    ).toBe(BetStatus.LOST);
  });

  it("resolves RESULT_BTTS combined picks", () => {
    expect(resolvePickBetStatus(Market.RESULT_BTTS, "HOME_YES", 2, 1)).toBe(
      BetStatus.WON,
    );
    expect(resolvePickBetStatus(Market.RESULT_BTTS, "HOME_YES", 2, 0)).toBe(
      BetStatus.LOST,
    );
  });
});

describe("resolveWinEitherHalfBetStatus", () => {
  it("wins if the team wins either half, even if it loses the match", () => {
    // Home wins H1 2-0, loses H2 0-2 → FT 2-2, still WON (won H1).
    expect(resolveWinEitherHalfBetStatus("HOME", 2, 0, 2, 2)).toBe(
      BetStatus.WON,
    );
  });

  it("loses if the team wins neither half", () => {
    // Home draws H1 0-0, loses H2 0-1 → FT 0-1.
    expect(resolveWinEitherHalfBetStatus("HOME", 0, 0, 0, 1)).toBe(
      BetStatus.LOST,
    );
  });

  it("VOIDs on missing HT scores", () => {
    expect(resolveWinEitherHalfBetStatus("HOME", null, null, 2, 1)).toBe(
      BetStatus.VOID,
    );
  });
});

describe("resolveHalfTimeFullTimeBetStatus", () => {
  it("matches both the HT and FT outcome", () => {
    expect(
      resolveHalfTimeFullTimeBetStatus({
        pick: "HOME_HOME",
        homeHtScore: 1,
        awayHtScore: 0,
        homeScore: 2,
        awayScore: 1,
      }),
    ).toBe(BetStatus.WON);
    expect(
      resolveHalfTimeFullTimeBetStatus({
        pick: "DRAW_HOME",
        homeHtScore: 1,
        awayHtScore: 0,
        homeScore: 2,
        awayScore: 1,
      }),
    ).toBe(BetStatus.LOST);
  });
});

describe("resolveFirstHalfBetStatus", () => {
  it("settles first-half markets from HT scores", () => {
    expect(resolveFirstHalfBetStatus("OVER_0_5", 1, 0)).toBe(BetStatus.WON);
    expect(resolveFirstHalfBetStatus("UNDER_0_5", 0, 0)).toBe(BetStatus.WON);
    expect(resolveFirstHalfBetStatus("HOME", 1, 0)).toBe(BetStatus.WON);
  });
});

describe("resolveEarlyBetStatus", () => {
  const base = { homeHtScore: null, awayHtScore: null };

  it("locks an OVER win once the threshold is crossed", () => {
    expect(
      resolveEarlyBetStatus({
        market: Market.OVER_UNDER,
        pick: "OVER",
        homeScore: 2,
        awayScore: 1,
        ...base,
      }),
    ).toBe(BetStatus.WON);
  });

  it("returns null when the outcome is not yet irrevocable", () => {
    expect(
      resolveEarlyBetStatus({
        market: Market.OVER_UNDER,
        pick: "OVER",
        homeScore: 1,
        awayScore: 1,
        ...base,
      }),
    ).toBeNull();
    expect(
      resolveEarlyBetStatus({
        market: Market.ONE_X_TWO,
        pick: "HOME",
        homeScore: 3,
        awayScore: 0,
        ...base,
      }),
    ).toBeNull();
  });

  it("locks an UNDER loss once the threshold is crossed", () => {
    expect(
      resolveEarlyBetStatus({
        market: Market.OVER_UNDER,
        pick: "UNDER",
        homeScore: 2,
        awayScore: 1,
        ...base,
      }),
    ).toBe(BetStatus.LOST);
  });
});
