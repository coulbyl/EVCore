import type { Queue } from "bullmq";

const OBSOLETE_INTRADAY_JOB_NAME = "generate-intraday-coupons";

type SchedulerQueue = Pick<Queue, "getJobSchedulers" | "removeJobScheduler">;

/**
 * Retire toutes les variantes de l'ancien cron intraday.
 *
 * Il a été créé avec `queue.add({ repeat })`, donc avec l'API repeatable
 * historique de BullMQ et une clé hashée. Le supprimer via
 * `removeJobScheduler(jobId)` ne peut pas fonctionner : le jobId applicatif
 * n'est pas cette clé, et le cron pouvait en plus être surchargé en prod.
 */
export async function removeObsoleteIntradaySchedulers(
  queue: SchedulerQueue,
): Promise<number> {
  const schedulers = await queue.getJobSchedulers();
  const obsolete = schedulers.filter(
    (job) => job.name === OBSOLETE_INTRADAY_JOB_NAME,
  );

  await Promise.all(obsolete.map((job) => queue.removeJobScheduler(job.key)));
  return obsolete.length;
}
