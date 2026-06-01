#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_FROM = '2026-04-02';
const DEFAULT_TO = '2026-06-01';
const DEFAULT_OUT_JSON =
  'apps/backend/reports/virtual-investment-channels.json';
const DEFAULT_OUT_TXT =
  'apps/backend/reports/virtual-investment-channels.txt';

const CHANNELS = [
  {
    code: 'SAFE_HT_OVER05',
    label: 'Over 0.5 HT',
    market: 'OVER_UNDER_HT',
    pick: 'OVER_0_5',
    prior: 0.805,
    minProbability: 0.65,
    maxProbability: 0.85,
    maxOdds: 1.5,
  },
  {
    code: 'SAFE_UNDER45',
    label: 'Under 4.5',
    market: 'OVER_UNDER',
    pick: 'UNDER_4_5',
    prior: 0.818,
    minProbability: 0.75,
    maxProbability: 0.95,
    maxOdds: 1.5,
  },
  {
    code: 'SAFE_OVER15',
    label: 'Over 1.5',
    market: 'OVER_UNDER',
    pick: 'OVER_1_5',
    prior: 0.738,
    minProbability: 0.75,
    maxProbability: 0.85,
    maxOdds: 1.5,
  },
  {
    code: 'SAFE_UNDER35',
    label: 'Under 3.5',
    market: 'OVER_UNDER',
    pick: 'UNDER_3_5',
    prior: 0.692,
    minProbability: 0.65,
    maxProbability: 0.85,
    maxOdds: 1.8,
    leagueBoosts: { CH: 0.08 },
  },
  {
    code: 'BTTS_YES',
    label: 'BTTS Yes',
    market: 'BTTS',
    pick: 'YES',
    prior: 0.655,
    minProbability: 0.55,
    maxProbability: 0.75,
    allowMissingOdds: true,
    leagueBoosts: { SP2: 0.06, ERD: 0.02 },
  },
];

