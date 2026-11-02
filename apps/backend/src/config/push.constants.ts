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

export type PushUrgency = 'very-low' | 'low' | 'normal' | 'high';

/** How long a push service keeps a push for an unreachable device, and its urgency. */
export type PushDeliveryPolicy = { ttlSeconds: number; urgency: PushUrgency };

const HOUR_S = 3600;

/**
 * Per kind of push. A push older than its TTL is dropped by the push
 * service instead of arriving stale when the phone comes back.
 */
export const PUSH_POLICY = {
  // Sent at 08:00 UTC: it says « today's coupons », worthless after noon.
  MORNING_BRIEF: { ttlSeconds: 4 * HOUR_S, urgency: 'normal' },
  WEEKLY_STATEMENT: { ttlSeconds: 24 * HOUR_S, urgency: 'low' },
  // Sent in the evening: still worth reading the next morning.
  FOLLOWED_SETTLED: { ttlSeconds: 12 * HOUR_S, urgency: 'normal' },
  SUPPORT_MESSAGE: { ttlSeconds: 24 * HOUR_S, urgency: 'high' },
  ANNOUNCEMENT: { ttlSeconds: 72 * HOUR_S, urgency: 'normal' },
  OPERATIONS: { ttlSeconds: 6 * HOUR_S, urgency: 'high' },
  DEFAULT: { ttlSeconds: 24 * HOUR_S, urgency: 'normal' },
} as const satisfies Record<string, PushDeliveryPolicy>;
