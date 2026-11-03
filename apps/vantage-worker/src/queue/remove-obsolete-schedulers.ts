import type { Queue } from "bullmq";

/**
 * Passes that no longer exist: the intraday coupons (2026-09-16) and the LLM
 * combo (2026-11-03, replaced by the backend's Combiné IA). Any scheduler of
 * theirs still in Redis is removed at boot.
 */
const RETIRED_JOB_NAMES: ReadonlySet<string> = new Set([
  "generate-intraday-coupons",
  "generate-coupons",
]);

/**
 * The recurring pass, as a job scheduler (BullMQ's upsertJobScheduler,
 * which BullMQ 6 requires): one fixed key, so changing the interval updates
 * the same scheduler instead of adding one.
 */
export const VANTAGE_SCHEDULERS = {
  sweep: { id: "vantage-recurring-sweep", jobName: "sweep" },
} as const;

const SCHEDULED_JOB_IDS = new Map<string, string>(
  Object.values(VANTAGE_SCHEDULERS).map((s) => [s.jobName, s.id]),
);

type SchedulerQueue = Pick<Queue, "getJobSchedulers" | "removeJobScheduler">;

/**
 * Retire les planifications qui ne doivent plus tirer : toute passe retirée
 * (coupons intraday, combiné LLM), et toute passe `sweep` qui n'est pas son
 * planificateur à clé fixe (VANTAGE_SCHEDULERS) — les anciennes répétitions
 * posées par `queue.add({ repeat })`, qui sinon tireraient en double.
 */
export async function removeObsoleteSchedulers(
  queue: SchedulerQueue,
): Promise<number> {
  const schedulers = await queue.getJobSchedulers();
  const obsolete = schedulers.filter((job) => {
    if (RETIRED_JOB_NAMES.has(job.name ?? "")) return true;
    const id = SCHEDULED_JOB_IDS.get(job.name ?? "");
    return id !== undefined && job.key !== id;
  });

  await Promise.all(obsolete.map((job) => queue.removeJobScheduler(job.key)));
  return obsolete.length;
}
