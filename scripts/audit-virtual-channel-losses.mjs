#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_INPUT = 'apps/backend/reports/virtual-investment-channels.json';
const DEFAULT_OUT_JSON = 'apps/backend/reports/virtual-channel-loss-audit.json';
const DEFAULT_OUT_TXT = 'apps/backend/reports/virtual-channel-loss-audit.txt';

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
  node scripts/audit-virtual-channel-losses.mjs

Options:
  --input PATH      virtual-investment-channels report JSON.
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

function fixtureDiagnosticsQuery(fixtureIds) {
  const values = fixtureIds.map(sqlString).join(',');
  return `
WITH requested(id) AS (
  SELECT unnest(ARRAY[${values}]::uuid[])
),
latest AS (
  SELECT DISTINCT ON (mr."fixtureId")
    mr."fixtureId"::text AS "fixtureId",
    mr.features,
    mr."analyzedAt",
    f."homeScore",
    f."awayScore",
    f."homeHtScore",
    f."awayHtScore"
  FROM model_run mr
  JOIN fixture f ON f.id = mr."fixtureId"
  JOIN requested r ON r.id = mr."fixtureId"
  ORDER BY mr."fixtureId", mr."analyzedAt" DESC
)
SELECT COALESCE(json_agg(
  json_build_object(
    'fixtureId', l."fixtureId",
    'analyzedAt', l."analyzedAt",
    'lambdaHome', (l.features->>'lambdaHome')::float,
    'lambdaAway', (l.features->>'lambdaAway')::float,
    'recentForm', (l.features->>'recentForm')::float,
    'xg', (l.features->>'xg')::float,
    'performanceDomExt', (l.features->>'performanceDomExt')::float,
    'volatiliteLigue', (l.features->>'volatiliteLigue')::float,
    'predictionSource', l.features->>'predictionSource',
    'probabilities', l.features->'probabilities',
    'homeScore', l."homeScore",
    'awayScore', l."awayScore",
    'homeHtScore', l."homeHtScore",
    'awayHtScore', l."awayHtScore"
  )
), '[]'::json)
FROM latest l;
`;
}

function bucket(value, ranges) {
  if (value == null || Number.isNaN(value)) return 'unknown';
  for (const range of ranges) {
    if (value < range.lt) return range.label;
  }
  return ranges.at(-1)?.lastLabel ?? 'high';
}

function probabilityBucket(value) {
  return bucket(value, [
    { lt: 0.6, label: '<60%', lastLabel: '80%+' },
    { lt: 0.65, label: '60-64%', lastLabel: '80%+' },
    { lt: 0.7, label: '65-69%', lastLabel: '80%+' },
    { lt: 0.75, label: '70-74%', lastLabel: '80%+' },
    { lt: 0.8, label: '75-79%', lastLabel: '80%+' },
  ]);
}

function oddsBucket(value) {
  return bucket(value, [
    { lt: 1.3, label: '<1.30', lastLabel: '2.00+' },
    { lt: 1.4, label: '1.30-1.39', lastLabel: '2.00+' },
    { lt: 1.5, label: '1.40-1.49', lastLabel: '2.00+' },
    { lt: 1.8, label: '1.50-1.79', lastLabel: '2.00+' },
    { lt: 2, label: '1.80-1.99', lastLabel: '2.00+' },
  ]);
}

function lambdaBucket(value) {
  return bucket(value, [
    { lt: 2, label: '<2.00', lastLabel: '3.40+' },
    { lt: 2.4, label: '2.00-2.39', lastLabel: '3.40+' },
    { lt: 2.8, label: '2.40-2.79', lastLabel: '3.40+' },
    { lt: 3.1, label: '2.80-3.09', lastLabel: '3.40+' },
    { lt: 3.4, label: '3.10-3.39', lastLabel: '3.40+' },
  ]);
}

function marginBucket(pick) {
  const p = pick.probability ?? 0;
  const odds = pick.oddsSnapshot;
  if (odds == null || odds <= 0) return 'no_odds';
  const breakEven = 1 / odds;
  const margin = p - breakEven;
  if (margin < 0) return 'negative_ev_margin';
  if (margin < 0.03) return 'thin_0-3pp';
  if (margin < 0.07) return 'ok_3-7pp';
  return 'wide_7pp+';
}

