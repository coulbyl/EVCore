// "Grands championnats" — always shown as chips when present in the day's
// data, everything else lives behind the "Plus" search. Same curated list
// VANTAGE's situational-research scope defaults to
// (apps/vantage-worker/src/config.ts DEFAULT_RESEARCH_COMPETITION_CODES),
// kept in sync deliberately: it's the set of leagues a human is expected to
// actually read closely across the product, not just here.
export const PINNED_LEAGUE_CODES = [
  "PL",
  "LL",
  "BL1",
  "SA",
  "L1",
  "UCL",
  "UEL",
  "UECL",
] as const;

export type LeagueOption = {
  code: string;
  name: string;
  country: string | null;
  count: number;
};

// Derived from whatever the day's already-fetched dataset contains — no
// separate request, so switching leagues (or discovering one via "Plus") is
// instant and the list never offers a league with zero matches today.
export function deriveLeagueOptions<T>(
  items: readonly T[],
  getCompetition: (item: T) => {
    code: string | null;
    name: string | null;
    country: string | null;
  },
): LeagueOption[] {
  const byCode = new Map<string, LeagueOption>();
  for (const item of items) {
    const { code, name, country } = getCompetition(item);
    if (!code) continue;
    const existing = byCode.get(code);
    if (existing) {
      existing.count += 1;
      continue;
    }
    byCode.set(code, { code, name: name ?? code, country, count: 1 });
  }
  return [...byCode.values()];
}

export function filterByLeague<T>(
  items: readonly T[],
  selectedCode: string | null,
  getCode: (item: T) => string | null,
): T[] {
  if (!selectedCode) return [...items];
  return items.filter((item) => getCode(item) === selectedCode);
}
