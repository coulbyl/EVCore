import type { CompetitionGroup } from "./group-by-competition";

// Chronological grouping by kickoff time — `kickoff` arrives already
// formatted "HH:mm" server-side (zero-padded 24h), so a plain string sort is
// already chronological, no Date parsing needed. Replaces the flat list as
// the Decisions page's default view: kickoff used to be buried in a muted
// metadata line inside each card (2026-08 UX audit finding).
export function groupByHour<T>(
  items: readonly T[],
  getKickoff: (item: T) => string,
): CompetitionGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKickoff(item);
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()]
    .map(([key, groupItems]) => ({ key, items: groupItems }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
