import type { Queue } from "bullmq";

const OBSOLETE_INTRADAY_JOB_NAME = "generate-intraday-coupons";

/**
 * The two recurring passes, as job schedulers (BullMQ's upsertJobScheduler,
 * which BullMQ 6 requires): one fixed key each, so changing the interval or
 * the hour updates the same scheduler instead of adding one.
 */
export const VANTAGE_SCHEDULERS = {
  sweep: { id: "vantage-recurring-sweep", jobName: "sweep" },
  coupons: {
    id: "vantage-recurring-coupon-generation",
    jobName: "generate-coupons",
  },
} as const;

const SCHEDULED_JOB_IDS = new Map<string, string>(
  Object.values(VANTAGE_SCHEDULERS).map((s) => [s.jobName, s.id]),
);

type SchedulerQueue = Pick<Queue, "getJobSchedulers" | "removeJobScheduler">;

/**
 * Retire les planifications qui ne doivent plus tirer : toutes les variantes
 * de l'ancien cron intraday, et toute passe `sweep` ou `generate-coupons`
 * qui n'est pas son planificateur à clé fixe (VANTAGE_SCHEDULERS) — les
 * anciennes répétitions posées par `queue.add({ repeat })`, dont la clé
 * hachée porte le motif : la passe de 20 h 30, la reprise de 21 h 15
 * (ENV-PROD § 3), et les deux répétitions d'avant le passage aux
 * planificateurs (02/11), qui sinon tireraient en double.
 */
export async function removeObsoleteSchedulers(
  queue: SchedulerQueue,
): Promise<number> {
  const schedulers = await queue.getJobSchedulers();
  const obsolete = schedulers.filter((job) => {
    if (job.name === OBSOLETE_INTRADAY_JOB_NAME) return true;
    const id = SCHEDULED_JOB_IDS.get(job.name ?? "");
    return id !== undefined && job.key !== id;
  });

  await Promise.all(obsolete.map((job) => queue.removeJobScheduler(job.key)));
  return obsolete.length;
}
