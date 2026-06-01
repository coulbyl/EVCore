#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_INPUT = 'apps/backend/reports/investment-vs-picks-analysis.json';
const DEFAULT_OUT_JSON = 'apps/backend/reports/hidden-winner-segments.json';
const DEFAULT_OUT_TXT = 'apps/backend/reports/hidden-winner-segments.txt';

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    outJson: DEFAULT_OUT_JSON,
    outTxt: DEFAULT_OUT_TXT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--input') {
      args.input = next;
      i += 1;
    } else if (arg === '--out-json') {
      args.outJson = next;
      i += 1;
    } else if (arg === '--out-txt') {
      args.outTxt = next;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/analyze-hidden-winner-segments.mjs

Options:
  --input PATH      investment-vs-picks report JSON.
  --out-json PATH   JSON output path.
  --out-txt PATH    Text output path.`);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runPsqlJson(sql) {
  const raw = execFileSync(
    'docker',
    [
      'exec',
      'evcore-postgres',
      'psql',
      '-U',
      'postgres',
      '-d',
      'evcore',
      '-t',
      '-A',
      '-c',
      sql,
    ],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 },
  ).trim();

  if (!raw) return [];
  return JSON.parse(raw);
}

function dbPicksQuery(from, to) {
  return `
WITH db_picks AS (
  SELECT
    DATE(f."scheduledAt")::text AS day,
    f.id::text AS "fixtureId",
    ht.name AS "homeTeam",
    at.name AS "awayTeam",
    c.code AS "competitionCode",
    c.name AS competition,
    c.country AS country,
    f."scheduledAt" AS "scheduledAt",
    CASE WHEN b."isSafeValue" THEN 'SV' ELSE 'EV' END AS canal,
    b.market::text AS market,
    b.pick AS pick,
    b."probEstimated"::float AS probability,
    b."oddsSnapshot"::float AS "oddsSnapshot",
    CASE
      WHEN b.status = 'WON' THEN true
      WHEN b.status = 'LOST' THEN false
      ELSE NULL
    END AS "isCorrect",
    b.status::text AS status,
    'bet' AS "sourceType"
  FROM bet b
  JOIN fixture f ON f.id = b."fixtureId"
  JOIN LATERAL (
    SELECT mr.id
    FROM model_run mr
    WHERE mr."fixtureId" = f.id
    ORDER BY mr."analyzedAt" DESC
    LIMIT 1
  ) latest_run ON latest_run.id = b."modelRunId"
  JOIN team ht ON ht.id = f."homeTeamId"
  JOIN team at ON at.id = f."awayTeamId"
  JOIN season s ON s.id = f."seasonId"
  JOIN competition c ON c.id = s."competitionId"
  WHERE b.source = 'MODEL'
    AND DATE(f."scheduledAt") BETWEEN DATE ${sqlString(from)} AND DATE ${sqlString(to)}

  UNION ALL

  SELECT
    DATE(f."scheduledAt")::text AS day,
    f.id::text AS "fixtureId",
    ht.name AS "homeTeam",
    at.name AS "awayTeam",
    c.code AS "competitionCode",
    c.name AS competition,
    c.country AS country,
    f."scheduledAt" AS "scheduledAt",
    CASE
      WHEN p.channel = 'BTTS' THEN 'BB'
      WHEN p.channel = 'DRAW' THEN 'NUL'
      ELSE 'CONF'
    END AS canal,
    p.market::text AS market,
    p.pick AS pick,
    p.probability::float AS probability,
    NULL::float AS "oddsSnapshot",
    p.correct AS "isCorrect",
    CASE
      WHEN p.correct IS TRUE THEN 'WON'
      WHEN p.correct IS FALSE THEN 'LOST'
      ELSE 'PENDING'
    END AS status,
    'prediction' AS "sourceType"
  FROM prediction p
  JOIN fixture f ON f.id = p."fixtureId"
  JOIN team ht ON ht.id = f."homeTeamId"
  JOIN team at ON at.id = f."awayTeamId"
  JOIN season s ON s.id = f."seasonId"
  JOIN competition c ON c.id = s."competitionId"
  WHERE p.channel IN ('BTTS', 'DRAW', 'CONF')
    AND DATE(f."scheduledAt") BETWEEN DATE ${sqlString(from)} AND DATE ${sqlString(to)}
)
SELECT COALESCE(json_agg(db_picks ORDER BY day, "scheduledAt", "fixtureId", canal), '[]'::json)
FROM db_picks;
`;
}

function keyOf(pick) {
  return `${pick.fixtureId}|${pick.canal}|${pick.market}|${pick.pick}`;
}

function oddsBucket(value) {
  if (value == null) return 'no_odds';
  if (value < 1.5) return '<1.50';
  if (value < 1.8) return '1.50-1.79';
  if (value < 2) return '1.80-1.99';
  if (value < 2.5) return '2.00-2.49';
  if (value < 3) return '2.50-2.99';
  if (value < 4) return '3.00-3.99';
  if (value < 5) return '4.00-4.99';
  return '5.00+';
}

function probabilityBucket(value) {
  if (value == null) return 'unknown';
  if (value < 0.35) return '<35%';
  if (value < 0.45) return '35-44%';
  if (value < 0.55) return '45-54%';
  if (value < 0.65) return '55-64%';
  if (value < 0.75) return '65-74%';
  if (value < 0.85) return '75-84%';
  return '85%+';
}

function createStats(key, label) {
  return {
    key,
    label,
    total: 0,
    settled: 0,
    won: 0,
    lost: 0,
    pending: 0,
    selected: 0,
    selectedWon: 0,
    selectedLost: 0,
    selectedPending: 0,
    ignoredWon: 0,
    oddsTotal: 0,
    oddsCount: 0,
    probabilityTotal: 0,
    probabilityCount: 0,
    examples: [],
  };
}

function addPick(stats, pick, selected) {
  stats.total += 1;
  if (pick.isCorrect === true) {
    stats.settled += 1;
    stats.won += 1;
  } else if (pick.isCorrect === false) {
    stats.settled += 1;
    stats.lost += 1;
  } else {
    stats.pending += 1;
  }

  if (selected) {
    stats.selected += 1;
    if (pick.isCorrect === true) stats.selectedWon += 1;
    else if (pick.isCorrect === false) stats.selectedLost += 1;
    else stats.selectedPending += 1;
  } else if (pick.isCorrect === true) {
    stats.ignoredWon += 1;
    if (stats.examples.length < 8) {
      stats.examples.push({
        day: pick.day,
        fixtureId: pick.fixtureId,
        fixture: `${pick.homeTeam} vs ${pick.awayTeam}`,
        competition: pick.competitionCode,
        market: pick.market,
        pick: pick.pick,
        canal: pick.canal,
        oddsSnapshot: pick.oddsSnapshot,
        probability: pick.probability,
      });
    }
  }

  if (pick.oddsSnapshot != null) {
    stats.oddsTotal += pick.oddsSnapshot;
    stats.oddsCount += 1;
  }
  if (pick.probability != null) {
    stats.probabilityTotal += pick.probability;
    stats.probabilityCount += 1;
  }
}

function finalizeStats(stats) {
  const selectedSettled = stats.selectedWon + stats.selectedLost;
  const unselectedSettled =
    stats.settled - stats.selectedWon - stats.selectedLost;
  const unselectedWon = stats.won - stats.selectedWon;
  return {
    ...stats,
    hitRate: stats.settled > 0 ? stats.won / stats.settled : null,
    selectedHitRate:
      selectedSettled > 0 ? stats.selectedWon / selectedSettled : null,
    unselectedHitRate:
      unselectedSettled > 0 ? unselectedWon / unselectedSettled : null,
    avgOdds: stats.oddsCount > 0 ? stats.oddsTotal / stats.oddsCount : null,
    avgProbability:
      stats.probabilityCount > 0
        ? stats.probabilityTotal / stats.probabilityCount
        : null,
    opportunityScore:
      stats.ignoredWon *
      (stats.settled > 0 ? Math.max(0, stats.won / stats.settled - 0.5) : 0),
  };
}

function buildGroups(picks, selectedKeys, groupers) {
  const groups = new Map();
  for (const pick of picks) {
    for (const grouper of groupers) {
      const item = grouper(pick);
      if (!item) continue;
      const key = `${item.group}:${item.key}`;
      const stats = groups.get(key) ?? createStats(key, item.label);
      addPick(stats, pick, selectedKeys.has(keyOf(pick)));
      groups.set(key, stats);
    }
  }
  return [...groups.values()].map(finalizeStats);
}

function candidateFilter(row) {
  return row.settled >= 10 && row.hitRate >= 0.62 && row.ignoredWon >= 5;
}

function sortCandidates(rows) {
  return [...rows]
    .filter(candidateFilter)
    .sort(
      (a, b) =>
        b.opportunityScore - a.opportunityScore ||
        b.ignoredWon - a.ignoredWon ||
        b.hitRate - a.hitRate,
    );
}

function pct(value) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

function num(value) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return value.toFixed(2);
}

function lineFor(row) {
  return `- ${row.label}: total=${row.total}, W=${row.won}, L=${row.lost}, HR=${pct(row.hitRate)}, selected=${row.selected} (${pct(row.selectedHitRate)}), ignoredW=${row.ignoredWon}, avgOdds=${num(row.avgOdds)}, avgP=${pct(row.avgProbability)}`;
}

function section(title, rows, limit = 20) {
  const lines = [title];
  for (const row of rows.slice(0, limit)) lines.push(lineFor(row));
  return lines.join('\n');
}

function buildText(report) {
  const lines = [];
  lines.push('Hidden winner segment analysis');
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push(`Range: ${report.input.from} -> ${report.input.to}`);
  lines.push('');
  lines.push('Candidate rules');
  lines.push('- settled >= 10');
  lines.push('- hit rate >= 62%');
  lines.push('- ignored winners >= 5');
  lines.push('');
  lines.push(section('Best market/pick candidates', report.candidates.marketPick));
  lines.push('');
  lines.push(section('Best canal + market/pick candidates', report.candidates.canalMarketPick));
  lines.push('');
  lines.push(section('Best odds-band candidates', report.candidates.marketPickOddsBucket));
  lines.push('');
  lines.push(section('Best probability-band candidates', report.candidates.marketPickProbabilityBucket));
  lines.push('');
  lines.push(section('Best league candidates', report.candidates.competitionMarketPick));
  lines.push('');
  lines.push('All files');
  lines.push(`- JSON: ${report.input.outJson}`);
  lines.push(`- TXT: ${report.input.outTxt}`);
  return `${lines.join('\n')}\n`;
}

function flattenInvestmentSelectionKeys(report) {
  const keys = new Set();
  for (const day of report.days ?? []) {
    for (const pick of day.investmentSelections ?? []) {
      keys.add(keyOf(pick));
    }
  }
  return keys;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const investmentReport = JSON.parse(readFileSync(args.input, 'utf8'));
  const { from, to } = investmentReport.input;
  const selectedKeys = flattenInvestmentSelectionKeys(investmentReport);

  console.log(`Loading DB picks from ${from} to ${to}...`);
  const dbPicks = runPsqlJson(dbPicksQuery(from, to));
  const settled = dbPicks.filter((pick) => pick.isCorrect != null);

  const groups = buildGroups(settled, selectedKeys, [
    (pick) => ({
      group: 'marketPick',
      key: `${pick.market}/${pick.pick}`,
      label: `${pick.market}/${pick.pick}`,
    }),
    (pick) => ({
      group: 'canalMarketPick',
      key: `${pick.canal}/${pick.market}/${pick.pick}`,
      label: `${pick.canal} ${pick.market}/${pick.pick}`,
    }),
    (pick) => ({
      group: 'marketPickOddsBucket',
      key: `${pick.market}/${pick.pick}/${oddsBucket(pick.oddsSnapshot)}`,
      label: `${pick.market}/${pick.pick} odds ${oddsBucket(pick.oddsSnapshot)}`,
    }),
    (pick) => ({
      group: 'marketPickProbabilityBucket',
      key: `${pick.market}/${pick.pick}/${probabilityBucket(pick.probability)}`,
      label: `${pick.market}/${pick.pick} prob ${probabilityBucket(pick.probability)}`,
    }),
    (pick) => ({
      group: 'competitionMarketPick',
      key: `${pick.competitionCode}/${pick.market}/${pick.pick}`,
      label: `${pick.competitionCode} ${pick.market}/${pick.pick}`,
    }),
  ]);

  const byGroup = Object.groupBy(groups, (row) => row.key.split(':')[0]);
  const report = {
    generatedAt: new Date().toISOString(),
    input: {
      source: args.input,
      outJson: args.outJson,
      outTxt: args.outTxt,
      from,
      to,
    },
    totals: {
      dbPicks: dbPicks.length,
      settled: settled.length,
      selectedKeys: selectedKeys.size,
    },
    candidates: {
      marketPick: sortCandidates(byGroup.marketPick ?? []),
      canalMarketPick: sortCandidates(byGroup.canalMarketPick ?? []),
      marketPickOddsBucket: sortCandidates(byGroup.marketPickOddsBucket ?? []),
      marketPickProbabilityBucket: sortCandidates(
        byGroup.marketPickProbabilityBucket ?? [],
      ),
      competitionMarketPick: sortCandidates(byGroup.competitionMarketPick ?? []),
    },
  };

  mkdirSync(path.dirname(args.outJson), { recursive: true });
  mkdirSync(path.dirname(args.outTxt), { recursive: true });
  writeFileSync(args.outJson, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(args.outTxt, buildText(report));
  console.log(`Wrote ${args.outJson}`);
  console.log(`Wrote ${args.outTxt}`);
}

main();
