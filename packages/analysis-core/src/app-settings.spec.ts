import { describe, expect, it } from "vitest";
import { parseAppSetting } from "./app-settings";

describe("parseAppSetting", () => {
  it("reads a provider chain, refuses an unknown provider", () => {
    expect(
      parseAppSetting("llm.providers", {
        primary: "cerebras",
        fallbacks: ["groq", "together"],
      }),
    ).toEqual({ primary: "cerebras", fallbacks: ["groq", "together"] });
    expect(parseAppSetting("llm.providers", { primary: "cerebras" })).toEqual({
      primary: "cerebras",
      fallbacks: [],
    });
    expect(parseAppSetting("llm.providers", { primary: "openai" })).toBeNull();
    expect(
      parseAppSetting("llm.providers", { primary: "groq", fallbacks: ["x"] }),
    ).toBeNull();
  });

  it("reads research, the big leagues when no list is given", () => {
    expect(
      parseAppSetting("research", { enabled: true, provider: "tavily" }),
    ).toMatchObject({ enabled: true, provider: "tavily" });
    expect(
      parseAppSetting("research", { enabled: "yes", provider: "tavily" }),
    ).toBeNull();
  });

  it("bounds the numbers and the switch", () => {
    expect(parseAppSetting("apiFootball.quotaAlertPct", 80)).toBe(80);
    expect(parseAppSetting("apiFootball.quotaAlertPct", 0)).toBeNull();
    expect(parseAppSetting("apiFootball.quotaAlertPct", 120)).toBeNull();
    expect(parseAppSetting("statsBackfill.dailyReserve", 0)).toBe(0);
    expect(parseAppSetting("statsBackfill.dailyReserve", -1)).toBeNull();
    expect(parseAppSetting("scheduling.enabled", false)).toBe(false);
    expect(parseAppSetting("scheduling.enabled", "false")).toBeNull();
  });
});
