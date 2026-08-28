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

  // BullMQ dedupes `add()` by jobId regardless of the existing job's state —
  // its addStandardJob script does a plain `EXISTS` on the jobId key and, if
  // found, returns the existing job instead of creating a new one. A
  // count-only `removeOnComplete`/`removeOnFail` (the previous `500`/`1000`)
  // keeps that key around effectively forever at our volume, so a fixture
  // whose analysis ended in anything other than "persisted" — no_context,
  // skipped_no_readings, invalid_response, or an outright failure, none of
  // which write a VANTAGE ChannelDecision — stays "eligible" every sweep but
  // its jobId re-add is silently swallowed: it can never actually be
  // retried. This is what left 206 fixtures stuck with an unchanged count
  // and zero analyze-job logs for 5+ minutes straight in prod (incident
  // 2026-08-28). Bounding retention by age too means a terminal job's jobId
  // frees up again well before the next sweep, so a stuck fixture actually
  // gets retried instead of being enqueued in name only.
  const jobRetentionSeconds = Math.ceil(config.sweepIntervalMs / 1000);

  for (const fixtureId of fixtureIds) {
    await queue.add(
      "analyze",
      { fixtureId },
      {
        // BullMQ rejects a custom jobId containing ":" (it's the delimiter
        // BullMQ's own Redis keys use internally) — this literally failed
        // every sweep in prod since deploy, throwing on the first fixture
        // and never reaching the rest of the loop below.
        jobId: `analyze-${fixtureId}`,
        removeOnComplete: { age: jobRetentionSeconds, count: 500 },
        removeOnFail: { age: jobRetentionSeconds, count: 1000 },
      },
    );
  }
  logger.info({ count: fixtureIds.length }, "vantage: sweep enqueued fixtures");
  return fixtureIds.length;
}
