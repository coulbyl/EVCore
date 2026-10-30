import Decimal from 'decimal.js';
import {
  ENGINE_CHANCE_MAX_ODDS,
  READING_SPEAKING_PICKS,
  READING_SPEAKING_TOLERANCE,
  TOMORROW_READINGS_UNTIL_HOUR_UTC,
} from '@config/screens.constants';
import { MIN_LEG_ODDS } from '@modules/coupon/coupon.constants';
import {
  playableQuoteKey,
  type PlayableQuote,
} from '@modules/betting-engine/pricing/playable-odds.repository';
import type { MatchesDay } from './dto/matches-query.dto';
import type { MatchRow, ReadingCandidateRow } from './matches.repository';
import type {
  MatchReading,
  MatchState,
  MatchWithoutReading,
} from './matches.types';

/**
 * The reading of a match, shared by the list (GET /matches) and the sheet
 * (GET /matches/:id/sheet): one rule, one answer on both screens.
 */

export function stateOf(row: MatchRow, now: Date): MatchState {
  if (row.status === 'FINISHED') return 'finished';
  if (row.status === 'POSTPONED' || row.status === 'CANCELLED') {
    return 'postponed';
  }
  if (row.status === 'IN_PROGRESS') return 'live';
  return row.scheduledAt.getTime() <= now.getTime() ? 'live' : 'upcoming';
}

/**
 * The one reading of a match (06 § 1, § 2, § 8): among the engine's picks of
 * its latest analysis that 1xBet prices at MIN_LEG_ODDS or more, the best
 * speaking pick (who wins, double chance, over/under 2.5) when its chance is
 * within READING_SPEAKING_TOLERANCE of the best chance, the best chance
 * otherwise. The chance is the engine's up to ENGINE_CHANCE_MAX_ODDS and the
 * market's frequency above; a pick above the threshold without that
 * frequency is left out rather than shown with the engine's.
 */
export function readingOf(input: {
  candidates: readonly ReadingCandidateRow[];
  quotes: Map<string, PlayableQuote>;
  day: MatchesDay;
  now: Date;
}): { reading: MatchReading } | { without: MatchWithoutReading } {
  const { candidates } = input;
  if (candidates.length === 0) {
    const tonight =
      input.day === 'tomorrow' &&
      input.now.getUTCHours() < TOMORROW_READINGS_UNTIL_HOUR_UTC;
    return { without: tonight ? 'tonight' : 'not_analysed' };
  }
  if (candidates.some((c) => c.avoided)) return { without: 'rejected' };

  const picks = candidates.flatMap((c) =>
    c.market !== null && c.pick !== null && c.probability !== null
      ? [{ ...c, market: c.market, pick: c.pick, probability: c.probability }]
      : [],
  );
  type Choice = { reading: MatchReading; chance: Decimal };
  let best: Choice | null = null;
  let bestSpeaking: Choice | null = null;
  let priced = false;
  for (const pick of picks) {
    const quote = input.quotes.get(
      playableQuoteKey({
        fixtureId: pick.fixtureId,
        market: pick.market,
        pick: pick.pick,
      }),
    );
    if (quote?.operatorOdds == null) continue;
    priced = true;
    if (quote.operatorOdds < MIN_LEG_ODDS) continue;
    const chance =
      quote.operatorOdds > ENGINE_CHANCE_MAX_ODDS
        ? quote.operatorFairProbability === null
          ? null
          : new Decimal(quote.operatorFairProbability)
        : new Decimal(pick.probability.toString());
    if (chance === null) continue;
    const choice: Choice = {
      chance,
      reading: {
        market: pick.market,
        pick: pick.pick,
        odds: quote.operatorOdds,
        chance: chance.toDecimalPlaces(4).toNumber(),
        result: resultOf(pick.result),
      },
    };
    if (!best || chance.gt(best.chance)) best = choice;
    if (isSpeaking(pick) && (!bestSpeaking || chance.gt(bestSpeaking.chance))) {
      bestSpeaking = choice;
    }
  }
  if (
    best &&
    bestSpeaking &&
    best.chance.minus(bestSpeaking.chance).lte(READING_SPEAKING_TOLERANCE)
  ) {
    best = bestSpeaking;
  }
  if (best) return { reading: best.reading };
  return { without: picks.length > 0 && !priced ? 'not_priced' : 'rejected' };
}

/** Who wins, double chance, over/under 2.5: a reading a player reads. */
function isSpeaking(pick: { market: string; pick: string }): boolean {
  if (!(pick.market in READING_SPEAKING_PICKS)) return false;
  const picks = READING_SPEAKING_PICKS[pick.market];
  return picks == null || picks.includes(pick.pick);
}

export function resultOf(
  result: ReadingCandidateRow['result'],
): MatchReading['result'] {
  if (result === 'WON') return 'won';
  if (result === 'LOST') return 'lost';
  if (result === 'VOID') return 'void';
  return null;
}

export function uniqueKeys(
  candidates: readonly ReadingCandidateRow[],
): { fixtureId: string; market: string; pick: string }[] {
  const keys = new Map<
    string,
    { fixtureId: string; market: string; pick: string }
  >();
  for (const c of candidates) {
    if (c.market === null || c.pick === null) continue;
    const key = { fixtureId: c.fixtureId, market: c.market, pick: c.pick };
    keys.set(playableQuoteKey(key), key);
  }
  return [...keys.values()];
}

export function groupBy<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}
