import { describe, expect, it } from "vitest";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
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
    {
      channel: "RESULT_BTTS",
      sampleSize: 40,
      hitRate: 0.28,
      calibrationRatio: 1.0,
    },
    {
      channel: "CLEAN_SHEET",
      sampleSize: 12,
      hitRate: null,
      calibrationRatio: null,
    },
  ],
};

describe("buildUserPrompt", () => {
  it("renders every channel reading with its calibration", () => {
    const prompt = buildUserPrompt(baseContext, null);
    expect(prompt).toContain("El Paso Locomotive vs Pittsburgh Riverhounds");
    expect(prompt).toContain(
      "Canal RESULT_BTTS → marché=RESULT_BTTS, pick=AWAY_NO",
    );
    expect(prompt).toContain(
      "Canal CLEAN_SHEET → marché=CLEAN_SHEET_HOME, pick=YES",
    );
    expect(prompt).toContain(
      "fiabilité mesurée sur USL Championship: calibration 1.00× (réel/annoncé)",
    );
    // Sample size below 30 must read as unmeasurable, not as a fabricated number.
    expect(prompt).toContain("fiabilité non mesurable sur USL Championship");
    // ROI must never appear — see feedback_admission_par_calibration:
    // calibration ratio replaces it, not the other way around.
    expect(prompt).not.toContain("ROI");
  });

  it("tells the model to judge on channels alone when no research is available", () => {
    const prompt = buildUserPrompt(baseContext, null);
    expect(prompt).toContain("Aucune recherche factuelle disponible");
  });

  it("labels channel vs. market explicitly when they diverge (regression: model must not echo the channel name as the market)", () => {
    const prompt = buildUserPrompt(
      {
        ...baseContext,
        readings: [
          {
            channel: "DRAW",
            status: "SELECTED",
            reasonCode: null,
            market: "ONE_X_TWO",
            pick: "DRAW",
            probability: 0.279,
            odds: null,
            ev: null,
          },
        ],
      },
      null,
    );
    expect(prompt).toContain("Canal DRAW → marché=ONE_X_TWO, pick=DRAW");
    expect(prompt).toContain("JAMAIS le nom du canal");
  });

  it("includes the research summary and its sources when provided", () => {
    const prompt = buildUserPrompt(baseContext, {
      summary: "Aucune blessure signalée côté El Paso.",
      citations: [{ title: "Team news", url: "https://example.com/news" }],
    });
    expect(prompt).toContain("Aucune blessure signalée côté El Paso.");
    expect(prompt).toContain("https://example.com/news");
  });

  it("caps reasonDetails length explicitly (regression: an unbounded reasonDetails blew past the schema's 600-char hard limit and got rejected)", () => {
    expect(SYSTEM_PROMPT).toContain("500 caractères");
  });

  it("instructs a minimum odds of 1.20", () => {
    expect(SYSTEM_PROMPT).toContain("1.20");
  });

  it("explicitly requires reasonDetails to be written in French, regardless of provider", () => {
    expect(SYSTEM_PROMPT).toContain("TOUJOURS être rédigé en français");
  });
});
