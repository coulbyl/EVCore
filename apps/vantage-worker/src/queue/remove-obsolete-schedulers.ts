import type { Queue } from "bullmq";

const OBSOLETE_INTRADAY_JOB_NAME = "generate-intraday-coupons";
const COUPON_JOB_NAME = "generate-coupons";

type SchedulerQueue = Pick<Queue, "getJobSchedulers" | "removeJobScheduler">;

/**
 * Retire les planifications qui ne doivent plus tirer : toutes les variantes
 * de l'ancien cron intraday, et toute passe de coupons à une autre heure que
 * `couponCron` (la passe de 20 h 30 et la reprise de 21 h 15, ENV-PROD § 3).
 *
 * Elles ont été créées avec `queue.add({ repeat })`, donc avec l'API
 * repeatable historique de BullMQ et une clé hashée qui porte le motif :
 * changer l'heure dans le code en crée une nouvelle sans retirer l'ancienne,
 * et `removeJobScheduler(jobId)` ne peut pas la trouver, le jobId applicatif
 * n'étant pas cette clé.
 */
export async function removeObsoleteSchedulers(
  queue: SchedulerQueue,
  current: { couponCron: string },
): Promise<number> {
  const schedulers = await queue.getJobSchedulers();
  const obsolete = schedulers.filter(
    (job) =>
      job.name === OBSOLETE_INTRADAY_JOB_NAME ||
      (job.name === COUPON_JOB_NAME && job.pattern !== current.couponCron),
  );

  await Promise.all(obsolete.map((job) => queue.removeJobScheduler(job.key)));
  return obsolete.length;
}
