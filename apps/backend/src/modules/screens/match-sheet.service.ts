import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AI_SENTENCE_JARGON,
  AI_SENTENCE_MAX_LENGTH,
  READING_CHANNELS,
  SHEET_FORM_MATCHES,
  SHEET_HEAD_TO_HEAD_MEETINGS,
  SHEET_HEAD_TO_HEAD_MIN,
  SHEET_HEAD_TO_HEAD_YEARS,
  SHEET_MAIN_LINES,
} from '@config/screens.constants';
import {
  LEG_FACT_HISTORY_DAYS,
  LEG_FACT_HISTORY_MATCHES,
  LEG_FACT_MAX_LENGTH,
} from '@config/leg-fact.constants';
import {
  PlayableOddsRepository,
  playableQuoteKey,
  type PlayableQuote,
} from '@modules/betting-engine/pricing/playable-odds.repository';
import { legFact, of, type PastMatch } from '@modules/coupon/leg-fact/leg-fact';
import {
  LegFactRepository,
  type TeamMatchRow,
} from '@modules/coupon/leg-fact/leg-fact.repository';
import { startOfUtcDay } from '@utils/date.utils';
import { readingOf, resultOf, stateOf, uniqueKeys } from './matches-reading';
import {
  MatchesRepository,
  type AiOpinionRow,
  type ReadingCandidateRow,
  type SheetHeaderRow,
} from './matches.repository';
import type { MatchesDay } from './dto/matches-query.dto';
import type {
  MatchSheet,
  SheetAiOpinion,
  SheetPick,
  SheetReading,
  SheetTeamForm,
} from './match-sheet.types';
import type { MatchReading } from './matches.types';

const DAY_MS = 24 * 60 * 60 * 1000;

type Key = { market: string; pick: string };

/** A past match with its date, for the form and the rest days. */
type DatedMatch = PastMatch & { scheduledAt: Date };

/**
 * GET /matches/:id/sheet: the player's match sheet (docs/refonte-ui/06
 * § 2–4). Five SQL queries: the match and its last meetings, the engine's
 * picks, the AI's opinion, the two teams' last matches, the 1xBet prices.
 */
@Injectable()
export class MatchSheetService {
  constructor(
    private readonly repository: MatchesRepository,
    private readonly playableOdds: PlayableOddsRepository,
    private readonly history: LegFactRepository,
  ) {}

  async getSheet(
    fixtureId: string,
    now: Date = new Date(),
  ): Promise<MatchSheet> {
    const header = await this.repository.findSheetHeader({
      fixtureId,
      meetings: SHEET_HEAD_TO_HEAD_MEETINGS,
      since: new Date(now.getTime() - SHEET_HEAD_TO_HEAD_YEARS * 365 * DAY_MS),
    });
    if (!header) throw new NotFoundException('Match introuvable');
    const kickoff = header.scheduledAt;

    const [candidates, aiRows, historyRows] = await Promise.all([
      this.repository.findReadingCandidates({
        fixtureIds: [fixtureId],
        channels: READING_CHANNELS,
      }),
      this.repository.findAiOpinion(fixtureId),
      this.history.findTeamHistories({
        teamIds: [header.homeTeamId, header.awayTeamId],
        since: new Date(kickoff.getTime() - LEG_FACT_HISTORY_DAYS * DAY_MS),
        before: kickoff,
        perVenue: LEG_FACT_HISTORY_MATCHES,
      }),
    ]);
    const ai = aiRows.find((row) => row.status === 'SELECTED' && row.market);
    const quotes = await this.playableOdds.findPlayableQuotes(
      [
        ...SHEET_MAIN_LINES.map((line) => ({ fixtureId, ...line })),
        ...uniqueKeys(candidates),
        ...(ai?.market && ai.pick
          ? [{ fixtureId, market: ai.market, pick: ai.pick }]
          : []),
      ],
      { operatorOnly: true },
    );

    const choice = readingOf({
      candidates,
      quotes,
      day: dayOf(kickoff, now),
    });
    const reading = 'reading' in choice ? choice.reading : null;
    const homeHistory = historyOf(historyRows, header.homeTeamId);
    const awayHistory = historyOf(historyRows, header.awayTeamId);
    const finished = header.status === 'FINISHED';
    const quoteOf = (key: Key) =>
      quotes.get(playableQuoteKey({ fixtureId, ...key }));

    return {
      fixtureId,
      kickoffAt: kickoff.toISOString(),
      state: stateOf(header, now),
      score: pair(header.homeScore, header.awayScore),
      halfTimeScore: pair(header.homeHalfTimeScore, header.awayHalfTimeScore),
      competition: {
        code: header.competitionCode,
        name: header.competitionName,
      },
      home: {
        name: header.homeName,
        shortName: header.homeShortName,
        logoUrl: header.homeLogoUrl,
      },
      away: {
        name: header.awayName,
        shortName: header.awayShortName,
        logoUrl: header.awayLogoUrl,
      },
      reading: reading
        ? readingOnSheet(reading, header, { homeHistory, awayHistory })
        : null,
      withoutReading: 'without' in choice ? choice.without : null,
      ai: ai ? aiOpinionOf(ai, reading, quoteOf) : null,
      form: {
        home: formOf(homeHistory, kickoff),
        away: formOf(awayHistory, kickoff),
      },
      headToHead: headToHeadOf(header),
      otherPicks: otherPicksOf({
        header,
        candidates,
        quoteOf,
        exclude: [reading, ai].flatMap((p) =>
          p?.market && p.pick ? [{ market: p.market, pick: p.pick }] : [],
        ),
        finished,
      }),
      operatorMargin:
        quoteOf({ market: 'ONE_X_TWO', pick: 'HOME' })?.operatorMargin ?? null,
    };
  }
}

