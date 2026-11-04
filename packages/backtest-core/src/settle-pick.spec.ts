import { describe, expect, it } from "vitest";
import { Market } from "@evcore/analysis-core";
import { settleReplayPick } from "./settle-pick";

const score = { homeScore: 2, awayScore: 1, homeHtScore: 0, awayHtScore: 1 };

describe("settleReplayPick", () => {
  it("settles full-time markets on the final score", () => {
    expect(
      settleReplayPick(score, { market: Market.ONE_X_TWO, pick: "HOME" }),
    ).toBe("WON");
    expect(
      settleReplayPick(score, { market: Market.OVER_UNDER, pick: "OVER" }),
    ).toBe("WON");
  });

  it("settles first-half markets on the half-time score", () => {
    expect(
      settleReplayPick(score, {
        market: Market.FIRST_HALF_WINNER,
        pick: "AWAY",
      }),
    ).toBe("WON");
    expect(
      settleReplayPick(score, {
        market: Market.HALF_TIME_FULL_TIME,
        pick: "AWAY_HOME",
      }),
    ).toBe("WON");
  });
});
