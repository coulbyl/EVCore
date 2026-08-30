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

  it("gives every reading a French market/pick label alongside the technical code, and drops EV entirely (regression: VANTAGE's prose was echoing raw codes like OVER_UNDER/UNDER and citing EV, an anti-predictive signal per CLAUDE.md)", () => {
    const prompt = buildUserPrompt(baseContext, null);
    // RESULT_BTTS/AWAY_NO → "Ext. + BTTS Non" per formatPickForDisplayFr.
    expect(prompt).toContain(
      "marché=RESULT_BTTS, pick=AWAY_NO (Résultat + BTTS, Ext. + BTTS Non)",
    );
    expect(prompt).toContain(
      "marché=CLEAN_SHEET_HOME, pick=YES (Clean sheet domicile, Oui)",
    );
    expect(prompt).not.toContain("EV");
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

  it("gives an explicit, correctly-signed worked example for the calibration direction (regression: ~30% of real VANTAGE output inverted sur/sous-estimé — see project memory project_vantage_reasondetails_quality)", () => {
    expect(SYSTEM_PROMPT).toContain("SURESTIMÉE");
    expect(SYSTEM_PROMPT).toContain("SOUS-ESTIMÉE");
    expect(SYSTEM_PROMPT).toContain("l'erreur la plus fréquente");
  });

  it("allows a play beyond inter-channel tension, but still requires a real basis", () => {
    expect(SYSTEM_PROMPT).toContain("lecture proche du seuil");
    expect(SYSTEM_PROMPT).toContain(
      'Un simple consensus entre canaux SELECTED, sans aucune de ces quatre bases, reste un "no_play"',
    );
  });

  it("frames raw market odds as context, never as a value/edge signal to compute", () => {
    expect(SYSTEM_PROMPT).toContain("jamais un signal de valeur à exploiter");
  });

  it("renders a REJECTED reading's near-miss numbers when present", () => {
    const prompt = buildUserPrompt(
      {
        ...baseContext,
        readings: [
          {
            channel: "BTTS",
            status: "REJECTED",
            reasonCode: "below_threshold",
            market: null,
            pick: null,
            probability: null,
            odds: null,
            ev: null,
            nearMiss: {
              values: [
                { label: "Oui", probability: 0.31 },
                { label: "Non", probability: 0.69 },
              ],
              threshold: 0.35,
            },
          },
        ],
      },
      null,
    );
    expect(prompt).toContain("Lecture proche du seuil");
    expect(prompt).toContain("Oui +31.0%");
    expect(prompt).toContain("Non +69.0%");
    expect(prompt).toContain("seuil +35.0%");
  });

  it("renders raw team stats when present, and an explicit 'non disponible' when a team has none", () => {
    const prompt = buildUserPrompt(
      {
        ...baseContext,
        homeTeamStats: {
          recentForm: 0.6,
          xgFor: 1.5,
          xgAgainst: 1.1,
          homeWinRate: 0.55,
          awayWinRate: 0.3,
          drawRate: 0.2,
          leagueVolatility: 1.1,
        },
        awayTeamStats: null,
      },
      null,
    );
    expect(prompt).toContain("Statistiques brutes");
    expect(prompt).toContain("forme récente +60.0%");
    expect(prompt).toContain("non disponible");
  });

  it("labels the independent second opinion as external, distinct from the channels", () => {
    const prompt = buildUserPrompt(
      {
        ...baseContext,
        shadowPrediction: {
          homePercent: 35,
          drawPercent: 28,
          awayPercent: 37,
          poissonHome: 1.6,
          poissonAway: 1.2,
          winnerName: "El Paso Locomotive",
          conflict: true,
        },
      },
      null,
    );
    expect(prompt).toContain("Second avis indépendant");
    expect(prompt).toContain("en désaccord avec notre propre lecture");
  });

  it("never emits ROI/EV language anywhere, even with every new context block populated", () => {
    const prompt = buildUserPrompt(
      {
        ...baseContext,
        homeTeamStats: {
          recentForm: 0.6,
          xgFor: 1.5,
          xgAgainst: 1.1,
          homeWinRate: 0.55,
          awayWinRate: 0.3,
          drawRate: 0.2,
          leagueVolatility: 1.1,
        },
        awayTeamStats: null,
        homeCoach: { matchesInCharge: 2 },
        h2h: { scoreline: "1:1", confidence: 0.4, sampleSize: 4 },
        shadowPrediction: {
          homePercent: 35,
          drawPercent: 28,
          awayPercent: 37,
          poissonHome: 1.6,
          poissonAway: 1.2,
          winnerName: null,
          conflict: false,
        },
        shadowMl: [{ channel: "DOMINANT", correctedP: 0.5, edgeDelta: -0.05 }],
        uncoveredMarketOdds: [
          { market: "ONE_X_TWO", homeOdds: 2.1, drawOdds: 3.2, awayOdds: 3.4 },
        ],
      },
      null,
    );
    expect(prompt).not.toContain("ROI");
    expect(prompt).not.toContain("EV");
  });
});
