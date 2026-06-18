#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_API_BASE = 'http://localhost:3001';
const DEFAULT_OUT_JSON =
  'apps/backend/reports/investment-vs-picks-analysis.json';
const DEFAULT_OUT_TXT =
  'apps/backend/reports/investment-vs-picks-analysis.txt';

function parseArgs(argv) {
  const args = {
    from: null,
    to: null,
    apiBase: DEFAULT_API_BASE,
    outJson: DEFAULT_OUT_JSON,
    outTxt: DEFAULT_OUT_TXT,
    maxDays: null,
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
    } else if (arg === '--api-base') {
      args.apiBase = next;
      i += 1;
    } else if (arg === '--out-json') {
      args.outJson = next;
      i += 1;
    } else if (arg === '--out-txt') {
      args.outTxt = next;
      i += 1;
    } else if (arg === '--max-days') {
      args.maxDays = Number(next);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(`${today}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 60);

  args.to ??= today;
  args.from ??= from.toISOString().slice(0, 10);

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/export-investment-vs-picks.mjs --from 2026-04-02 --to 2026-06-01

Options:
  --from YYYY-MM-DD       Start date. Defaults to UTC today minus 60 days.
  --to YYYY-MM-DD         End date. Defaults to UTC today.
  --api-base URL          Backend base URL. Defaults to ${DEFAULT_API_BASE}.
  --out-json PATH         JSON report path.
  --out-txt PATH          Text summary path.
  --max-days N            Limit active dates, useful for a quick probe.`);
}

function assertIsoDate(label, value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD, got: ${value}`);
  }
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

function dbQuery(from, to) {
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
    f.status::text AS "fixtureStatus",
    f."homeScore" AS "homeScore",
    f."awayScore" AS "awayScore",
    CASE cd.channel
      WHEN 'SAFE' THEN 'SV'
      WHEN 'DOMINANT' THEN 'CONF'
      WHEN 'BTTS' THEN 'BB'
      WHEN 'DRAW' THEN 'NUL'
      ELSE cd.channel::text
    END AS canal,
    cs.market::text AS market,
    cs.pick AS pick,
    cs.probability::float AS probability,
    COALESCE(b."oddsSnapshot", cs.odds)::float AS "oddsSnapshot",
    CASE
      WHEN COALESCE(b.status, cs.result) = 'WON' THEN true
      WHEN COALESCE(b.status, cs.result) = 'LOST' THEN false
      ELSE NULL
    END AS "isCorrect",
    COALESCE(b.status::text, cs.result::text, 'PENDING') AS status,
    cs.id::text AS "sourceId",
    'channel_selection' AS "sourceType"
  FROM channel_selection cs
  JOIN channel_decision cd ON cd.id = cs."channelDecisionId"
  JOIN model_run mr ON mr.id = cd."modelRunId"
  JOIN fixture f ON f.id = mr."fixtureId"
  LEFT JOIN bet b ON b."channelSelectionId" = cs.id AND b.source = 'MODEL'
  JOIN team ht ON ht.id = f."homeTeamId"
  JOIN team at ON at.id = f."awayTeamId"
  JOIN season s ON s.id = f."seasonId"
  JOIN competition c ON c.id = s."competitionId"
  WHERE cd.status = 'SELECTED'
    AND DATE(f."scheduledAt") BETWEEN DATE ${sqlString(from)} AND DATE ${sqlString(to)}
)
SELECT COALESCE(json_agg(db_picks ORDER BY day, "scheduledAt", "fixtureId", canal), '[]'::json)
FROM db_picks;
`;
}

function activeDatesFromPicks(picks, maxDays) {
  const dates = [...new Set(picks.map((pick) => pick.day))].sort();
  if (Number.isFinite(maxDays) && maxDays > 0) return dates.slice(0, maxDays);
  return dates;
}

async function fetchInvestment(apiBase, date) {
  const url = new URL('/ai-engine/investment', apiBase);
  url.searchParams.set('date', date);

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`GET ${url} failed: ${response.status} ${body.slice(0, 200)}`);
  }
  return response.json();
}

function keyOf(pick) {
  return `${pick.fixtureId}|${pick.canal}|${pick.market}|${pick.pick}`;
}

function flattenInvestmentSelections(day) {
  const selections = [];
  for (const [canal, picks] of Object.entries(day.selections ?? {})) {
    for (const pick of picks ?? []) {
      selections.push({ ...pick, canal: pick.canal ?? canal });
    }
  }
  return selections;
}

function flattenInvestmentCouponLegs(day) {
  const legs = [];
  for (const coupon of day.coupons ?? []) {
    for (const leg of coupon.legs ?? []) {
      legs.push({ ...leg, couponRank: coupon.rank });
    }
  }
  return legs;
}

function summarizeBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const current = map.get(key) ?? {
      key,
      total: 0,
      won: 0,
      lost: 0,
      pending: 0,
    };
    current.total += 1;
    if (item.isCorrect === true) current.won += 1;
    else if (item.isCorrect === false) current.lost += 1;
    else current.pending += 1;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.won - a.won || b.total - a.total);
}

function buildAnalysis(dbPicks, investmentByDate, dates, args) {
  const dateSet = new Set(dates);
  const scopedDbPicks = dbPicks.filter((pick) => dateSet.has(pick.day));
  const byDate = new Map();
  for (const pick of scopedDbPicks) {
    const bucket = byDate.get(pick.day) ?? [];
    bucket.push(pick);
    byDate.set(pick.day, bucket);
  }

  const days = [];
  const allIgnoredWinners = [];
  const allInvestmentSelections = [];
  const allInvestmentCouponLegs = [];

  for (const date of dates) {
    const dbDayPicks = byDate.get(date) ?? [];
    const investment = investmentByDate[date] ?? null;
    const selections = investment ? flattenInvestmentSelections(investment) : [];
    const couponLegs = investment ? flattenInvestmentCouponLegs(investment) : [];
    const selectionKeys = new Set(selections.map(keyOf));
    const couponLegKeys = new Set(couponLegs.map(keyOf));
    const dbWinners = dbDayPicks.filter((pick) => pick.isCorrect === true);
    const selectedWinners = selections.filter((pick) => pick.isCorrect === true);
    const selectedLosers = selections.filter((pick) => pick.isCorrect === false);
    const ignoredWinners = dbWinners.filter((pick) => !selectionKeys.has(keyOf(pick)));

    allIgnoredWinners.push(...ignoredWinners);
    allInvestmentSelections.push(...selections);
    allInvestmentCouponLegs.push(...couponLegs);

    days.push({
      date,
      db: {
        total: dbDayPicks.length,
        winners: dbWinners.length,
        losers: dbDayPicks.filter((pick) => pick.isCorrect === false).length,
        pending: dbDayPicks.filter((pick) => pick.isCorrect == null).length,
      },
      investment: {
        totalCandidates: investment?.totalCandidates ?? null,
        isAiCurated: investment?.isAiCurated ?? null,
        selections: selections.length,
        selectedWinners: selectedWinners.length,
        selectedLosers: selectedLosers.length,
        selectedPending: selections.filter((pick) => pick.isCorrect == null).length,
        couponLegs: couponLegs.length,
        couponLegWinners: couponLegs.filter((pick) => pick.isCorrect === true).length,
        couponLegLosers: couponLegs.filter((pick) => pick.isCorrect === false).length,
      },
      missed: {
        dbWinnersNotInInvestmentSelections: ignoredWinners.length,
        dbWinnersNotInInvestmentCoupons: dbWinners.filter(
          (pick) => !couponLegKeys.has(keyOf(pick)),
        ).length,
      },
      ignoredWinners: ignoredWinners.map(compactPick),
      investmentSelections: selections.map(compactPick),
      investmentCouponLegs: couponLegs.map(compactPick),
    });
  }

  const settledSelections = allInvestmentSelections.filter(
    (pick) => pick.isCorrect != null,
  );

  return {
    generatedAt: new Date().toISOString(),
    input: {
      from: args.from,
      to: args.to,
      apiBase: args.apiBase,
      activeDates: dates.length,
    },
    totals: {
      dbPicks: scopedDbPicks.length,
      dbWinners: scopedDbPicks.filter((pick) => pick.isCorrect === true).length,
      dbLosers: scopedDbPicks.filter((pick) => pick.isCorrect === false).length,
      dbPending: scopedDbPicks.filter((pick) => pick.isCorrect == null).length,
      investmentSelections: allInvestmentSelections.length,
      investmentSelectionWinners: allInvestmentSelections.filter(
        (pick) => pick.isCorrect === true,
      ).length,
      investmentSelectionLosers: allInvestmentSelections.filter(
        (pick) => pick.isCorrect === false,
      ).length,
      investmentSelectionHitRate:
        settledSelections.length > 0
          ? allInvestmentSelections.filter((pick) => pick.isCorrect === true)
              .length / settledSelections.length
          : null,
      ignoredDbWinners: allIgnoredWinners.length,
      investmentCouponLegs: allInvestmentCouponLegs.length,
    },
    summaries: {
      dbByCanal: summarizeBy(scopedDbPicks, (pick) => pick.canal),
      dbByMarketPick: summarizeBy(
        scopedDbPicks,
        (pick) => `${pick.market}/${pick.pick}`,
      ),
      ignoredWinnersByCanal: summarizeBy(allIgnoredWinners, (pick) => pick.canal),
      ignoredWinnersByMarketPick: summarizeBy(
        allIgnoredWinners,
        (pick) => `${pick.market}/${pick.pick}`,
      ),
      investmentSelectionsByCanal: summarizeBy(
        allInvestmentSelections,
        (pick) => pick.canal,
      ),
      investmentSelectionsByMarketPick: summarizeBy(
        allInvestmentSelections,
        (pick) => `${pick.market}/${pick.pick}`,
      ),
    },
    days,
  };
}

