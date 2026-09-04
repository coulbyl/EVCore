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