/** « Lecture ce soir » applies to tomorrow's matches only. */
function dayOf(kickoff: Date, now: Date): MatchesDay {
  const days = Math.round(
    (startOfUtcDay(kickoff).getTime() - startOfUtcDay(now).getTime()) / DAY_MS,
  );
  return days >= 1 ? 'tomorrow' : days <= -1 ? 'yesterday' : 'today';
}

function pair(
  home: number | null,
  away: number | null,
): { home: number; away: number } | null {
  return home === null || away === null ? null : { home, away };
}

function readingOnSheet(
  reading: MatchReading,
  header: SheetHeaderRow,
  histories: { homeHistory: PastMatch[]; awayHistory: PastMatch[] },
): SheetReading {
  const fact = legFact({
    market: reading.market,
    pick: reading.pick,
    line: null,
    home: {
      name: header.homeName,
      shortName: header.homeShortName,
      history: histories.homeHistory,
    },
    away: {
      name: header.awayName,
      shortName: header.awayShortName,
      history: histories.awayHistory,
    },
  });
  return {
    market: reading.market,
    pick: reading.pick,
    odds: reading.odds,
    chance: reading.chance,
    result: reading.result,
    fact: fact || null,
  };
}

/**
 * The AI's pick as one more pick (06 § 7): its 1xBet price and the
 * market's frequency, never the AI's own probability, and one clean line.
 */
function aiOpinionOf(
  ai: AiOpinionRow,
  reading: MatchReading | null,
  quoteOf: (key: Key) => PlayableQuote | undefined,
): SheetAiOpinion {
  const key = { market: ai.market ?? '', pick: ai.pick ?? '' };
  const quote = quoteOf(key);
  return {
    ...key,
    odds: quote?.operatorOdds ?? null,
    chance: quote?.operatorFairProbability ?? null,
    result: resultOf(ai.result),
    sameAsReading:
      reading !== null &&
      reading.market === key.market &&
      reading.pick === key.pick,
    sentence: sentenceOf(ai.text),
  };
}

/**
 * The first sentence of the AI's text, when it is one line (90 characters
 * at most) and free of jargon; otherwise nothing (06 § 2).
 */
export function sentenceOf(text: string | null): string | null {
  if (!text) return null;
  const first =
    text
      .trim()
      .split(/(?<=[.!?])\s+/)[0]
      ?.trim() ?? '';
  if (first === '' || first.length > AI_SENTENCE_MAX_LENGTH) return null;
  return AI_SENTENCE_JARGON.some((pattern) => pattern.test(first))
    ? null
    : first;
}

/** One team's matches, most recent first (rows come per venue). */
function historyOf(
  rows: readonly TeamMatchRow[],
  teamId: string,
): DatedMatch[] {
  return rows
    .filter((row) => row.teamId === teamId)
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
    .map((row) => ({
      atHome: row.atHome,
      scheduledAt: row.scheduledAt,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      halfTimeFor: row.halfTimeFor,
      halfTimeAgainst: row.halfTimeAgainst,
      corners: row.corners === null ? null : Number(row.corners),
    }));
}

/**
 * Five squares, oldest first, all venues, and the rest since the last
 * match. The history holds the last ten of each venue, so the last five
 * overall are always in it.
 */
