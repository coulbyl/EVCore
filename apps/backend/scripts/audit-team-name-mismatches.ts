/**
 * Team-name mismatch audit — dry run before spending The Odds API historical
 * import credits (or before a football-data.co.uk odds-csv backfill) on a
 * new league.
 *
 * Fetches CURRENT odds (cheap, non-historical — a single call per league)
 * for a competition's Odds API sport key and compares team names against the
 * DB using the same fuzzy matcher as odds-historical-import.worker.ts
 * (team-name-matching.ts). Anything left unmatched is a mismatch you'd hit
 * during the real backfill — add an entry to TEAM_ALIASES in
 * team-name-matching.ts before running it.
 *
 * Only useful while the league has upcoming fixtures listed by The Odds API
 * — during the off-season the response is empty and there's nothing to
 * compare yet (rerun once the season starts).
 *
 * Run: cd apps/backend && ./node_modules/.bin/tsx --env-file=.env scripts/audit-team-name-mismatches.ts ARG1 AUT1 DEN1 IRL1 SCO1 BRA2
 */

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '@evcore/db';
import { ETL_CONSTANTS, THE_ODDS_API_SPORT_KEYS } from '@config/etl.constants';
import { TheOddsApiEventSchema } from '../src/modules/etl/schemas/the-odds-api.schema';
import { teamMatches } from '../src/modules/etl/team-name-matching';
import { sleep } from '@utils/async.utils';

const CurrentOddsResponseSchema = z.array(TheOddsApiEventSchema);

type LeagueReport = {
  competitionCode: string;
  sportKey: string;
  eventCount: number;
  matchedCount: number;
  unmatchedDbTeams: string[];
  unmatchedApiNames: string[];
};

async function auditLeague(
  competitionCode: string,
  apiKey: string,
): Promise<LeagueReport | null> {
  const code =
    competitionCode.toUpperCase() as keyof typeof THE_ODDS_API_SPORT_KEYS;
  const sportKey: string | undefined = THE_ODDS_API_SPORT_KEYS[code];

  if (!sportKey) {
    console.log(
      `⚠ ${competitionCode}: no Odds API sport key configured — skipping`,
    );
    return null;
  }

  const teams = await prisma.team.findMany({
    where: { competition: { code } },
    select: { name: true, shortName: true },
  });

  if (teams.length === 0) {
    console.log(
      `⚠ ${competitionCode}: no teams in DB yet — run a fixtures backfill first`,
    );
    return null;
  }

  const url = `${ETL_CONSTANTS.THE_ODDS_API_BASE}/sports/${sportKey}/odds?apiKey=${apiKey}&regions=eu&markets=h2h`;
  const res = await fetch(url);

  if (!res.ok) {
    console.log(`✗ ${competitionCode}: The Odds API responded ${res.status}`);
    return null;
  }

  const parsed = CurrentOddsResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    console.log(
      `✗ ${competitionCode}: unexpected response shape — ${parsed.error.message}`,
    );
    return null;
  }

  const events = parsed.data;
  if (events.length === 0) {
    console.log(
      `— ${competitionCode}: 0 upcoming events listed (off-season or no coverage yet) — nothing to compare`,
    );
    return null;
  }

  const apiNames = [
    ...new Set(events.flatMap((e) => [e.home_team, e.away_team])),
  ];

  const unmatchedDbTeams = teams
    .filter((team) => !apiNames.some((apiName) => teamMatches(team, apiName)))
    .map((team) => team.name);

  const unmatchedApiNames = apiNames.filter(
    (apiName) => !teams.some((team) => teamMatches(team, apiName)),
  );

  const matchedCount = teams.length - unmatchedDbTeams.length;

  console.log(
    `\n═══ ${competitionCode} (${sportKey}) — ${events.length} events, ${teams.length} DB teams ═══`,
  );
  console.log(`  matched: ${matchedCount}/${teams.length}`);
  if (unmatchedDbTeams.length > 0) {
    console.log(
      `  unmatched DB teams (${unmatchedDbTeams.length}): ${unmatchedDbTeams.join(', ')}`,
    );
  }
  if (unmatchedApiNames.length > 0) {
    console.log(
      `  unmatched API names (${unmatchedApiNames.length}): ${unmatchedApiNames.join(', ')}`,
    );
  }
  if (unmatchedDbTeams.length === 0 && unmatchedApiNames.length === 0) {
    console.log('  ✓ all teams matched — safe to run the historical backfill');
  }

  return {
    competitionCode: code,
    sportKey,
    eventCount: events.length,
    matchedCount,
    unmatchedDbTeams,
    unmatchedApiNames,
  };
}

async function run(): Promise<void> {
  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) {
    throw new Error('THE_ODDS_API_KEY is not set (check apps/backend/.env)');
  }

  const codes = process.argv.slice(2);
  if (codes.length === 0) {
    throw new Error(
      'Usage: tsx scripts/audit-team-name-mismatches.ts <CODE> [CODE...]\n' +
        'Example: tsx scripts/audit-team-name-mismatches.ts ARG1 AUT1 DEN1 IRL1 SCO1 BRA2',
    );
  }

  console.log('EVCore — team-name mismatch audit (dry run, current odds only)');

  const reports: LeagueReport[] = [];
  for (const [i, code] of codes.entries()) {
    if (i > 0) await sleep(ETL_CONSTANTS.THE_ODDS_API_RATE_LIMIT_MS);
    const report = await auditLeague(code, apiKey);
    if (report) reports.push(report);
  }

  const reportsDir = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../reports',
  );
  await mkdir(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, 'team-name-mismatch-audit.json');
  await writeFile(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2),
  );
  console.log(`\nReport saved → ${outPath}`);
}

run()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
