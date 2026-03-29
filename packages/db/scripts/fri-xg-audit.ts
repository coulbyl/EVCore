/// <reference types="node" />
/**
 * Audit xG coverage des fixtures FRI terminées.
 * Pour chaque fixture sans xG (et non marquée xgUnavailable), appelle
 * l'API-FOOTBALL pour vérifier si expected_goals est réellement disponible.
 *
 * Run: pnpm --filter @evcore/db tsx packages/db/scripts/fri-xg-audit.ts
 */
import 'dotenv/config';
import { prisma } from '../src/client';

const API_KEY = process.env['API_FOOTBALL_KEY'] as string;
if (!API_KEY) throw new Error('API_FOOTBALL_KEY env var is required');
const BASE = 'https://v3.football.api-sports.io';
const RATE_LIMIT_MS = 3_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchStats(
  externalId: number,
): Promise<{ xgHome: number | null; xgAway: number | null } | 'error' | 'no_data'> {
  try {
    const res = await fetch(`${BASE}/fixtures/statistics?fixture=${externalId}`, {
      headers: { 'x-apisports-key': API_KEY },
    });
    if (!res.ok) return 'error';
    const body = (await res.json()) as {
      response: { team: { name: string }; statistics: { type: string; value: unknown }[] }[];
    };
    if (!body.response || body.response.length < 2) return 'no_data';
    const getXg = (stats: { type: string; value: unknown }[]) => {
      const entry = stats.find((s) => s.type === 'expected_goals');
      if (!entry) return null;
      const val = parseFloat(String(entry.value));
      return isNaN(val) ? null : val;
    };
    return {
      xgHome: getXg(body.response[0].statistics),
      xgAway: getXg(body.response[1].statistics),
    };
  } catch {
    return 'error';
  }
}

async function main() {
  const fixtures = await prisma.fixture.findMany({
    where: {
      status: 'FINISHED',
      xgUnavailable: false,
      season: { competition: { code: 'FRI' } },
    },
    select: {
      id: true,
      externalId: true,
      homeXg: true,
      awayXg: true,
      scheduledAt: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  const withXg = fixtures.filter(
    (f) => Number(f.homeXg) > 0 || Number(f.awayXg) > 0,
  );
  const withoutXg = fixtures.filter(
    (f) => Number(f.homeXg) === 0 && Number(f.awayXg) === 0,
  );

  console.log(`\nFRI fixtures FINISHED (xgUnavailable=false): ${fixtures.length}`);
  console.log(`  → avec xG en base : ${withXg.length}`);
  console.log(`  → sans xG (homeXg=0, awayXg=0) : ${withoutXg.length}\n`);

  if (withoutXg.length === 0) {
    console.log('Rien à vérifier.');
    return;
  }

  console.log('Vérification API pour les fixtures sans xG...\n');
  console.log(
    `${'Date'.padEnd(12)}${'Fixture'.padEnd(40)}${'extId'.padEnd(10)}${'API xG Home'.padEnd(14)}${'API xG Away'.padEnd(14)}Statut`,
  );
  console.log('─'.repeat(100));

  let apiHasXg = 0;
  let apiNoXg = 0;
  let apiNoData = 0;
  let apiError = 0;

  for (const fixture of withoutXg) {
    const date = fixture.scheduledAt.toISOString().slice(0, 10);
    const name = `${fixture.homeTeam?.name ?? '?'} vs ${fixture.awayTeam?.name ?? '?'}`;
    const result = await fetchStats(fixture.externalId);

    let statusLabel: string;
    let xgHomeStr = '-';
    let xgAwayStr = '-';

    if (result === 'error') {
      statusLabel = 'ERREUR API';
      apiError++;
    } else if (result === 'no_data') {
      statusLabel = 'PAS DE STATS';
      apiNoData++;
    } else {
      xgHomeStr = result.xgHome !== null ? String(result.xgHome) : 'null';
      xgAwayStr = result.xgAway !== null ? String(result.xgAway) : 'null';
      if (result.xgHome !== null || result.xgAway !== null) {
        statusLabel = '✅ xG DISPO';
        apiHasXg++;
      } else {
        statusLabel = '❌ xG null';
        apiNoXg++;
      }
    }

    console.log(
      `${date.padEnd(12)}${name.slice(0, 38).padEnd(40)}${String(fixture.externalId).padEnd(10)}${xgHomeStr.padEnd(14)}${xgAwayStr.padEnd(14)}${statusLabel}`,
    );

    await sleep(RATE_LIMIT_MS);
  }

  console.log('\n─'.repeat(100));
  console.log(`\nRésumé API (${withoutXg.length} fixtures vérifiées) :`);
  console.log(`  ✅ xG disponible dans l'API  : ${apiHasXg}`);
  console.log(`  ❌ xG null dans l'API        : ${apiNoXg}`);
  console.log(`  ⚠  Pas de stats (< 2 équipes): ${apiNoData}`);
  console.log(`  🔴 Erreur réseau             : ${apiError}`);

  if (apiHasXg > 0) {
    console.log(
      `\n⚠  ${apiHasXg} fixtures ont du xG dans l'API mais pas en base → relancer stats-sync FRI`,
    );
  } else {
    console.log(
      '\n→ Le 4% xG coverage FRI est confirmé par l\'API — les données ne sont pas disponibles.',
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
