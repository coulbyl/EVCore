export type CompetitionGroup<T> = {
  key: string;
  items: T[];
};

// Client-side grouping over an already-fetched day's data — no new API call.
// Sorted alphabetically by competition name so the section order is stable
// across re-renders (not tied to fetch order).
export function groupByCompetition<T>(
  items: T[],
  getKey: (item: T) => string,
): CompetitionGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()]
    .map(([key, groupItems]) => ({ key, items: groupItems }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
