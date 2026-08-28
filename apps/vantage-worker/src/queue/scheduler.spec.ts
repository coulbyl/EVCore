import { describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import type { Queue } from "bullmq";
import type { Config } from "../config";
import { runSweep } from "./scheduler";
import type { AnalyzeJobData, SweepJobData } from "./queue";

vi.mock("./find-eligible-fixtures", () => ({
  findEligibleFixtureIds: vi.fn().mockResolvedValue(["fixture-1", "fixture-2"]),
}));

const noopLogger = { info: vi.fn() } as unknown as Logger;
const dummyConfig = { sweepIntervalMs: 300_000 } as Config;

describe("runSweep", () => {
  it("enqueues one job per eligible fixture with a colon-free jobId", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const queue = { add } as unknown as Queue<AnalyzeJobData | SweepJobData>;

    const count = await runSweep(queue, dummyConfig, noopLogger);

    expect(count).toBe(2);
    expect(add).toHaveBeenCalledTimes(2);
    for (const call of add.mock.calls) {
      const [name, data, opts] = call as [
        string,
        AnalyzeJobData,
        { jobId?: string },
      ];
      expect(name).toBe("analyze");
      // BullMQ rejects any custom jobId containing ":" — this is exactly
      // the bug that silently failed every sweep in prod (jobId:
      // `analyze:${fixtureId}`) until it was caught by log inspection,
      // not by a test. Guard it here so it can't regress unnoticed again.
      expect(opts.jobId).toBeDefined();
      expect(opts.jobId).not.toContain(":");
      expect(opts.jobId).toBe(`analyze-${data.fixtureId}`);
    }
  });

  it("bounds completed/failed job retention by age, not just count — regression: a fixed jobId + count-only retention let BullMQ silently swallow every re-add for a fixture stuck on a non-persisting outcome (incident 2026-08-28)", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const queue = { add } as unknown as Queue<AnalyzeJobData | SweepJobData>;

    await runSweep(queue, dummyConfig, noopLogger);

    for (const call of add.mock.calls) {
      const [, , opts] = call as [
        string,
        AnalyzeJobData,
        {
          removeOnComplete?: { age?: number; count?: number };
          removeOnFail?: { age?: number; count?: number };
        },
      ];
      // Age bound must be roughly one sweep interval — long enough for
      // dashboard visibility, short enough that the *next* sweep can
      // actually retry a fixture whose jobId is still otherwise claimed.
      expect(opts.removeOnComplete?.age).toBe(300);
      expect(opts.removeOnFail?.age).toBe(300);
    }
  });
});
