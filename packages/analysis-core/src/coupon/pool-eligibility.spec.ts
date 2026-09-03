import { describe, expect, it } from "vitest";
import { STRATEGY_CHANNEL } from "../types/strategy-channel";
import {
  DRAW_STAKED_LEAGUES,
  POOL_ELIGIBLE_CHANNELS,
  POOL_EXCLUDED_CHANNELS,
} from "./pool-eligibility";

describe("POOL_EXCLUDED_CHANNELS", () => {
  it("excludes the meta and filter channels", () => {
    expect(POOL_EXCLUDED_CHANNELS.has(STRATEGY_CHANNEL.CONSENSUS)).toBe(true);
    expect(POOL_EXCLUDED_CHANNELS.has(STRATEGY_CHANNEL.CONTRARIAN)).toBe(
      true,
    );
    expect(POOL_EXCLUDED_CHANNELS.has(STRATEGY_CHANNEL.AVOID)).toBe(true);
    expect(POOL_EXCLUDED_CHANNELS.has(STRATEGY_CHANNEL.VALUE)).toBe(true);
    expect(POOL_EXCLUDED_CHANNELS.has(STRATEGY_CHANNEL.SAFE)).toBe(true);
  });

  it("does not exclude a market-specialist channel", () => {
    expect(POOL_EXCLUDED_CHANNELS.has(STRATEGY_CHANNEL.DOMINANT)).toBe(false);
    expect(POOL_EXCLUDED_CHANNELS.has(STRATEGY_CHANNEL.DRAW)).toBe(false);
  });
});

describe("POOL_ELIGIBLE_CHANNELS", () => {
  it("is every channel not in POOL_EXCLUDED_CHANNELS", () => {
    for (const channel of Object.values(STRATEGY_CHANNEL)) {
      expect(POOL_ELIGIBLE_CHANNELS.includes(channel)).toBe(
        !POOL_EXCLUDED_CHANNELS.has(channel),
      );
    }
  });

  it("includes VANTAGE — an independent pick-emitting channel, not a filter/meta", () => {
    expect(POOL_ELIGIBLE_CHANNELS.includes(STRATEGY_CHANNEL.VANTAGE)).toBe(
      true,
    );
  });
});

describe("DRAW_STAKED_LEAGUES", () => {
  it("carries the backtested whitelist", () => {
    expect(DRAW_STAKED_LEAGUES).toEqual(["I2", "POR", "BL1", "CSL"]);
  });
});
