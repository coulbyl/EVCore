// defaultLimit raised to maxLimit 2026-09-04 (TODO.md "page Matchs 2-3x plus
// lente") — each page's fixture→modelRuns→bets→channelSelection→
// channelDecision select can't collapse into a single JOIN (Prisma issues
// several batched queries per page for a filtered/take-limited nested
// relation), so halving the page count (172 fixtures ≈ 4 pages at 50 → ≈2 at
// 100) halves the sequential round-trip waterfall the frontend's
// IntersectionObserver-driven infinite scroll walks through. No new data
// exposed — 100 was already the enforced ceiling.
export const FIXTURE_SCORING_PAGINATION = {
  defaultLimit: 100,
  maxLimit: 100,
} as const;

// Support chat — "load older messages". A thread opens showing only the
// most recent page; the rest loads on demand (see support.repository.ts
// listRecentMessages/listMessagesBefore).
export const SUPPORT_MESSAGES_PAGINATION = {
  defaultLimit: 50,
  maxLimit: 100,
} as const;
