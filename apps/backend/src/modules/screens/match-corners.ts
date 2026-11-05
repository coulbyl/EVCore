import { Prisma } from '@evcore/db';

/**
 * A finished match's corners (05/11): the count once `fixture_statistic`
 * has it (about 45 minutes after the final whistle, 86 % of matches), «
 * not counted yet » before. Nothing before or during the match: the
 * statistics are only collected once it is over.
 */
export type MatchCorners =
  | { state: 'counted'; home: number; away: number }
  | { state: 'pending' };

/**
 * The two teams' corner counts of a fixture, `alias` being the fixture's
 * table alias: one correlated read per team on the (fixtureId, type) index,
 * inside the screen's query (no N+1).
 */
export function cornersColumns(alias: string): Prisma.Sql {
  const f = Prisma.raw(alias);
  return Prisma.sql`
    (SELECT fs.value::int FROM public.fixture_statistic fs
      WHERE fs."fixtureId" = ${f}.id AND fs."teamId" = ${f}."homeTeamId"
        AND fs.type = 'corner_kicks'
      ORDER BY fs."observedAt" DESC LIMIT 1) AS "homeCorners",
    (SELECT fs.value::int FROM public.fixture_statistic fs
      WHERE fs."fixtureId" = ${f}.id AND fs."teamId" = ${f}."awayTeamId"
        AND fs.type = 'corner_kicks'
      ORDER BY fs."observedAt" DESC LIMIT 1) AS "awayCorners"`;
}

/** Null before the end; « pending » until both teams' counts are in. */
export function cornersOf(row: {
  status: string;
  homeCorners: number | null;
  awayCorners: number | null;
}): MatchCorners | null {
  if (row.status !== 'FINISHED') return null;
  return row.homeCorners === null || row.awayCorners === null
    ? { state: 'pending' }
    : { state: 'counted', home: row.homeCorners, away: row.awayCorners };
}

/** The full-match corner markets: a first-half one is not read on them. */
const FULL_MATCH_CORNER_MARKETS: ReadonlySet<string> = new Set([
  'CORNERS',
  'CORNERS_HOME',
  'CORNERS_AWAY',
  'CORNERS_1X2',
]);

export function isCornersMarket(market: string): boolean {
  return FULL_MATCH_CORNER_MARKETS.has(market);
}
