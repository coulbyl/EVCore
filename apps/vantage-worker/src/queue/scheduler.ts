import type { Queue } from "bullmq";
import type { Logger } from "pino";
import type { Config } from "../config";
import { findEligibleFixtureIds } from "./find-eligible-fixtures";
import type { AnalyzeJobData, SweepJobData } from "./queue";

/** Finds fixtures VANTAGE hasn't read yet and enqueues one analysis job each.
 * Idempotent: a fixture already carrying a VANTAGE decision is never
 * re-enqueued by the sweep (analyzeFixture itself would just upsert over it
 * if it somehow were). */
export async function runSweep(
  queue: Queue<AnalyzeJobData | SweepJobData>,
  config: Config,
  logger: Logger,
): Promise<number> {
  const fixtureIds = await findEligibleFixtureIds(config);
  for (const fixtureId of fixtureIds) {
    await queue.add(
      "analyze",
      { fixtureId },
      {
        jobId: `analyze:${fixtureId}`,
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    );
  }
  logger.info({ count: fixtureIds.length }, "vantage: sweep enqueued fixtures");
  return fixtureIds.length;
}