function summarize(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const row = map.get(key) ?? {
      key,
      total: 0,
      won: 0,
      lost: 0,
      avgProbability: 0,
      avgOdds: 0,
      oddsCount: 0,
      avgLambdaTotal: 0,
      lambdaCount: 0,
      examples: [],
    };
    row.total += 1;
    if (item.isCorrect === true) row.won += 1;
    if (item.isCorrect === false) row.lost += 1;
    row.avgProbability += item.probability ?? 0;
    if (item.oddsSnapshot != null) {
      row.avgOdds += item.oddsSnapshot;
      row.oddsCount += 1;
    }
    if (item.lambdaTotal != null) {
      row.avgLambdaTotal += item.lambdaTotal;
      row.lambdaCount += 1;
    }
    if (item.isCorrect === false && row.examples.length < 8) {
      row.examples.push({
        day: item.day,
        fixture: item.fixture,
        competitionCode: item.competitionCode,
        virtualChannel: item.virtualChannel,
        market: item.market,
        pick: item.pick,
        probability: item.probability,
        oddsSnapshot: item.oddsSnapshot,
        score: item.score,
        lambdaTotal: item.lambdaTotal,
      });
    }
    map.set(key, row);
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      hitRate: row.total > 0 ? row.won / row.total : null,
      lossRate: row.total > 0 ? row.lost / row.total : null,
      avgProbability: row.total > 0 ? row.avgProbability / row.total : null,
      avgOdds: row.oddsCount > 0 ? row.avgOdds / row.oddsCount : null,
      avgLambdaTotal:
        row.lambdaCount > 0 ? row.avgLambdaTotal / row.lambdaCount : null,
    }))
    .sort((a, b) => b.lost - a.lost || b.lossRate - a.lossRate);
}

function scoreFromRow(row) {
  if (row.homeScore == null || row.awayScore == null) return null;
  return `${row.homeScore} - ${row.awayScore}`;
}

function collectPicks(report) {
  const byKey = new Map();

  for (const day of report.days ?? []) {
    for (const listName of ['top5Picks', 'top10Picks']) {
      const inTop5 = listName === 'top5Picks';
      for (const pick of day[listName] ?? []) {
        const key = `${pick.fixtureId}:${pick.virtualChannel}:${pick.market}:${pick.pick}`;
        const existing = byKey.get(key);
        byKey.set(key, {
          ...(existing ?? {}),
          ...pick,
          day: day.date,
          inTop5: Boolean(existing?.inTop5 || inTop5),
          inTop10: true,
        });
      }
    }
  }

  return [...byKey.values()];
}

function parseScore(score) {
  if (!score || typeof score !== 'string') return { homeScore: null, awayScore: null };
  const [home, away] = score.split('-').map((value) => Number(value.trim()));
  return {
    homeScore: Number.isFinite(home) ? home : null,
    awayScore: Number.isFinite(away) ? away : null,
  };
}

function enrichPicks(picks, diagnostics) {
  const byFixture = new Map(diagnostics.map((row) => [row.fixtureId, row]));
  return picks.map((pick) => {
    const diag = byFixture.get(pick.fixtureId) ?? {};
    const lambdaHome =
      typeof diag.lambdaHome === 'number' && Number.isFinite(diag.lambdaHome)
        ? diag.lambdaHome
        : null;
    const lambdaAway =
      typeof diag.lambdaAway === 'number' && Number.isFinite(diag.lambdaAway)
        ? diag.lambdaAway
        : null;
    const homeScore =
      typeof diag.homeScore === 'number' && Number.isFinite(diag.homeScore)
        ? diag.homeScore
        : parseScore(pick.score).homeScore;
    const awayScore =
      typeof diag.awayScore === 'number' && Number.isFinite(diag.awayScore)
        ? diag.awayScore
        : parseScore(pick.score).awayScore;
    return {
      ...pick,
      homeScore,
      awayScore,
      score:
        homeScore !== null && awayScore !== null
          ? `${homeScore} - ${awayScore}`
          : pick.score,
      homeHtScore: diag.homeHtScore ?? null,
      awayHtScore: diag.awayHtScore ?? null,
      lambdaHome,
      lambdaAway,
      lambdaTotal:
        lambdaHome !== null && lambdaAway !== null ? lambdaHome + lambdaAway : null,
      recentForm: diag.recentForm ?? null,
      xg: diag.xg ?? null,
      performanceDomExt: diag.performanceDomExt ?? null,
      volatiliteLigue: diag.volatiliteLigue ?? null,
      predictionSource: diag.predictionSource ?? null,
      probabilities: diag.probabilities ?? null,
    };
  });
}

function topN(rows, n = 20) {
  return rows.slice(0, n);
}