function formOf(history: readonly DatedMatch[], kickoff: Date): SheetTeamForm {
  const last = history.slice(0, SHEET_FORM_MATCHES);
  const latest = last[0]?.scheduledAt;
  return {
    last: last
      .map((m) =>
        m.goalsFor > m.goalsAgainst
          ? ('won' as const)
          : m.goalsFor < m.goalsAgainst
            ? ('lost' as const)
            : ('drawn' as const),
      )
      .reverse(),
    restDays: latest
      ? Math.floor((kickoff.getTime() - latest.getTime()) / DAY_MS)
      : null,
  };
}

/**
 * « 4 victoires d'Arsenal sur les 6 derniers » when one side won at least
 * half of the last meetings, « 3 nuls sur les 6 derniers face-à-face » when
 * draws did; nothing on fewer than three meetings or an even record.
 */
function headToHeadOf(header: SheetHeaderRow): string | null {
  const meetings = header.meetings ?? [];
  const n = meetings.length;
  if (n < SHEET_HEAD_TO_HEAD_MIN) return null;
  const homeWins = meetings.filter((m) => m.homeGoals > m.awayGoals).length;
  const awayWins = meetings.filter((m) => m.homeGoals < m.awayGoals).length;
  const draws = n - homeWins - awayWins;
  const sentenceFor = (wins: number, names: [string, string]) => {
    for (const name of names) {
      const sentence = `${wins} victoires ${of(name)} sur les ${n} derniers`;
      if (sentence.length <= LEG_FACT_MAX_LENGTH) return sentence;
    }
    return null;
  };
  if (homeWins > awayWins && homeWins * 2 >= n) {
    return sentenceFor(homeWins, [header.homeName, header.homeShortName]);
  }
  if (awayWins > homeWins && awayWins * 2 >= n) {
    return sentenceFor(awayWins, [header.awayName, header.awayShortName]);
  }
  if (draws * 2 >= n) return `${draws} nuls sur les ${n} derniers face-à-face`;
  return null;
}

/**
 * « Autres paris » (06 § 2): the main lines 1xBet prices, then the
 * engine's other picks it prices, by chance; never the reading or the AI's
 * pick again. Every chance is the market's frequency.
 */
function otherPicksOf(input: {
  header: SheetHeaderRow;
  candidates: readonly ReadingCandidateRow[];
  quoteOf: (key: Key) => PlayableQuote | undefined;
  exclude: readonly Key[];
  finished: boolean;
}): SheetPick[] {
  const seen = new Set(input.exclude.map((k) => `${k.market}|${k.pick}`));
  const picks: SheetPick[] = [];
  const add = (key: Key, result: SheetPick['result']) => {
    const id = `${key.market}|${key.pick}`;
    const quote = input.quoteOf(key);
    if (seen.has(id) || quote?.operatorOdds == null) return;
    seen.add(id);
    picks.push({
      ...key,
      odds: quote.operatorOdds,
      chance: quote.operatorFairProbability,
      result,
    });
  };
  const score = pair(input.header.homeScore, input.header.awayScore);
  for (const line of SHEET_MAIN_LINES) {
    add(line, input.finished && score ? mainLineResult(line, score) : null);
  }
  const engine = input.candidates
    .flatMap((c) =>
      c.market && c.pick
        ? [{ market: c.market, pick: c.pick, result: c.result }]
        : [],
    )
    .map((c) => ({
      ...c,
      chance: input.quoteOf(c)?.operatorFairProbability ?? 0,
    }))
    .sort((a, b) => b.chance - a.chance);
  for (const c of engine) add(c, resultOf(c.result));
  return picks;
}

/** 1X2, over/under 2.5 and both teams to score, from the final score. */
function mainLineResult(
  line: Key,
  score: { home: number; away: number },
): SheetPick['result'] {
  const won = (() => {
    switch (`${line.market}|${line.pick}`) {
      case 'ONE_X_TWO|HOME':
        return score.home > score.away;
      case 'ONE_X_TWO|DRAW':
        return score.home === score.away;
      case 'ONE_X_TWO|AWAY':
        return score.home < score.away;
      case 'OVER_UNDER|OVER':
        return score.home + score.away > 2.5;
      case 'OVER_UNDER|UNDER':
        return score.home + score.away < 2.5;
      case 'BTTS|YES':
        return score.home > 0 && score.away > 0;
      case 'BTTS|NO':
        return score.home === 0 || score.away === 0;
      default:
        return null;
    }
  })();
  return won === null ? null : won ? 'won' : 'lost';
}
