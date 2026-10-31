import type { MatchState, MatchWithoutReading } from './matches.types';
import type { TodayTeam } from './today.types';

/** A pick shown on the sheet, with its 1xBet price and its chance. */
export type SheetPick = {
  market: string;
  pick: string;
  /** The 1xBet price; null when 1xBet does not price it. */
  odds: number | null;
  /** In [0, 1]; null when unknown (06 § 2, « Les chances affichées »). */
  chance: number | null;
  /** Once the match is over: did it land. */
  result: 'won' | 'lost' | 'void' | null;
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
  /** One clean line, 90 characters at most, or nothing (06 § 2). */
  sentence: string | null;
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
  form: { home: SheetTeamForm; away: SheetTeamForm };
  /** « 4 victoires d'Arsenal sur les 6 derniers », or null. */
  headToHead: string | null;
  /** The main 1xBet lines and the engine's other picks, market chance. */
  otherPicks: SheetPick[];
  /** « 1xBet prend 7 % sur ce match »: its 1X2 margin, or null. */
  operatorMargin: number | null;
};