function compactPick(pick) {
  return {
    fixtureId: pick.fixtureId,
    fixture:
      pick.fixture ??
      (pick.homeTeam && pick.awayTeam ? `${pick.homeTeam} vs ${pick.awayTeam}` : null),
    competition: pick.competition,
    country: pick.country ?? null,
    scheduledAt: pick.scheduledAt,
    canal: pick.canal,
    market: pick.market,
    pick: pick.pick,
    probability: pick.probability ?? null,
    oddsSnapshot: pick.oddsSnapshot ?? null,
    isCorrect: pick.isCorrect ?? null,
    score:
      pick.score ??
      (pick.homeScore != null && pick.awayScore != null
        ? `${pick.homeScore} - ${pick.awayScore}`
        : null),
  };
}

function pct(value) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

function topLines(title, rows, limit = 12) {
  const lines = [title];
  for (const row of rows.slice(0, limit)) {
    const settled = row.won + row.lost;
    lines.push(
      `- ${row.key}: total=${row.total}, W=${row.won}, L=${row.lost}, pending=${row.pending}, HR=${pct(settled > 0 ? row.won / settled : null)}`,
    );
  }
  return lines.join('\n');
}

function buildTextReport(report) {
  const lines = [];
  lines.push('Investment vs picks analysis');
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push(`Range: ${report.input.from} -> ${report.input.to}`);
  lines.push(`Active dates: ${report.input.activeDates}`);
  lines.push('');
  lines.push('Totals');
  lines.push(`- DB picks: ${report.totals.dbPicks}`);
  lines.push(`- DB winners: ${report.totals.dbWinners}`);
  lines.push(`- DB losers: ${report.totals.dbLosers}`);
  lines.push(`- DB pending: ${report.totals.dbPending}`);
  lines.push(`- Investment selections: ${report.totals.investmentSelections}`);
  lines.push(
    `- Investment selection winners: ${report.totals.investmentSelectionWinners}`,
  );
  lines.push(
    `- Investment selection losers: ${report.totals.investmentSelectionLosers}`,
  );
  lines.push(
    `- Investment selection hit rate: ${pct(report.totals.investmentSelectionHitRate)}`,
  );
  lines.push(`- DB winners ignored by investment: ${report.totals.ignoredDbWinners}`);
  lines.push('');
  lines.push(topLines('DB picks by canal', report.summaries.dbByCanal));
  lines.push('');
  lines.push(
    topLines(
      'Ignored DB winners by market/pick',
      report.summaries.ignoredWinnersByMarketPick,
    ),
  );
  lines.push('');
  lines.push(
    topLines(
      'Investment selections by market/pick',
      report.summaries.investmentSelectionsByMarketPick,
    ),
  );
  lines.push('');
  lines.push('Worst missed-winner days');
  for (const day of [...report.days]
    .sort(
      (a, b) =>
        b.missed.dbWinnersNotInInvestmentSelections -
          a.missed.dbWinnersNotInInvestmentSelections ||
        b.db.winners - a.db.winners,
    )
    .slice(0, 20)) {
    lines.push(
      `- ${day.date}: DB winners=${day.db.winners}, investment winners=${day.investment.selectedWinners}, ignored winners=${day.missed.dbWinnersNotInInvestmentSelections}, investment selections=${day.investment.selections}`,
    );
  }
  lines.push('');
  lines.push('Files');
  lines.push(`- JSON: ${report.input.outJson ?? DEFAULT_OUT_JSON}`);
  lines.push(`- TXT: ${report.input.outTxt ?? DEFAULT_OUT_TXT}`);
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertIsoDate('--from', args.from);
  assertIsoDate('--to', args.to);

  console.log(`Loading DB picks from ${args.from} to ${args.to}...`);
  const dbPicks = runPsqlJson(dbQuery(args.from, args.to));
  const dates = activeDatesFromPicks(dbPicks, args.maxDays);
  console.log(`Found ${dbPicks.length} DB picks across ${dates.length} active dates.`);

  const investmentByDate = {};
  for (const [index, date] of dates.entries()) {
    console.log(`Fetching investment ${index + 1}/${dates.length}: ${date}`);
    investmentByDate[date] = await fetchInvestment(args.apiBase, date);
  }

  const report = buildAnalysis(dbPicks, investmentByDate, dates, args);
  report.input.outJson = args.outJson;
  report.input.outTxt = args.outTxt;

  mkdirSync(path.dirname(args.outJson), { recursive: true });
  mkdirSync(path.dirname(args.outTxt), { recursive: true });
  writeFileSync(args.outJson, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(args.outTxt, buildTextReport(report));

  console.log(`Wrote ${args.outJson}`);
  console.log(`Wrote ${args.outTxt}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
