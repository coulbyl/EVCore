import { Injectable, NotFoundException } from '@nestjs/common';
import {
  READING_CHANNELS,
  SHEET_FORM_MATCHES,
  SHEET_HEAD_TO_HEAD_MEETINGS,
  SHEET_HEAD_TO_HEAD_MIN,
  SHEET_HEAD_TO_HEAD_YEARS,
  SCREEN_READS_KEEP_MS,
  SCREEN_READS_MAX_KEYS,
  SCREEN_READS_TTL_MS,
  SHEET_MAIN_LINES,
  SHEET_NEW_MARKETS,
  SHEET_PRICES_LOOKBACK_DAYS,
} from '@config/screens.constants';
import { SharedReads } from '@utils/shared-reads';
import {
  LEG_FACT_HISTORY_DAYS,
  LEG_FACT_HISTORY_MATCHES,
  LEG_FACT_MAX_LENGTH,
} from '@config/leg-fact.constants';
import {
  PlayableOddsRepository,
  playableQuoteKey,
  type MarketPriceRow,
  type PlayableQuote,
} from '@modules/betting-engine/pricing/playable-odds.repository';
import type { MatchFacts } from '@evcore/analysis-core';
import { MatchFactsRepository } from '@modules/fixture-events/match-facts.repository';
import { PlayerSquadRepository } from '@modules/fixture-events/player-squad.repository';
import { newMarketPicksOf, pricedPlayerIds } from './match-sheet-markets';
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
import {
  FixtureEventRepository,
  type SheetEventRow,
} from '@modules/fixture-events/fixture-event.repository';
import { sheetEventsOf } from './match-sheet-events';
import { matchClockOf } from './match-clock';
import type {
  MatchSheet,
  SetAsideReason,
  SheetAiAbstention,
  SheetAiOpinion,
  SheetPick,
  SheetReading,
  SheetTeamForm,
} from './match-sheet.types';
import type { MatchReading } from './matches.types';
import { MIN_LEG_ODDS } from '@modules/coupon/coupon.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

type Key = { market: string; pick: string };

/** A past match with its date, for the form and the rest days. */
type DatedMatch = PastMatch & { scheduledAt: Date };

/**
 * GET /matches/:id/sheet: the player's match sheet (docs/refonte-ui/06
 * § 2–4). The match and its last meetings, the engine's picks, the AI's
 * opinion, the two teams' last matches, the 1xBet prices, the prices of
 * the new markets and their players' names, and a finished match's events
 * and facts.
 */
/** What a sheet reads, shared between the players who open it. */
type SheetReads = {
  header: SheetHeaderRow;
  candidates: ReadingCandidateRow[];
  aiRows: AiOpinionRow[];
  historyRows: TeamMatchRow[];
  quotes: Map<string, PlayableQuote>;
  rejectionReasons: string[];
  /** A finished match's events; empty before the end. */
  events: SheetEventRow[];
  /** Every book's prices on the markets of SHEET_NEW_MARKETS. */
  marketRows: MarketPriceRow[];
  /** The names of the players those prices name. */
  playerNames: Map<number, string>;
  /** A finished match's facts (statistics, events, lineups); else null. */
  facts: MatchFacts | null;
};

@Injectable()
export class MatchSheetService {
  /**
   * A sheet is the same for every player: its reads are shared per match
   * (B17b), the sheet rebuilt per request with the current time.
   */
  private readonly reads = new SharedReads<SheetReads | null>({
    ttlMs: SCREEN_READS_TTL_MS,
    keepMs: SCREEN_READS_KEEP_MS,
    maxKeys: SCREEN_READS_MAX_KEYS,
  });

  // eslint-disable-next-line max-params -- Nest injection of the sheet's reads.
  constructor(
    private readonly repository: MatchesRepository,
    private readonly playableOdds: PlayableOddsRepository,
    private readonly history: LegFactRepository,
    private readonly fixtureEvents: FixtureEventRepository,
    private readonly matchFacts: MatchFactsRepository,
    private readonly squads: PlayerSquadRepository,
  ) {}

