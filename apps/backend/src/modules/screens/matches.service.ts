import { BadRequestException, Injectable } from '@nestjs/common';
import {
  MATCHES_LEAGUE_PRIORITY,
  MATCHES_PAGE_SIZE,
  READING_CHANNELS,
} from '@config/screens.constants';
import {
  PlayableOddsRepository,
  type PlayableQuote,
} from '@modules/betting-engine/pricing/playable-odds.repository';
import { groupBy, readingOf, stateOf, uniqueKeys } from './matches-reading';
import { formatDateUtc, startOfUtcDay } from '@utils/date.utils';
import type { MatchesDay } from './dto/matches-query.dto';
import {
  MatchesRepository,
  type MatchRow,
  type MatchesCursor,
  type ReadingCandidateRow,
} from './matches.repository';
import type { MatchItem, MatchesScreen } from './matches.types';

const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_OFFSET: Record<MatchesDay, number> = {
  yesterday: -1,
  today: 0,
  tomorrow: 1,
};

/**
 * GET /matches?day=: « Matchs » (docs/refonte-ui/06 § 1), one page at a
 * time. Three SQL queries per page: the matches, the engine's picks, the
 * 1xBet prices of those picks.
 *
 * No AI sign on the list (decided 2026-10-30): a different pick from the AI
 * is a choice, not a contradiction, and no measure yet says its
 * disagreement predicts anything; it would add doubt without information.
 * The AI's opinion lives in the match sheet, as one more pick.
 */
@Injectable()
export class MatchesService {
  constructor(
    private readonly repository: MatchesRepository,
    private readonly playableOdds: PlayableOddsRepository,
  ) {}

  async getMatches(
    input: { day: MatchesDay; search?: string; cursor?: string },
    now: Date = new Date(),
  ): Promise<MatchesScreen> {
    const from = new Date(
      startOfUtcDay(now).getTime() + DAY_OFFSET[input.day] * DAY_MS,
    );
    const rows = await this.repository.findDayPage({
      from,
      to: new Date(from.getTime() + DAY_MS),
      search: input.search?.trim() || null,
      after: input.cursor ? decodeCursor(input.cursor) : null,
      limit: MATCHES_PAGE_SIZE + 1,
      leaguePriority: MATCHES_LEAGUE_PRIORITY,
    });
    const page = rows.slice(0, MATCHES_PAGE_SIZE);
    const ids = page.map((row) => row.fixtureId);

    const candidates = await this.repository.findReadingCandidates({
      fixtureIds: ids,
      channels: READING_CHANNELS,
    });
    // The screen shows 1xBet's price only: its rows alone.
    const quotes = await this.playableOdds.findPlayableQuotes(
      uniqueKeys(candidates),
      { operatorOnly: true },
    );

    const byFixture = groupBy(candidates, (c) => c.fixtureId);
    const last = page.at(-1);
    return {
      day: input.day,
      date: formatDateUtc(from),
      items: page.map((row) =>
        itemOf({
          row,
          candidates: byFixture.get(row.fixtureId) ?? [],
          quotes,
          day: input.day,
          now,
        }),
      ),
      nextCursor:
        rows.length > MATCHES_PAGE_SIZE && last ? encodeCursor(last) : null,
    };
  }
}

function itemOf(input: {
  row: MatchRow;
  candidates: readonly ReadingCandidateRow[];
  quotes: Map<string, PlayableQuote>;
  day: MatchesDay;
  now: Date;
}): MatchItem {
  const { row } = input;
  const choice = readingOf(input);
  return {
    fixtureId: row.fixtureId,
    kickoffAt: row.scheduledAt.toISOString(),
    state: stateOf(row, input.now),
    score:
      row.homeScore !== null && row.awayScore !== null
        ? { home: row.homeScore, away: row.awayScore }
        : null,
    competition: { code: row.competitionCode, name: row.competitionName },
    home: {
      name: row.homeName,
      shortName: row.homeShortName,
      logoUrl: row.homeLogoUrl,
    },
    away: {
      name: row.awayName,
      shortName: row.awayShortName,
      logoUrl: row.awayLogoUrl,
    },
    reading: 'reading' in choice ? choice.reading : null,
    withoutReading: 'without' in choice ? choice.without : null,
  };
}

function encodeCursor(row: MatchRow): string {
  const cursor: MatchesCursor = {
    scheduledAt: row.scheduledAt.toISOString(),
    leagueRank: row.leagueRank,
    competitionName: row.competitionName,
    fixtureId: row.fixtureId,
  };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decodeCursor(value: string): MatchesCursor {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (
      parsed &&
      typeof parsed === 'object' &&
      'scheduledAt' in parsed &&
      'leagueRank' in parsed &&
      'competitionName' in parsed &&
      'fixtureId' in parsed &&
      typeof parsed.scheduledAt === 'string' &&
      !Number.isNaN(Date.parse(parsed.scheduledAt)) &&
      typeof parsed.leagueRank === 'number' &&
      typeof parsed.competitionName === 'string' &&
      typeof parsed.fixtureId === 'string' &&
      UUID.test(parsed.fixtureId)
    ) {
      return {
        scheduledAt: parsed.scheduledAt,
        leagueRank: parsed.leagueRank,
        competitionName: parsed.competitionName,
        fixtureId: parsed.fixtureId,
      };
    }
  } catch {
    // Falls through to the 400.
  }
  throw new BadRequestException('Curseur invalide');
}
