import type { MatchClock, MatchCorners } from "@/helpers/scoreboard-format";
import type { TodayTeam } from "@/domains/today/types/today";
import type { MatchState, MatchWithoutReading } from "./matches";

/** Mirror of apps/backend screens/match-sheet.types.ts. */
export type SheetPick = {
  market: string;
  pick: string;
  /** The line kept apart from `pick` (corners, cards, shots, minute). */
  line: number | null;
  /** The player a scorer or shots bet names. */
  player: string | null;
  /**
   * The 1xBet price; for the new markets, another book's when 1xBet does
   * not price it (never named). Null when unpriced.
   */
  odds: number | null;
  /** In [0, 1]; null when unknown. */
  chance: number | null;
  /** Null while unknown: never shown as lost. */
  result: "won" | "lost" | "void" | null;
};

export type SheetReading = SheetPick & { fact: string | null };

export type SheetAiOpinion = SheetPick & {
  sameAsReading: boolean;
  /** Another pick that one final score makes win with our reading. */
  passesWithReading: boolean;
  /** The AI's text, whole, opened from its pick. */
  speech: string | null;
  /** When it decided, ISO. */
  decidedAt: string;
};

/** The AI's no-bet opinion on the match. */
export type SheetAiAbstention = {
  speech: string;
  /** When it decided, ISO. */
  decidedAt: string;
};

export type SheetTeamForm = {
  /** Oldest first. */
  last: ("won" | "drawn" | "lost")[];
  restDays: number | null;
};

/** A goal of a finished match: « 45+1' Gyökeres (p.) ». */
export type SheetScorer = {
  minute: number;
  extraMinute: number | null;
  player: string;
  /** The side the goal counts for (an own goal counts for the other team). */
  team: "home" | "away";
  kind: "goal" | "penalty" | "own";
};

export type SheetRedCard = {
  minute: number;
  extraMinute: number | null;
  player: string;
  team: "home" | "away";
};

/** GET /matches/:id/sheet (06 § 2–4). */
export type MatchSheet = {
  fixtureId: string;
  kickoffAt: string;
  state: MatchState;
  score: { home: number; away: number } | null;
  /** « 67' », « MT » while played. */
  clock: MatchClock | null;
  halfTimeScore: { home: number; away: number } | null;
  /** A finished match's corners; null before the end. */
  corners: MatchCorners | null;
  competition: { code: string; name: string };
  home: TodayTeam;
  away: TodayTeam;
  reading: SheetReading | null;
  withoutReading: MatchWithoutReading | null;
  /** Why a set-aside match has no reading (06 § 4–5). */
  setAsideReason: "divergence" | "low_odds" | "suspended" | "not_sure" | null;
  ai: SheetAiOpinion | null;
  aiAbstention: SheetAiAbstention | null;
  form: { home: SheetTeamForm; away: SheetTeamForm };
  headToHead: string | null;
  otherPicks: SheetPick[];
  /** A finished match's goals by minute; null when unknown or not over. */
  scorers: SheetScorer[] | null;
  redCards: SheetRedCard[] | null;
};
