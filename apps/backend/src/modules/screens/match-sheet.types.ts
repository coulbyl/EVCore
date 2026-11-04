import type { MatchState, MatchWithoutReading } from './matches.types';
import type { TodayTeam } from './today.types';

/** A pick shown on the sheet, with its price and its chance. */
export type SheetPick = {
  market: string;
  pick: string;
  /**
   * The line of a market that keeps it apart from `pick` (corners, cards,
   * player shots: at least N, 1X2 at a minute: the minute); null otherwise.
   * Shown as the book prices it, never rounded.
   */
  line: number | null;
  /** The player a scorer or shots bet names; null for any other bet. */
  player: string | null;
  /**
   * The 1xBet price; for the markets of SHEET_NEW_MARKETS, another book's
   * when 1xBet does not price it (never named). Null when unpriced.
   */
  odds: number | null;
  /** In [0, 1]; null when unknown (06 § 2, « Les chances affichées »). */
  chance: number | null;
  /** Once the match is over: did it land; null while unknown. */
  result: 'won' | 'lost' | 'void' | null;
  /**
   * « Mon ticket » can take it: priced at 1xBet and settled on the score.
   * Not the markets of SHEET_NEW_MARKETS: the ticket keeps no line, prices
   * at 1xBet only and settles on the score alone.
   */
  addable: boolean;
};

/** « Notre lecture »: the same pick as the list, with its fact. */
export type SheetReading = SheetPick & {
  /** One sentence about the bet (04 § 1), or null. */
  fact: string | null;
};

/**
 * « Avis IA » (06 § 7): one more pick, never framed as agreeing or not.
 * Its chance is the market's frequency, as for « Autres paris ».
 */
export type SheetAiOpinion = SheetPick & {
  /** The AI played the same pick as our reading. */
  sameAsReading: boolean;
  /** Its text, whole, opened from its pick, or nothing (06 § 2). */
  speech: string | null;
  /** When it decided, ISO: « Décidé le 31/10 à 13:41 ». */
  decidedAt: string;
};

/**
 * The AI looked at the match and would not bet: its opinion on the match,
 * without a pick (v6 texts only; earlier ones narrate its rules).
 */
export type SheetAiAbstention = {
  speech: string;
  /** When it decided, ISO. */
  decidedAt: string;
};

export type SheetTeamForm = {
  /** Last results, oldest first, all competitions. */
  last: ('won' | 'drawn' | 'lost')[];
  /** Days since the team's previous match, or null without one. */
  restDays: number | null;
};

/**
 * The engine's codes brought to four reasons a player reads (06 § 5), most
 * telling first: the model and the market disagree too much (AVOID), the
 * picks are priced under the floor at 1xBet, the market is suspended, and
 * « aucune chance assez sûre » for every other code.
 */
export type SetAsideReason =
  | 'divergence'
  | 'low_odds'
  | 'suspended'
  | 'not_sure';

/** A goal of a finished match, under the score: « 45+1' Gyökeres (p.) ». */
export type SheetScorer = {
  minute: number;
  /** Stoppage time: the 1 of 45+1. */
  extraMinute: number | null;
  player: string;
  /** The side the goal counts for (an own goal counts for the other team). */
  team: 'home' | 'away';
  kind: 'goal' | 'penalty' | 'own';
};

/** A player sent off, with the side he played for. */
export type SheetRedCard = {
  minute: number;
  extraMinute: number | null;
  player: string;
  team: 'home' | 'away';
};

/** GET /matches/:id/sheet: the player's match sheet (06 § 2–4). */
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
  /**
   * A set-aside match (`withoutReading` « rejected »): why, for one line in
   * the player's words (06 § 4–5). Null otherwise.
   */
  setAsideReason: SetAsideReason | null;
  /** Null: « Pas d'avis ». */
  ai: SheetAiOpinion | null;
  /** The AI's no-bet opinion, when it has no pick on the match. */
  aiAbstention: SheetAiAbstention | null;
  form: { home: SheetTeamForm; away: SheetTeamForm };
  /** « 4 victoires d'Arsenal sur les 6 derniers », or null. */
  headToHead: string | null;
  /**
   * The main 1xBet lines, the engine's other picks, then the new markets
   * (SHEET_NEW_MARKETS), market chance.
   */
  otherPicks: SheetPick[];
  /**
   * A finished match's goals, by minute. Null before the end, and when its
   * events are not in or do not add up to the score (unknown, never wrong).
   */
  scorers: SheetScorer[] | null;
  /** A finished match's red cards; null whenever `scorers` is. */
  redCards: SheetRedCard[] | null;
};