function parseArgs(argv) {
  const args = {
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    outJson: DEFAULT_OUT_JSON,
    outTxt: DEFAULT_OUT_TXT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--from') {
      args.from = next;
      i += 1;
    } else if (arg === '--to') {
      args.to = next;
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
  node scripts/backtest-virtual-investment-channels.mjs --from 2026-04-02 --to 2026-06-01

Options:
  --from YYYY-MM-DD
  --to YYYY-MM-DD
  --out-json PATH
  --out-txt PATH`);
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
    b.status::text AS status
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
    END AS status
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

function matchChannel(pick) {
  return CHANNELS.find((channel) => {
    if (pick.market !== channel.market || pick.pick !== channel.pick) return false;
    if (pick.probability < channel.minProbability) return false;
    if (pick.probability >= channel.maxProbability) return false;
    if (!channel.allowMissingOdds && pick.oddsSnapshot == null) return false;
    if (channel.minOdds != null && pick.oddsSnapshot < channel.minOdds) {
      return false;
    }
    if (channel.maxOdds != null && pick.oddsSnapshot >= channel.maxOdds) {
      return false;
    }
    return true;
  });
}

function scoreCandidate(pick, channel) {
  const leagueBoost = channel.leagueBoosts?.[pick.competitionCode] ?? 0;
  const oddsPenalty =
    pick.oddsSnapshot == null ? 0 : Math.max(0, pick.oddsSnapshot - 1.4) * 0.02;
  return channel.prior + leagueBoost + pick.probability * 0.08 - oddsPenalty;
}

function buildCandidates(picks) {
  return picks
    .map((pick) => {
      const channel = matchChannel(pick);
      if (!channel) return null;
      return {
        ...pick,
        virtualChannel: channel.code,
        virtualChannelLabel: channel.label,
        virtualScore: scoreCandidate(pick, channel),
        virtualPrior: channel.prior,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.virtualScore - a.virtualScore);
}

function selectTop(candidates, limit) {
  const selected = [];
  const fixtureIds = new Set();
  const channelCounts = new Map();

  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (fixtureIds.has(candidate.fixtureId)) continue;

    const channelCount = channelCounts.get(candidate.virtualChannel) ?? 0;
    const channelCap = limit <= 5 ? 2 : 3;
    if (channelCount >= channelCap) continue;

    selected.push(candidate);
    fixtureIds.add(candidate.fixtureId);
    channelCounts.set(candidate.virtualChannel, channelCount + 1);
  }

  return selected;
}

function summarizePicks(picks) {
  const settled = picks.filter((pick) => pick.isCorrect != null);
  const won = settled.filter((pick) => pick.isCorrect === true).length;
  const lost = settled.filter((pick) => pick.isCorrect === false).length;
  return {
    total: picks.length,
    settled: settled.length,
    won,
    lost,
    pending: picks.length - settled.length,
    hitRate: settled.length > 0 ? won / settled.length : null,
    avgOdds: average(picks.map((pick) => pick.oddsSnapshot).filter(isNumber)),
    avgProbability: average(picks.map((pick) => pick.probability).filter(isNumber)),
  };
}

function summarizeBy(items, keyFn) {
  const buckets = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, picks]) => ({ key, ...summarizePicks(picks) }))
    .sort((a, b) => b.won - a.won || b.hitRate - a.hitRate);
}

function summarizeDaily(days, field) {
  const eligible = days.filter((day) => day[field].total > 0);
  const fullTop5 = days.filter((day) => day.top5.total === 5);
  const fullTop10 = days.filter((day) => day.top10.total === 10);
  return {
    activeDays: eligible.length,
    fullTop5Days: fullTop5.length,
    fullTop10Days: fullTop10.length,
    perfectTop5Days: fullTop5.filter((day) => day.top5.won === 5).length,
    perfectTop10Days: fullTop10.filter((day) => day.top10.won === 10).length,
    avgWinners:
      eligible.length > 0
        ? average(eligible.map((day) => day[field].won))
        : null,
    avgSelections:
      eligible.length > 0
        ? average(eligible.map((day) => day[field].total))
        : null,
    hitRate: ratioSum(eligible.map((day) => day[field])),
  };
}

function ratioSum(rows) {
  const settled = rows.reduce((sum, row) => sum + row.settled, 0);
  const won = rows.reduce((sum, row) => sum + row.won, 0);
  return settled > 0 ? won / settled : null;
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compactPick(pick) {
  return {
    day: pick.day,
    fixtureId: pick.fixtureId,
    fixture: `${pick.homeTeam} vs ${pick.awayTeam}`,
    competitionCode: pick.competitionCode,
    virtualChannel: pick.virtualChannel,
    market: pick.market,
    pick: pick.pick,
    probability: pick.probability,
    oddsSnapshot: pick.oddsSnapshot,
    isCorrect: pick.isCorrect,
    virtualScore: pick.virtualScore,
  };
}

function buildReport(picks, args) {
  const candidates = buildCandidates(picks).filter((pick) => pick.isCorrect != null);
  const byDay = new Map();
  for (const candidate of candidates) {
    const bucket = byDay.get(candidate.day) ?? [];
    bucket.push(candidate);
    byDay.set(candidate.day, bucket);
  }

  const days = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayCandidates]) => {
      const top5Picks = selectTop(dayCandidates, 5);
      const top10Picks = selectTop(dayCandidates, 10);
      return {
        date,
        candidates: summarizePicks(dayCandidates),
        top5: summarizePicks(top5Picks),
        top10: summarizePicks(top10Picks),
        top5Picks: top5Picks.map(compactPick),
        top10Picks: top10Picks.map(compactPick),
      };
    });

  const allTop5 = days.flatMap((day) => day.top5Picks);
  const allTop10 = days.flatMap((day) => day.top10Picks);

  return {
    generatedAt: new Date().toISOString(),
    input: {
      from: args.from,
      to: args.to,
      outJson: args.outJson,
      outTxt: args.outTxt,
    },
    rules: CHANNELS,
    totals: {
      dbPicks: picks.length,
      virtualCandidates: summarizePicks(candidates),
      top5: summarizePicks(allTop5),
      top10: summarizePicks(allTop10),
    },
    daily: {
      candidates: summarizeDaily(days, 'candidates'),
      top5: summarizeDaily(days, 'top5'),
      top10: summarizeDaily(days, 'top10'),
    },
    byVirtualChannel: summarizeBy(candidates, (pick) => pick.virtualChannel),
    top5ByVirtualChannel: summarizeBy(allTop5, (pick) => pick.virtualChannel),
    top10ByVirtualChannel: summarizeBy(allTop10, (pick) => pick.virtualChannel),
    byLeagueChannel: summarizeBy(
      candidates,
      (pick) => `${pick.competitionCode}/${pick.virtualChannel}`,
    ).slice(0, 40),
    days,
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

function summaryLine(label, row) {
  return `- ${label}: total=${row.total}, W=${row.won}, L=${row.lost}, HR=${pct(row.hitRate)}, avgOdds=${num(row.avgOdds)}, avgP=${pct(row.avgProbability)}`;
}

function section(title, rows, limit = 20) {
  const lines = [title];
  for (const row of rows.slice(0, limit)) {
    lines.push(summaryLine(row.key, row));
  }
  return lines.join('\n');
}

function buildText(report) {
  const lines = [];
  lines.push('Virtual investment channels backtest');
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push(`Range: ${report.input.from} -> ${report.input.to}`);
  lines.push('');
  lines.push('Totals');
  lines.push(summaryLine('virtual candidates', report.totals.virtualCandidates));
  lines.push(summaryLine('daily top 5', report.totals.top5));
  lines.push(summaryLine('daily top 10', report.totals.top10));
  lines.push('');
  lines.push('Daily coverage');
  lines.push(
    `- candidate active days: ${report.daily.candidates.activeDays}, avg candidates/day=${num(report.daily.candidates.avgSelections)}, avg winners/day=${num(report.daily.candidates.avgWinners)}, HR=${pct(report.daily.candidates.hitRate)}`,
  );
  lines.push(
    `- full top5 days: ${report.daily.top5.fullTop5Days}, perfect top5 days=${report.daily.top5.perfectTop5Days}, avg winners/day=${num(report.daily.top5.avgWinners)}, HR=${pct(report.daily.top5.hitRate)}`,
  );
  lines.push(
    `- full top10 days: ${report.daily.top10.fullTop10Days}, perfect top10 days=${report.daily.top10.perfectTop10Days}, avg winners/day=${num(report.daily.top10.avgWinners)}, HR=${pct(report.daily.top10.hitRate)}`,
  );
  lines.push('');
  lines.push(section('Candidates by virtual channel', report.byVirtualChannel));
  lines.push('');
  lines.push(section('Top 5 by virtual channel', report.top5ByVirtualChannel));
  lines.push('');
  lines.push(section('Top 10 by virtual channel', report.top10ByVirtualChannel));
  lines.push('');
  lines.push(section('Best league/channel pairs', report.byLeagueChannel));
  lines.push('');
  lines.push('Best top5 days');
  for (const day of [...report.days]
    .filter((day) => day.top5.total === 5)
    .sort((a, b) => b.top5.won - a.top5.won || b.candidates.total - a.candidates.total)
    .slice(0, 15)) {
    lines.push(
      `- ${day.date}: top5 ${day.top5.won}/5, candidates=${day.candidates.total}, candidate winners=${day.candidates.won}`,
    );
  }
  lines.push('');
  lines.push('Worst top5 days');
  for (const day of [...report.days]
    .filter((day) => day.top5.total === 5)
    .sort((a, b) => a.top5.won - b.top5.won || b.candidates.total - a.candidates.total)
    .slice(0, 15)) {
    lines.push(
      `- ${day.date}: top5 ${day.top5.won}/5, candidates=${day.candidates.total}, candidate winners=${day.candidates.won}`,
    );
  }
  lines.push('');
  lines.push('Files');
  lines.push(`- JSON: ${report.input.outJson}`);
  lines.push(`- TXT: ${report.input.outTxt}`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Loading DB picks from ${args.from} to ${args.to}...`);
  const picks = runPsqlJson(dbPicksQuery(args.from, args.to));
  const report = buildReport(picks, args);

  mkdirSync(path.dirname(args.outJson), { recursive: true });
  mkdirSync(path.dirname(args.outTxt), { recursive: true });
  writeFileSync(args.outJson, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(args.outTxt, buildText(report));
  console.log(`Wrote ${args.outJson}`);
  console.log(`Wrote ${args.outTxt}`);
}

main();
