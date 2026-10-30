// Brute-force / credential-stuffing mitigation on POST /auth/login (doc
// perf-ux-audit §11.2) — tracked per client IP by @nestjs/throttler.
export const AUTH_LOGIN_RATE_LIMIT = {
  limit: 5,
  ttlMs: 60_000,
} as const;

// POST /auth/register: an address that already has an account gets « Cet
// e-mail a déjà un compte » (refonte 11 § 2) — a signup form cannot help
// telling — so testing a list of addresses must be slow: a handful of
// signups per address and per quarter of an hour.
export const AUTH_REGISTER_RATE_LIMIT = {
  limit: 5,
  ttlMs: 15 * 60_000,
} as const;

// App-wide floor applied to every endpoint (AppModule's APP_GUARD) — until
// now nothing stopped an authenticated user from spamming any route
// (e.g. attachment upload-url issuance) unbounded. Deliberately generous:
// this exists to stop abuse/scraping, not to throttle a dashboard doing
// normal polling — routes that need a tighter limit (login) layer their own
// stricter @Throttle on top, per-IP throttling here never replaces
// per-user/per-resource limits.
export const GLOBAL_RATE_LIMIT = {
  limit: 300,
  ttlMs: 60_000,
} as const;
