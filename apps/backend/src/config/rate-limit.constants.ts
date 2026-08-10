// Brute-force / credential-stuffing mitigation on POST /auth/login (doc
// perf-ux-audit §11.2) — tracked per client IP by @nestjs/throttler.
export const AUTH_LOGIN_RATE_LIMIT = {
  limit: 5,
  ttlMs: 60_000,
} as const;
