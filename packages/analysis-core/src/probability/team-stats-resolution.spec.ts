import { describe, it, expect } from "vitest";
import {
  resolveEffectiveTeamStats,
  isEuropeanCompetition,
  isNationalTeamCompetition,
  DOMESTIC_SEASON_ROLLOVER_MIN_GAMES,
} from "./team-stats-resolution";
import type { TeamStatsInput } from "./match-stats";

// Regression coverage for the cross-competition fallback policy moved here
// 2026-08-18 from BettingEngineService.analyzeFixture — the live engine and
// the backtest harness must produce byte-identical decisions.

const primary: TeamStatsInput = {
  recentForm: 0.6,
  xgFor: 1.8,
  xgAgainst: 1.1,
  homeWinRate: 0.5,
  awayWinRate: 0.3,
  drawRate: 0.2,
  leagueVolatility: 0.4,
};

const cross: TeamStatsInput = {
  recentForm: 0.4,
  xgFor: 1.5,
  xgAgainst: 1.3,
  homeWinRate: 0.45,
  awayWinRate: 0.25,
  drawRate: 0.3,
  leagueVolatility: 0.35,
};

describe("isEuropeanCompetition / isNationalTeamCompetition", () => {
  it("classifies known codes", () => {
    expect(isEuropeanCompetition("UCL")).toBe(true);
    expect(isEuropeanCompetition("PL")).toBe(false);
    expect(isEuropeanCompetition(null)).toBe(false);
    expect(isNationalTeamCompetition("WC")).toBe(true);
    expect(isNationalTeamCompetition("PL")).toBe(false);
  });
});

describe("resolveEffectiveTeamStats", () => {
  it("European: blends primary with cross-comp regardless of games played", () => {
    const result = resolveEffectiveTeamStats({
      competitionCode: "UCL",
      primaryStats: primary,
      crossCompStats: cross,
      gamesPlayedThisSeason: 20, // established sample — must still blend
    });
    expect(result).not.toEqual(primary);
    expect(result).not.toBeNull();
  });

  it("European: falls back to primary when no cross-comp stats exist", () => {
    const result = resolveEffectiveTeamStats({
      competitionCode: "UCL",
      primaryStats: primary,
      crossCompStats: null,
      gamesPlayedThisSeason: 5,
    });
    expect(result).toEqual(primary);
  });

  it("European: uses cross-comp stats alone when primary is missing", () => {
    const result = resolveEffectiveTeamStats({
      competitionCode: "UCL",
      primaryStats: null,
      crossCompStats: cross,
      gamesPlayedThisSeason: 0,
    });
    expect(result).toEqual(cross);
  });

  it("National team: blends whenever cross-comp exists (tournament start, 0 games played)", () => {
    const result = resolveEffectiveTeamStats({
      competitionCode: "WC",
      primaryStats: null,
      crossCompStats: cross,
      gamesPlayedThisSeason: 0,
    });
    expect(result).toEqual(cross);
  });

  it("Domestic: returns primary unchanged once the season sample is established", () => {
    const result = resolveEffectiveTeamStats({
      competitionCode: "PL",
      primaryStats: primary,
      crossCompStats: cross,
      gamesPlayedThisSeason: DOMESTIC_SEASON_ROLLOVER_MIN_GAMES,
    });
    expect(result).toEqual(primary);
  });

  it("Domestic: blends with cross-comp while the current-season sample is thin", () => {
    const result = resolveEffectiveTeamStats({
      competitionCode: "PL",
      primaryStats: primary,
      crossCompStats: cross,
      gamesPlayedThisSeason: DOMESTIC_SEASON_ROLLOVER_MIN_GAMES - 1,
    });
    expect(result).not.toEqual(primary);
    expect(result).not.toBeNull();
  });

  it("Domestic: thin sample but no cross-comp stats available — stays with primary (possibly null)", () => {
    const result = resolveEffectiveTeamStats({
      competitionCode: "PL",
      primaryStats: null,
      crossCompStats: null,
      gamesPlayedThisSeason: 0,
    });
    expect(result).toBeNull();
  });
});
