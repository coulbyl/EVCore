import { describe, expect, it } from "vitest";
import { buildUserPrompt } from "./prompt";
import type { MatchContext } from "../context/types";

const baseContext: MatchContext = {
  fixtureId: "fixture-1",
  modelRunId: "run-1",
  homeTeam: "El Paso Locomotive",
  awayTeam: "Pittsburgh Riverhounds",
  competitionCode: "USA2",
  competitionName: "USL Championship",
  kickoff: "2026-08-22T01:00:00.000Z",
  readings: [
    {
      channel: "RESULT_BTTS",
      status: "SELECTED",
      reasonCode: null,
      market: "RESULT_BTTS",
      pick: "AWAY_NO",
      probability: 0.28,
      odds: 5.0,
      ev: 0.39,
    },
    {
      channel: "CLEAN_SHEET",
      status: "SELECTED",
      reasonCode: null,
      market: "CLEAN_SHEET_HOME",
      pick: "YES",
      probability: 0.32,
      odds: 2.5,
      ev: -0.19,
    },
  ],
  calibration: [
    { channel: "RESULT_BTTS", sampleSize: 40, hitRate: 0.28, roi: -0.07 },
    { channel: "CLEAN_SHEET", sampleSize: 12, hitRate: null, roi: null },
  ],
};

describe("buildUserPrompt", () => {
  it("renders every channel reading with its calibration", () => {
    const prompt = buildUserPrompt(baseContext, null);
    expect(prompt).toContain("El Paso Locomotive vs Pittsburgh Riverhounds");
    expect(prompt).toContain("RESULT_BTTS: RESULT_BTTS → AWAY_NO");
    expect(prompt).toContain("CLEAN_SHEET: CLEAN_SHEET_HOME → YES");
    expect(prompt).toContain("fiabilité mesurée sur USL Championship");
    // Sample size below 30 must read as unmeasurable, not as a fabricated number.
    expect(prompt).toContain("fiabilité non mesurable sur USL Championship");
  });

  it("tells the model to judge on channels alone when no research is available", () => {
    const prompt = buildUserPrompt(baseContext, null);
    expect(prompt).toContain("Aucune recherche factuelle disponible");
  });

  it("includes the research summary and its sources when provided", () => {
    const prompt = buildUserPrompt(baseContext, {
      summary: "Aucune blessure signalée côté El Paso.",
      citations: [{ title: "Team news", url: "https://example.com/news" }],
    });
    expect(prompt).toContain("Aucune blessure signalée côté El Paso.");
    expect(prompt).toContain("https://example.com/news");
  });
});
