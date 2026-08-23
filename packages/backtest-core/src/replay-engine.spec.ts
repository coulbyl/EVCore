import { describe, it, expect, vi } from "vitest";
import { ReplayEngine } from "./replay-engine";
import type { PointInTimeLoader, ReplayFixture } from "./point-in-time-loader";

function fixture(overrides: Partial<ReplayFixture> = {}): ReplayFixture {
  return {
    id: "f1",
    seasonId: "season-1",
    scheduledAt: new Date("2026-08-01T15:00:00.000Z"),
    competitionCode: "PL",
    homeTeamId: "home",
    awayTeamId: "away",
    homeScore: 2,
    awayScore: 1,
    ...overrides,
  };
}

describe("ReplayEngine.replay", () => {
  it("walks fixtures chronologically, resolving odds as-of each fixture's own kickoff", async () => {
    const f1 = fixture({
      id: "f1",
      scheduledAt: new Date("2026-08-01T15:00:00.000Z"),
    });
    const f2 = fixture({
      id: "f2",
      scheduledAt: new Date("2026-08-02T15:00:00.000Z"),
    });
    const listFixtures = vi.fn().mockResolvedValue([f1, f2]);
    const loadOdds = vi.fn().mockResolvedValue(null);
    const loader = { listFixtures, loadOdds } as unknown as PointInTimeLoader;

    const engine = new ReplayEngine(loader);
    const steps = [];
    for await (const step of engine.replay({
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-03T00:00:00.000Z"),
    })) {
      steps.push(step);
    }

    expect(steps).toHaveLength(2);
    expect(steps[0]?.fixture.id).toBe("f1");
    expect(steps[0]?.context.asOf).toEqual(f1.scheduledAt);
    expect(steps[1]?.fixture.id).toBe("f2");
    expect(steps[1]?.context.asOf).toEqual(f2.scheduledAt);

    // Each fixture's odds are resolved as-of THAT fixture's own kickoff, not
    // a shared cutoff — the whole point of walking chronologically.
    expect(loadOdds).toHaveBeenNthCalledWith(1, "f1", { asOf: f1.scheduledAt });
    expect(loadOdds).toHaveBeenNthCalledWith(2, "f2", { asOf: f2.scheduledAt });
  });

  it("yields nothing for an empty replay universe", async () => {
    const loader = {
      listFixtures: vi.fn().mockResolvedValue([]),
      loadOdds: vi.fn(),
    } as unknown as PointInTimeLoader;

    const engine = new ReplayEngine(loader);
    const steps = [];
    for await (const step of engine.replay({
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-03T00:00:00.000Z"),
    })) {
      steps.push(step);
    }

    expect(steps).toEqual([]);
  });
});