  async getSheet(
    fixtureId: string,
    now: Date = new Date(),
  ): Promise<MatchSheet> {
    const reads = await this.reads.get(
      fixtureId,
      () => this.readSheet(fixtureId, now),
      now.getTime(),
    );
    if (!reads) throw new NotFoundException('Match introuvable');
    return this.sheetOf({ ...reads, kickoff: reads.header.scheduledAt, now });
  }

  /** The sheet's reads (events and facts only once finished); null for an unknown match. */
  private async readSheet(
    fixtureId: string,
    now: Date,
  ): Promise<SheetReads | null> {
    const header = await this.repository.findSheetHeader({
      fixtureId,
      meetings: SHEET_HEAD_TO_HEAD_MEETINGS,
      since: new Date(now.getTime() - SHEET_HEAD_TO_HEAD_YEARS * 365 * DAY_MS),
    });
    if (!header) return null;
    const kickoff = header.scheduledAt;

    const finished = header.status === 'FINISHED';
    const [
      candidates,
      aiRows,
      historyRows,
      rejectionReasons,
      events,
      { marketRows, playerNames },
      facts,
    ] = await Promise.all([
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
      this.repository.findRejectionReasons({
        fixtureId,
        channels: READING_CHANNELS,
      }),
      finished
        ? this.fixtureEvents.findSheetEvents(fixtureId)
        : Promise.resolve([]),
      this.playableOdds
        .findMarketPrices({
          fixtureId,
          markets: SHEET_NEW_MARKETS,
          kickoff,
          since: new Date(
            kickoff.getTime() - SHEET_PRICES_LOOKBACK_DAYS * DAY_MS,
          ),
        })
        .then(async (rows) => ({
          marketRows: rows,
          playerNames: await this.squads.findDisplayNames(
            pricedPlayerIds(rows),
          ),
        })),
      finished
        ? this.matchFacts
            .findFacts([fixtureId])
            .then((byId) => byId.get(fixtureId) ?? null)
        : Promise.resolve(null),
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
    return {
      header,
      candidates,
      aiRows,
      historyRows,
      quotes,
      rejectionReasons,
      events,
      marketRows,
      playerNames,
      facts,
    };
  }

  private sheetOf(
    input: SheetReads & { kickoff: Date; now: Date },
  ): MatchSheet {
    const { header, candidates, aiRows, historyRows, quotes, kickoff, now } =
      input;
    const fixtureId = header.fixtureId;
    const ai = aiRows.find((row) => row.status === 'SELECTED' && row.market);

    const choice = readingOf({
      candidates,
      quotes,
      day: dayOf(kickoff, now),
      now,
    });
    const reading = 'reading' in choice ? choice.reading : null;
    const homeHistory = historyOf(historyRows, header.homeTeamId);
    const awayHistory = historyOf(historyRows, header.awayTeamId);
    const finished = header.status === 'FINISHED';
    const score = pair(header.homeScore, header.awayScore);
    const matchEvents = finished
      ? sheetEventsOf({
          events: input.events,
          homeTeamId: header.homeTeamId,
          awayTeamId: header.awayTeamId,
          score,
        })
      : null;
    const quoteOf = (key: Key) =>
      quotes.get(playableQuoteKey({ fixtureId, ...key }));

    return {
      fixtureId,
      kickoffAt: kickoff.toISOString(),
      state: stateOf(header, now),
      score,
      clock: matchClockOf(header, now),
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
      setAsideReason:
        'without' in choice && choice.without === 'rejected'
          ? setAsideReasonOf({
              candidates,
              quotes,
              rejectionReasons: input.rejectionReasons,
            })
          : null,
      ai: ai ? aiOpinionOf(ai, reading, quoteOf) : null,
      aiAbstention: ai ? null : aiAbstentionOf(aiRows),
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
      }).concat(
        newMarketPicksOf({
          rows: input.marketRows,
          playerNames: input.playerNames,
          settle: { finished, facts: input.facts },
        }),
      ),
      scorers: matchEvents?.scorers ?? null,
      redCards: matchEvents?.redCards ?? null,
    };
  }
}

