// HTTP layer of the API (docs/refonte-ui/16-performance-et-qualite.md § 3):
// compression, security headers, ETag and one log line per request.

// Below this size gzip costs more CPU than it saves bytes (compression's own
// default, stated here so it is a decision rather than an accident).
export const HTTP_COMPRESSION_THRESHOLD_BYTES = 1024;

// The Scalar API reference is an HTML page that runs its own scripts: it
// gets the security headers without the API's `default-src 'none'` policy.
export const API_REFERENCE_PATH = '/reference';

// The container healthcheck and the monitoring probe call these every 30 s:
// logging it would bury the requests that matter.
export const REQUEST_LOG_SKIPPED_PATHS: readonly string[] = [
  '/health',
  '/health/worker',
];

// Enough of the session row id to follow one visitor through the log
// without writing a full identifier. The id is not the cookie token.
export const REQUEST_LOG_SESSION_PREFIX_LENGTH = 8;

/** The event-loop delay line of each process (EventLoopMonitor). */
export const EVENT_LOOP_MONITOR = {
  // Sampling: a stall shorter than this is not seen.
  RESOLUTION_MS: 20,
  REPORT_MS: 60_000,
  // A screen read answers in tens of ms: a stall past this is worth a warn.
  WARN_MS: 200,
} as const;
