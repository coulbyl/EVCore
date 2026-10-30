import type { TodayTeam } from "@/domains/today/types/today";

/** Mirror of apps/backend screens/matches.types.ts (GET /matches). */
export const MATCHES_DAYS = ["yesterday", "today", "tomorrow"] as const;
export type MatchesDay = (typeof MATCHES_DAYS)[number];

export type MatchState = "upcoming" | "live" | "finished" | "postponed";

/** « Victoire Arsenal · 7 sur 10 » (06 § 1): one reading per match. */
export type MatchReading = {
  market: string;
  pick: string;
  odds: number;
  /** In [0, 1]. */
  chance: number;
  result: "won" | "lost" | "void" | null;
};

export type MatchWithoutReading =
  | "rejected"
  | "not_priced"
  | "not_analysed"
  | "tonight";

export type MatchItem = {
  fixtureId: string;
  kickoffAt: string;
  state: MatchState;
  score: { home: number; away: number } | null;
  competition: { code: string; name: string };
  home: TodayTeam;
  away: TodayTeam;
  reading: MatchReading | null;
  withoutReading: MatchWithoutReading | null;
};

export type MatchesScreen = {
  day: MatchesDay;
  date: string;
  items: MatchItem[];
  nextCursor: string | null;
};
