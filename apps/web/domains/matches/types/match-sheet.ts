import type { TodayTeam } from "@/domains/today/types/today";
import type { MatchState, MatchWithoutReading } from "./matches";

/** Mirror of apps/backend screens/match-sheet.types.ts. */
export type SheetPick = {
  market: string;
  pick: string;
  /** The 1xBet price; null when 1xBet does not price it. */
  odds: number | null;
  /** In [0, 1]; null when unknown. */
  chance: number | null;
  result: "won" | "lost" | "void" | null;
};

export type SheetReading = SheetPick & { fact: string | null };

export type SheetAiOpinion = SheetPick & {
  sameAsReading: boolean;
  /** The AI's text, whole, opened from its pick. */
  speech: string | null;
  /** When it decided, ISO. */
  decidedAt: string;
};

export type SheetTeamForm = {
  /** Oldest first. */
  last: ("won" | "drawn" | "lost")[];
  restDays: number | null;
};

/** GET /matches/:id/sheet (06 § 2–4). */
export type MatchSheet = {
  fixtureId: string;
  kickoffAt: string;
  state: MatchState;
  score: { home: number; away: number } | null;
  halfTimeScore: { home: number; away: number } | null;
  competition: { code: string; name: string };
  home: TodayTeam;
  away: TodayTeam;
  reading: SheetReading | null;
  withoutReading: MatchWithoutReading | null;
  /** Why a set-aside match has no reading (06 § 4–5). */
  setAsideReason: "divergence" | "low_odds" | "suspended" | "not_sure" | null;
  ai: SheetAiOpinion | null;
  form: { home: SheetTeamForm; away: SheetTeamForm };
  headToHead: string | null;
  otherPicks: SheetPick[];
};
