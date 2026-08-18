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