/**
 * Why a match has no reading though it was analysed (06 § 4–5), most
 * telling first: AVOID fired; the engine's picks all priced under the
 * floor at 1xBet; a suspended market; otherwise no chance sure enough.
 */
export function setAsideReasonOf(input: {
  candidates: readonly ReadingCandidateRow[];
  quotes: Map<string, PlayableQuote>;
  rejectionReasons: readonly string[];
}): SetAsideReason {
  if (input.candidates.some((c) => c.avoided)) return 'divergence';
  const priced = input.candidates.flatMap((c) => {
    if (c.market === null || c.pick === null) return [];
    const odds = input.quotes.get(
      playableQuoteKey({
        fixtureId: c.fixtureId,
        market: c.market,
        pick: c.pick,
      }),
    )?.operatorOdds;
    return odds == null ? [] : [odds];
  });
  if (priced.length > 0 && priced.every((odds) => odds < MIN_LEG_ODDS)) {
    return 'low_odds';
  }
  if (input.rejectionReasons.includes('market_suspended')) return 'suspended';
  return 'not_sure';
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

/**
 * A pick of the markets « Mon ticket » takes (the reading, the AI's, the
 * main lines and the engine's others): no line, no player, addable. The new
 * markets are not (match-sheet-markets.ts).
 */
function mainPick(
  key: Key,
): Pick<SheetPick, 'market' | 'pick' | 'line' | 'player' | 'addable'> {
  return {
    market: key.market,
    pick: key.pick,
    line: null,
    player: null,
    addable: true,
  };
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
    ...mainPick(reading),
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
  const sameAsReading =
    reading !== null &&
    reading.market === key.market &&
    reading.pick === key.pick;
  return {
    ...mainPick(key),
    odds: quote?.operatorOdds ?? null,
    // One bet, one chance on the sheet: the AI's pick when it is ours reads
    // the reading's chance, never a second figure next to it.
    chance: sameAsReading
      ? reading.chance
      : (quote?.operatorFairProbability ?? null),
    result: resultOf(ai.result),
    sameAsReading,
    speech: speechOf(ai.text),
    decidedAt: ai.decidedAt.toISOString(),
  };
}

/**
 * The sheet shows an « Avis IA » for these rows: the AI's pick, or its
 * no-play spoken about the match (aiAbstentionOf). The list's sparkle
 * (GET /matches) reads the same rule.
 */
export function hasAiOpinion(rows: readonly AiOpinionRow[]): boolean {
  return (
    rows.some((row) => row.status === 'SELECTED' && row.market) ||
    aiAbstentionOf(rows) !== null
  );
}

/**
 * The AI read the match and would not bet: an opinion too (03/11), shown
 * when its text speaks of the match (`voice: match`, VANTAGE v6), never a
 * text that narrates its rules.
 */
export function aiAbstentionOf(
  rows: readonly AiOpinionRow[],
): SheetAiAbstention | null {
  const row = rows.find((r) => r.status === 'REJECTED' && r.voice === 'match');
  const speech = row ? speechOf(row.text) : null;
  return row && speech
    ? { speech, decidedAt: row.decidedAt.toISOString() }
    : null;
}

/**
 * The AI's text as the player reads it: whole, as it wrote it (decided
 * 31/10). Its figures are its reasons; the words a player should not read
 * are fixed in VANTAGE's prompt, never cut here. Nothing when it is empty.
 */
export function speechOf(text: string | null): string | null {
  const speech = text?.trim() ?? '';
  return speech === '' ? null : speech;
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
 * pick again. Every chance is the market's frequency. The new markets
 * (match-sheet-markets.ts) follow.
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
      ...mainPick(key),
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
