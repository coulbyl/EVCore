/**
 * Web push, delivered through a queue consumed by the worker process
 * (PushDeliveryWorker): one job per subscribed device, so a retry never
 * reaches the others again. A push service answering 429 or 5xx is tried
 * again, spaced out; 404/410 means the subscription is gone and it is
 * deleted. Not paused by « Passes planifiées »: a team reply still goes
 * out during an incident.
 */
export const PUSH_DELIVERY = {
  QUEUE: 'push-delivery',
  JOB: 'deliver',
  CONCURRENCY: 10,
  ATTEMPTS: 5,
  // 30 s, 1 min, 2 min, 4 min: a push service back within ten minutes.
  BACKOFF_MS: 30_000,
  KEEP_COMPLETED: 1000,
  KEEP_FAILED: 1000,
} as const;
