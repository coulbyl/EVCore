import { describe, it, expect, vi } from "vitest";
import { PointInTimeLoader } from "./point-in-time-loader";
import type { PrismaClient } from "@evcore/db";

const ASOF = new Date("2026-08-09T12:00:00.000Z");

// xgFor/homeWinRate vary with `seed` so a blend (whatever the weights) is
// distinguishable from the unblended primary in every branch — some
// branches (e.g. domestic's formWeight=1.0) leave recentForm untouched by
// design, so recentForm alone isn't a reliable blend signal.
function statsRow(seed: number) {
  return {
    recentForm: seed,
    xgFor: 1.0 + seed,
    xgAgainst: 1.2,
    homeWinRate: 0.5 + seed,
    awayWinRate: 0.3,
    drawRate: 0.2,
    leagueVolatility: 0.4,
  };
}

function makeClient(overrides: {
  findFirst: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
}): PrismaClient {
  return {
    teamStats: overrides,
  } as unknown as PrismaClient;
}

describe("PointInTimeLoader.loadTeamStats", () => {
  it("domestic, established sample: never fetches cross-comp stats, returns primary unchanged", async () => {
    const primary = statsRow(0.7);
    const findFirst = vi.fn().mockResolvedValue(primary);
    const count = vi.fn().mockResolvedValue(10); // well above the rollover threshold
    const loader = new PointInTimeLoader(makeClient({ findFirst, count }));

    const result = await loader.loadTeamStats({
      teamId: "t1",
      seasonId: "s1",
      competitionCode: "PL",
      asOf: ASOF,
    });

    expect(result).toEqual(primary);
    // Only the primary lookup — cross-comp findFirst must never fire.
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("domestic, thin sample: fetches and blends cross-comp stats", async () => {
    const primary = statsRow(0.7);
    const cross = statsRow(0.3);
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(primary) // primary lookup
      .mockResolvedValueOnce(cross); // cross-comp lookup
    const count = vi.fn().mockResolvedValue(1); // thin — below the rollover threshold
    const loader = new PointInTimeLoader(makeClient({ findFirst, count }));

    const result = await loader.loadTeamStats({
      teamId: "t1",
      seasonId: "s1",
      competitionCode: "PL",
      asOf: ASOF,
    });

    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(result).not.toEqual(primary);
  });

  it("European competition: always fetches and blends cross-comp stats, regardless of sample size", async () => {
    const primary = statsRow(0.7);
    const cross = statsRow(0.3);
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(primary)
      .mockResolvedValueOnce(cross);
    const count = vi.fn().mockResolvedValue(25); // established sample — must still blend
    const loader = new PointInTimeLoader(makeClient({ findFirst, count }));

    const result = await loader.loadTeamStats({
      teamId: "t1",
      seasonId: "s1",
      competitionCode: "UCL",
      asOf: ASOF,
    });

    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(result).not.toEqual(primary);
  });

  it("national team competition: uses cross-comp alone when no primary exists (tournament start)", async () => {
    const cross = statsRow(0.4);
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null) // no in-tournament stats yet
      .mockResolvedValueOnce(cross);
    const count = vi.fn().mockResolvedValue(0);
    const loader = new PointInTimeLoader(makeClient({ findFirst, count }));

    const result = await loader.loadTeamStats({
      teamId: "t1",
      seasonId: "s1",
      competitionCode: "WC",
      asOf: ASOF,
    });

    expect(result).toEqual(cross);
  });
});

describe("PointInTimeLoader.loadH2HLegs / loadH2HScore", () => {
  function makeFixtureClient(rows: unknown[]): PrismaClient {
    const findMany = vi.fn().mockResolvedValue(rows);
    return { fixture: { findMany } } as unknown as PrismaClient;
  }

  it("drops legs with a null score (unsettled/void fixtures slipping through the status filter)", async () => {
    const loader = new PointInTimeLoader(
      makeFixtureClient([
        {
          homeTeamId: "h",
          awayTeamId: "a",
          homeScore: 2,
          awayScore: 1,
        },
        {
          homeTeamId: "h",
          awayTeamId: "a",
          homeScore: null,
          awayScore: null,
        },
      ]),
    );

    const legs = await loader.loadH2HLegs({
      homeTeamId: "h",
      awayTeamId: "a",
      asOf: ASOF,
    });

    expect(legs).toHaveLength(1);
  });

  it("loadH2HScore returns null below the minimum sample, same as computeH2HScoreFromLegs", async () => {
    const loader = new PointInTimeLoader(
      makeFixtureClient([
        { homeTeamId: "h", awayTeamId: "a", homeScore: 1, awayScore: 0 },
      ]),
    );

    const score = await loader.loadH2HScore({
      homeTeamId: "h",
      awayTeamId: "a",
      favoriteTeamId: "h",
      asOf: ASOF,
    });

    expect(score).toBeNull();
  });
});

describe("PointInTimeLoader.loadCongestionScore", () => {
  it("scores 0 for two fully rested teams with no upcoming fixtures", async () => {
    const findFirst = vi.fn().mockResolvedValue(null); // no last-played fixture
    const count = vi.fn().mockResolvedValue(0); // no upcoming fixtures
    const loader = new PointInTimeLoader({
      fixture: { findFirst, count },
    } as unknown as PrismaClient);

    const score = await loader.loadCongestionScore({
      homeTeamId: "h",
      awayTeamId: "a",
      asOf: ASOF,
    });

    expect(score).toBe(0);
    // One findFirst + one count per side.
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(count).toHaveBeenCalledTimes(2);
  });

  it("scores higher for a team that played same-day and has 3+ upcoming fixtures", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ scheduledAt: ASOF }) // home: played same day
      .mockResolvedValueOnce(null); // away: fully rested
    const count = vi
      .fn()
      .mockResolvedValueOnce(3) // home: congested schedule
      .mockResolvedValueOnce(0); // away: nothing upcoming
    const loader = new PointInTimeLoader({
      fixture: { findFirst, count },
    } as unknown as PrismaClient);

    const score = await loader.loadCongestionScore({
      homeTeamId: "h",
      awayTeamId: "a",
      asOf: ASOF,
    });

    // home = 1 (max congestion), away = 0 → average 0.5.
    expect(score).toBeCloseTo(0.5, 10);
  });
});
