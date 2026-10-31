type Entry<T> = {
  /** When the current read started: its answer is fresh for the TTL. */
  at: number;
  /** The last answer, served while a fresh read runs. */
  answer?: Promise<T>;
  inFlight?: Promise<T>;
};

/**
 * Reads that every player shares (a screen with nothing personal in it):
 * one read per key in flight at a time, its answer served for `ttlMs`, then
 * still served while one fresh read runs in the background. A key unread for
 * `keepMs` is forgotten, its next reader waits; past `maxKeys` (a free-text
 * search makes keys), the oldest key goes first. A failed read is never kept:
 * the next request tries again, the last answer staying served meanwhile.
 *
 * In memory: the backend runs as one process (as SessionCache).
 */
export class SharedReads<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly options: {
      ttlMs: number;
      keepMs: number;
      maxKeys: number;
    },
  ) {}

  get(key: string, read: () => Promise<T>, now = Date.now()): Promise<T> {
    for (const [stale, entry] of this.entries) {
      if (now - entry.at >= this.options.keepMs) this.entries.delete(stale);
    }
    const entry = this.entries.get(key);
    if (entry && (entry.inFlight || now - entry.at < this.options.ttlMs)) {
      return (entry.answer ?? entry.inFlight) as Promise<T>;
    }
    const inFlight = read();
    const next: Entry<T> = { at: now, answer: entry?.answer, inFlight };
    // Re-inserted last: the map's order is the age order the cap evicts by.
    this.entries.delete(key);
    this.entries.set(key, next);
    if (this.entries.size > this.options.maxKeys) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    inFlight.then(
      (value) => {
        next.answer = Promise.resolve(value);
        next.inFlight = undefined;
      },
      () => {
        next.inFlight = undefined;
        if (!next.answer) {
          if (this.entries.get(key) === next) this.entries.delete(key);
          return;
        }
        // The last answer stays served, still stale: the next request
        // tries a fresh read again.
        if (entry) next.at = entry.at;
      },
    );
    return next.answer ?? inFlight;
  }
}
