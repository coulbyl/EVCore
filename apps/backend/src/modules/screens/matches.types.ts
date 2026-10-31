import type { MatchesDay } from './dto/matches-query.dto';
import type { TodayTeam } from './today.types';

/** The match's own state, not the reading's. */
export type MatchState = 'upcoming' | 'live' | 'finished' | 'postponed';

/** « Victoire Arsenal · 7 sur 10 » (06 § 1): one reading per match. */
export type MatchReading = {
  market: string;
  pick: string;
  /** The 1xBet price; a reading always has one. */
  odds: number;
  /**
   * The engine's probability up to ENGINE_CHANCE_MAX_ODDS, the market's
   * frequency without margin above (06 § 2).
   */
  chance: number;
  /** Settled reading (Hier): its mark; null until then. */
  result: 'won' | 'lost' | 'void' | null;
};

/**
 * Why a match has no reading, folded at the bottom of the day:
 * « Écarté », « Pas coté chez 1xBet », « Pas de lecture », and for
 * tomorrow before the evening analysis « Lecture ce soir ».
 */
export type MatchWithoutReading =
  | 'rejected'
  | 'not_priced'
  | 'not_analysed'
  | 'tonight';

export type MatchItem = {
  fixtureId: string;
  kickoffAt: string;
  state: MatchState;
  score: { home: number; away: number } | null;
  /**
   * `big`: one of the big competitions (MATCHES_LEAGUE_PRIORITY), for the
   * « Grands championnats » chip.
   */
  competition: { code: string; name: string; big: boolean };
  home: TodayTeam;
  away: TodayTeam;
  reading: MatchReading | null;
  withoutReading: MatchWithoutReading | null;
};

/** GET /matches?day=: one page of the day, in screen order. */
export type MatchesScreen = {
  day: MatchesDay;
  /** The day shown (UTC, Abidjan time), YYYY-MM-DD. */
  date: string;
  items: MatchItem[];
  /** Pass back as `cursor` for the next page; null on the last one. */
  nextCursor: string | null;
};
