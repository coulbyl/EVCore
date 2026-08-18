import { describe, it, expect, vi } from "vitest";
import { BacktestRunner } from "./backtest-runner";
import type { PointInTimeLoader, ReplayFixture } from "./point-in-time-loader";

function fixture(): ReplayFixture {
  return {
    id: "f1",
    seasonId: "s1",
    scheduledAt: new Date("2026-08-01T15:00:00.000Z"),
    competitionCode: "PL",
    homeTeamId: "home",
    awayTeamId: "away",
    homeScore: 2,
    awayScore: 1,
  };
}

describe("BacktestRunner.run", () => {
  it("enriches each replay step with team stats, H2H and congestion, all as-of the fixture's own kickoff", async () => {
    const f = fixture();
    const homeStats = { recentForm: 0.6 } as never;
    const awayStats = { recentForm: 0.4 } as never;

    const loader = {
      listFixtures: vi.fn().mockResolvedValue([f]),
      loadOdds: vi.fn().mockResolvedValue(null),
      loadTeamStats: vi
        .fn()
        .mockResolvedValueOnce(homeStats)
        .mockResolvedValueOnce(awayStats),
      loadH2HScore: vi.fn().mockResolvedValue(0.7),
      loadCongestionScore: vi.fn().mockResolvedValue(0.2),
    } as unknown as PointInTimeLoader;

    const runner = new BacktestRunner(loader);
    const steps = [];
    for await (const step of runner.run({
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-02T00:00:00.000Z"),
    })) {
      steps.push(step);
    }

    expect(steps).toHaveLength(1);
    const [step] = steps;
    expect(step?.homeTeamStats).toEqual(homeStats);
    expect(step?.awayTeamStats).toEqual(awayStats);
    expect(step?.h2hScoreHomeReference).toBe(0.7);
    expect(step?.congestionScore).toBe(0.2);

    // Every loader call for this fixture must use ITS OWN kickoff as `asOf`.
    expect(loader.loadTeamStats).toHaveBeenNthCalledWith(1, {
      teamId: "home",
      seasonId: "s1",
      competitionCode: "PL",
      asOf: f.scheduledAt,
    });
    expect(loader.loadH2HScore).toHaveBeenCalledWith({
      homeTeamId: "home",
      awayTeamId: "away",
      favoriteTeamId: "home",
      asOf: f.scheduledAt,
    });
    expect(loader.loadCongestionScore).toHaveBeenCalledWith({
      homeTeamId: "home",
      awayTeamId: "away",
      asOf: f.scheduledAt,
    });
  });
});
