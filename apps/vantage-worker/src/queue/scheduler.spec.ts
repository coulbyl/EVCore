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
const dummyConfig = {} as Config;

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
});
