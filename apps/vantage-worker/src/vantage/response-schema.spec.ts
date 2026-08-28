import { describe, expect, it } from "vitest";
import { Market } from "@evcore/analysis-core";
import { vantageResponseSchema } from "./response-schema";

describe("vantageResponseSchema", () => {
  it("accepts a well-formed no_play response", () => {
    const result = vantageResponseSchema.safeParse({
      verdict: "no_play",
      reasonDetails: "Aucun canal ne diverge significativement sur ce match.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a well-formed play response", () => {
    const result = vantageResponseSchema.safeParse({
      verdict: "play",
      market: Market.RESULT_BTTS,
      pick: "HOME_YES",
      probability: 0.42,
      reasonDetails:
        "RESULT_BTTS a penché Ext+BTTS Non alors que CLEAN_SHEET domicile n'est qu'à 32%.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a market outside the Market enum", () => {
    const result = vantageResponseSchema.safeParse({
      verdict: "play",
      market: "TOTALLY_MADE_UP",
      pick: "YES",
      probability: 0.5,
      reasonDetails: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a probability outside (0, 1)", () => {
    const result = vantageResponseSchema.safeParse({
      verdict: "play",
      market: Market.BTTS,
      pick: "YES",
      probability: 1.5,
      reasonDetails: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a play response missing reasonDetails", () => {
    const result = vantageResponseSchema.safeParse({
      verdict: "play",
      market: Market.BTTS,
      pick: "YES",
      probability: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown verdict value", () => {
    const result = vantageResponseSchema.safeParse({
      verdict: "maybe",
      reasonDetails: "x",
    });
    expect(result.success).toBe(false);
  });
});
