import { describe, expect, it } from "vitest";
import { BetStatus, Market } from "../types";
import {
  resolveComboPickBetStatus,
  resolveEarlyBetStatus,
  resolveFirstHalfBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolvePickBetStatus,
} from "./bet-settlement";

describe("resolvePickBetStatus", () => {
  it("settles 1X2 / OU / BTTS / DC picks from the final score", () => {
    expect(resolvePickBetStatus("HOME", 2, 1)).toBe(BetStatus.WON);
    expect(resolvePickBetStatus("AWAY", 2, 1)).toBe(BetStatus.LOST);
    expect(resolvePickBetStatus("OVER", 2, 1)).toBe(BetStatus.WON); // 3 > 2.5
    expect(resolvePickBetStatus("UNDER", 1, 1)).toBe(BetStatus.WON); // 2 ≤ 2.5
    expect(resolvePickBetStatus("YES", 1, 1)).toBe(BetStatus.WON); // BTTS
    expect(resolvePickBetStatus("1X", 1, 1)).toBe(BetStatus.WON); // DC
  });

  it("VOIDs on missing scores or unknown pick", () => {
    expect(resolvePickBetStatus("HOME", null, 1)).toBe(BetStatus.VOID);
    expect(resolvePickBetStatus("NONSENSE", 1, 0)).toBe(BetStatus.VOID);
  });
});

describe("resolveComboPickBetStatus", () => {
  const combo = {
    market1: Market.ONE_X_TWO,
    pick1: "HOME",
    market2: Market.BTTS,
    pick2: "YES",
  };

  it("WON only when both legs hit", () => {
    expect(resolveComboPickBetStatus(combo, 2, 1)).toBe(BetStatus.WON);
    expect(resolveComboPickBetStatus(combo, 1, 0)).toBe(BetStatus.LOST); // BTTS NO
    expect(resolveComboPickBetStatus(combo, null, 1)).toBe(BetStatus.VOID);
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
