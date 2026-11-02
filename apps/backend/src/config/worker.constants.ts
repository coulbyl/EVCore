/**
 * The worker process's heartbeat (main.worker.ts): written to Redis and to
 * a local file every BEAT_MS, read by the API's GET /health/worker and by
 * the container healthcheck. A beat lives STALE_AFTER_MS: three missed
 * beats and the worker is reported down.
 */
export const WORKER_HEARTBEAT = {
  BEAT_MS: 30_000,
  STALE_AFTER_MS: 90_000,
  REDIS_KEY: 'evcore:worker:heartbeat',
  // Touched at each beat; the compose healthcheck reads its age.
  LIVENESS_FILE: '/tmp/evcore-worker-alive',
} as const;
