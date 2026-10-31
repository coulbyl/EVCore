// In-memory session cache (docs/refonte-ui/16-performance-et-qualite.md § 2:
// one session read per request at most, cached 60 s). Every write to a user
// or a session invalidates that user's entries, so the TTL only bounds how
// long a change made outside this process (none today) could go unseen.
export const SESSION_CACHE_TTL_MS = 60_000;

// Beyond this many live entries the oldest is dropped. One entry per signed-in
// device seen in the last minute: far above current traffic.
export const SESSION_CACHE_MAX_ENTRIES = 10_000;