function buildReport(inputReport, args, diagnostics) {
  const picks = enrichPicks(collectPicks(inputReport), diagnostics);
  const losses = picks.filter((pick) => pick.isCorrect === false);
  const wins = picks.filter((pick) => pick.isCorrect === true);

  const top5 = picks.filter((pick) => pick.inTop5);
  const top10 = picks.filter((pick) => pick.inTop10);

  return {
    generatedAt: new Date().toISOString(),
    input: {
      source: args.input,
      outJson: args.outJson,
      outTxt: args.outTxt,
      from: inputReport.input.from,
      to: inputReport.input.to,
    },
    totals: {
      picks: picks.length,
      wins: wins.length,
      losses: losses.length,
      top5: {
        total: top5.length,
        losses: top5.filter((pick) => pick.isCorrect === false).length,
      },
      top10: {
        total: top10.length,
        losses: top10.filter((pick) => pick.isCorrect === false).length,
      },
    },
    lossSummaries: {
      byChannel: summarize(picks, (pick) => pick.virtualChannel),
      byChannelLeague: summarize(
        picks,
        (pick) => `${pick.virtualChannel}/${pick.competitionCode}`,
      ),
      byChannelProbabilityBucket: summarize(
        picks,
        (pick) => `${pick.virtualChannel}/${probabilityBucket(pick.probability)}`,
      ),
      byChannelOddsBucket: summarize(
        picks,
        (pick) => `${pick.virtualChannel}/${oddsBucket(pick.oddsSnapshot)}`,
      ),
      byChannelLambdaBucket: summarize(
        picks,
        (pick) => `${pick.virtualChannel}/${lambdaBucket(pick.lambdaTotal)}`,
      ),
      byChannelEvMargin: summarize(
        picks,
        (pick) => `${pick.virtualChannel}/${marginBucket(pick)}`,
      ),
    },
    losses: losses.map((pick) => ({
      day: pick.day,
      inTop5: pick.inTop5,
      inTop10: pick.inTop10,
      fixtureId: pick.fixtureId,
      fixture: pick.fixture,
      competitionCode: pick.competitionCode,
      virtualChannel: pick.virtualChannel,
      market: pick.market,
      pick: pick.pick,
      probability: pick.probability,
      oddsSnapshot: pick.oddsSnapshot,
      score: pick.score,
      lambdaHome: pick.lambdaHome,
      lambdaAway: pick.lambdaAway,
      lambdaTotal: pick.lambdaTotal,
      recentForm: pick.recentForm,
      xg: pick.xg,
      performanceDomExt: pick.performanceDomExt,
      volatiliteLigue: pick.volatiliteLigue,
      predictionSource: pick.predictionSource,
    })),
  };
}

function pct(value) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

function num(value) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return value.toFixed(2);
}

function section(title, rows, limit = 18) {
  const lines = [title];
  for (const row of topN(rows, limit)) {
    lines.push(
      `- ${row.key}: total=${row.total}, W=${row.won}, L=${row.lost}, lossRate=${pct(row.lossRate)}, avgP=${pct(row.avgProbability)}, avgOdds=${num(row.avgOdds)}, avgLambda=${num(row.avgLambdaTotal)}`,
    );
  }
  return lines.join('\n');
}

function lossLine(loss) {
  const rank = loss.inTop5 ? 'top5' : 'top10';
  return `- ${loss.day} ${rank} ${loss.virtualChannel} ${loss.fixture} (${loss.competitionCode}) ${loss.market}/${loss.pick} P=${pct(loss.probability)} odds=${num(loss.oddsSnapshot)} lambda=${num(loss.lambdaTotal)} score=${loss.score}`;
}

function buildText(report) {
  const lines = [];
  lines.push('Virtual channel loss audit');
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push(`Range: ${report.input.from} -> ${report.input.to}`);
  lines.push('');
  lines.push('Totals');
  lines.push(`- picks audited: ${report.totals.picks}`);
  lines.push(`- wins: ${report.totals.wins}`);
  lines.push(`- losses: ${report.totals.losses}`);
  lines.push(`- top5 losses: ${report.totals.top5.losses}/${report.totals.top5.total}`);
  lines.push(
    `- top10 losses: ${report.totals.top10.losses}/${report.totals.top10.total}`,
  );
  lines.push('');
  lines.push(section('Loss patterns by channel', report.lossSummaries.byChannel));
  lines.push('');
  lines.push(
    section('Loss patterns by channel/league', report.lossSummaries.byChannelLeague),
  );
  lines.push('');
  lines.push(
    section(
      'Loss patterns by probability bucket',
      report.lossSummaries.byChannelProbabilityBucket,
    ),
  );
  lines.push('');
  lines.push(
    section('Loss patterns by odds bucket', report.lossSummaries.byChannelOddsBucket),
  );
  lines.push('');
  lines.push(
    section(
      'Loss patterns by lambda bucket',
      report.lossSummaries.byChannelLambdaBucket,
    ),
  );
  lines.push('');
  lines.push(
    section('Loss patterns by EV margin', report.lossSummaries.byChannelEvMargin),
  );
  lines.push('');
  lines.push('Top5 losses');
  for (const loss of report.losses.filter((row) => row.inTop5)) {
    lines.push(lossLine(loss));
  }
  lines.push('');
  lines.push('All losses');
  for (const loss of report.losses) {
    lines.push(lossLine(loss));
  }
  lines.push('');
  lines.push('Files');
  lines.push(`- JSON: ${report.input.outJson}`);
  lines.push(`- TXT: ${report.input.outTxt}`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputReport = JSON.parse(readFileSync(args.input, 'utf8'));
  const fixtureIds = [
    ...new Set(collectPicks(inputReport).map((pick) => pick.fixtureId)),
  ];
  console.log(`Loading diagnostics for ${fixtureIds.length} fixtures...`);
  const diagnostics =
    fixtureIds.length > 0 ? runPsqlJson(fixtureDiagnosticsQuery(fixtureIds)) : [];
  const report = buildReport(inputReport, args, diagnostics);

  mkdirSync(path.dirname(args.outJson), { recursive: true });
  mkdirSync(path.dirname(args.outTxt), { recursive: true });
  writeFileSync(args.outJson, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(args.outTxt, buildText(report));
  console.log(`Wrote ${args.outJson}`);
  console.log(`Wrote ${args.outTxt}`);
}

main();
