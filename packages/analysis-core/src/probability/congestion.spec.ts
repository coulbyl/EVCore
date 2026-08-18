import { describe, it, expect } from "vitest";
import {
  computeRestPenalty,
  computeTeamCongestionScore,
  computeCongestionScoreFromTeams,
} from "./congestion";

const FIXTURE_DATE = new Date("2026-08-15T15:00:00.000Z");

describe("computeRestPenalty", () => {
  it("is 0 (no penalty) at or beyond the 3-day rest threshold", () => {
    const threeDaysAgo = new Date(
      FIXTURE_DATE.getTime() - 3 * 24 * 60 * 60 * 1000,
    );
    expect(computeRestPenalty(threeDaysAgo, FIXTURE_DATE)).toBe(0);
  });

  it("is maximal (1) when the team played on the same day", () => {
    expect(computeRestPenalty(FIXTURE_DATE, FIXTURE_DATE)).toBe(1);
  });

  it("scales linearly between 0 and 3 days of rest", () => {
    const oneDayAgo = new Date(
      FIXTURE_DATE.getTime() - 1 * 24 * 60 * 60 * 1000,
    );
    expect(computeRestPenalty(oneDayAgo, FIXTURE_DATE)).toBeCloseTo(2 / 3, 5);
  });
});

describe("computeTeamCongestionScore", () => {
  it("is 0 for a fully rested team with no upcoming fixtures", () => {
    const score = computeTeamCongestionScore({
      lastPlayedAt: null,
      upcomingFixtureCount: 0,
      fixtureDate: FIXTURE_DATE,
    });
    expect(score).toBe(0);
  });

  it("weights rest at 0.6 and upcoming density at 0.4", () => {
    const score = computeTeamCongestionScore({
      lastPlayedAt: FIXTURE_DATE, // same-day → restPenalty = 1
      upcomingFixtureCount: 3, // clamps upcomingPenalty to 1
      fixtureDate: FIXTURE_DATE,
    });
    expect(score).toBeCloseTo(1, 10); // 0.6*1 + 0.4*1
  });
});

describe("computeCongestionScoreFromTeams", () => {
  it("averages both teams' scores", () => {
    const restedHome = {
      lastPlayedAt: null,
      upcomingFixtureCount: 0,
      fixtureDate: FIXTURE_DATE,
    };
    const congestedAway = {
      lastPlayedAt: FIXTURE_DATE,
      upcomingFixtureCount: 3,
      fixtureDate: FIXTURE_DATE,
    };
    expect(
      computeCongestionScoreFromTeams(restedHome, congestedAway),
    ).toBeCloseTo(0.5, 10);
  });
});
