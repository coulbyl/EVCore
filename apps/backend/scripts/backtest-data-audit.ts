/**
 * Data audit script — step 1 of the investment page backtest.
 *
 * Outputs settled volumes by canal × league × month to confirm coverage
 * before launching the grid search in backtest-investment.ts.
 *
 * Run: cd apps/backend && ./node_modules/.bin/tsx --env-file=.env scripts/backtest-data-audit.ts
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@evcore/db';

type BetAuditRow = {
  canal: string;
  league: string;
  month: string;
  total: bigint;
  won: bigint;
};

type PredAuditRow = {
  canal: string;
  league: string;
  month: string;
  total: bigint;
  correct: bigint;
};

type MonthlyRow = {
  canal: string;
  league: string;
  month: string;
  total: number;
  won: number;
  hitRate: number;
};

async function run(): Promise<void> {
  console.log('EVCore — Backtest data audit\n');

  // ── 1. Bets (EV / SV) ──────────────────────────────────────────────────────
  const betRows = await prisma.$queryRaw<BetAuditRow[]>`
    SELECT
      CASE WHEN b."isSafeValue" THEN 'SV' ELSE 'EV' END AS canal,
      c.code                                              AS league,
      TO_CHAR(DATE_TRUNC('month', f."scheduledAt"), 'YYYY-MM') AS month,
      COUNT(*)                                            AS total,
      COUNT(CASE WHEN b.status = 'WON' THEN 1 END)       AS won
    FROM bet b
    JOIN fixture     f ON f.id = b."fixtureId"
    JOIN season      s ON s.id = f."seasonId"
    JOIN competition c ON c.id = s."competitionId"
    WHERE b.status IN ('WON', 'LOST')
      AND b.source = 'MODEL'
    GROUP BY b."isSafeValue", c.code,
             DATE_TRUNC('month', f."scheduledAt")
    ORDER BY canal, league, month
  `;

  // ── 2. Predictions (BTTS / DRAW / CONF) ───────────────────────────────────
  const predRows = await prisma.$queryRaw<PredAuditRow[]>`
    SELECT
      CASE p.channel
        WHEN 'BTTS' THEN 'BB'
        WHEN 'DRAW' THEN 'NUL'
        ELSE 'CONF'
      END                                                 AS canal,
      p.competition                                       AS league,
      TO_CHAR(DATE_TRUNC('month', f."scheduledAt"), 'YYYY-MM') AS month,
      COUNT(*)                                            AS total,
      COUNT(CASE WHEN p.correct = true THEN 1 END)        AS correct
    FROM prediction p
    JOIN fixture f ON f.id = p."fixtureId"
    WHERE p.correct IS NOT NULL
      AND p.channel IN ('BTTS', 'DRAW', 'CONF')
    GROUP BY p.channel, p.competition,
             DATE_TRUNC('month', f."scheduledAt")
    ORDER BY canal, league, month
  `;

  // ── 3. Merge into uniform rows ─────────────────────────────────────────────
  const rows: MonthlyRow[] = [
    ...betRows.map((r) => ({
      canal: r.canal,
      league: r.league,
      month: r.month,
      total: Number(r.total),
      won: Number(r.won),
      hitRate: Number(r.total) > 0 ? Number(r.won) / Number(r.total) : 0,
    })),
    ...predRows.map((r) => ({
      canal: r.canal,
      league: r.league,
      month: r.month,
      total: Number(r.total),
      won: Number(r.correct),
      hitRate: Number(r.total) > 0 ? Number(r.correct) / Number(r.total) : 0,
    })),
  ];

  // ── 4. Summary by canal ────────────────────────────────────────────────────
  const canalTotals = new Map<string, { total: number; won: number }>();
  for (const r of rows) {
    const existing = canalTotals.get(r.canal) ?? { total: 0, won: 0 };
    canalTotals.set(r.canal, {
      total: existing.total + r.total,
      won: existing.won + r.won,
    });
  }

  console.log('═══ SUMMARY BY CANAL ═══════════════════════════════════════');
  console.log(
    `${'Canal'.padEnd(8)} ${'Total'.padStart(7)} ${'Won'.padStart(7)} ${'Hit rate'.padStart(10)}`,
  );
  console.log('─'.repeat(36));
  for (const [canal, { total, won }] of [...canalTotals.entries()].sort()) {
    const hr = total > 0 ? ((won / total) * 100).toFixed(1) + '%' : 'n/a';
    console.log(
      `${canal.padEnd(8)} ${String(total).padStart(7)} ${String(won).padStart(7)} ${hr.padStart(10)}`,
    );
  }

  // ── 5. Monthly coverage ────────────────────────────────────────────────────
  const months = [...new Set(rows.map((r) => r.month))].sort();
  console.log('\n═══ MONTHLY SETTLED VOLUME (all canals) ════════════════════');
  console.log(`${'Month'.padEnd(8)} ${'Total'.padStart(7)}`);
  console.log('─'.repeat(18));

  for (const month of months) {
    const total = rows
      .filter((r) => r.month === month)
      .reduce((s, r) => s + r.total, 0);
    console.log(`${month.padEnd(8)} ${String(total).padStart(7)}`);
  }

  // ── 6. Canal × league coverage (only leagues with ≥ 10 settled picks) ─────
  type LeagueKey = `${string}:${string}`;
  const leagueTotals = new Map<LeagueKey, { total: number; won: number }>();
  for (const r of rows) {
    const key: LeagueKey = `${r.canal}:${r.league}`;
    const existing = leagueTotals.get(key) ?? { total: 0, won: 0 };
    leagueTotals.set(key, {
      total: existing.total + r.total,
      won: existing.won + r.won,
    });
  }

  console.log('\n═══ CANAL × LEAGUE (≥ 10 settled) ══════════════════════════');
  console.log(
    `${'Canal'.padEnd(8)} ${'League'.padEnd(8)} ${'Total'.padStart(7)} ${'Won'.padStart(7)} ${'Hit rate'.padStart(10)}`,
  );
  console.log('─'.repeat(44));

  const leagueEntries = [...leagueTotals.entries()]
    .filter(([, v]) => v.total >= 10)
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [key, { total, won }] of leagueEntries) {
    const [canal, league] = key.split(':') as [string, string];
    const hr = ((won / total) * 100).toFixed(1) + '%';
    console.log(
      `${canal.padEnd(8)} ${league.padEnd(8)} ${String(total).padStart(7)} ${String(won).padStart(7)} ${hr.padStart(10)}`,
    );
  }

  // ── 7. Backtest feasibility check ─────────────────────────────────────────
  console.log('\n═══ FEASIBILITY GATES ═══════════════════════════════════════');
  const MINIMUM_PER_CANAL = 50;
  let allGatesPassed = true;

  for (const [canal, { total }] of canalTotals.entries()) {
    const ok = total >= MINIMUM_PER_CANAL;
    const mark = ok ? '✓' : '✗';
    if (!ok) allGatesPassed = false;
    console.log(
      `  ${mark} ${canal}: ${total} settled (min ${MINIMUM_PER_CANAL} for grid search)`,
    );
  }

  if (allGatesPassed) {
    console.log('\n  → All canals pass the minimum volume gate.');
    console.log('  → Safe to proceed to backtest-investment.ts.');
  } else {
    console.log(
      '\n  ⚠ Some canals below minimum. Grid search results on those canals will be unreliable.',
    );
  }

  // ── 8. Write JSON report ───────────────────────────────────────────────────
  const report = {
    generatedAt: new Date().toISOString(),
    summary: Object.fromEntries(
      [...canalTotals.entries()].map(([canal, { total, won }]) => [
        canal,
        { total, won, hitRate: total > 0 ? won / total : null },
      ]),
    ),
    monthlyTotal: Object.fromEntries(
      months.map((m) => [
        m,
        rows.filter((r) => r.month === m).reduce((s, r) => s + r.total, 0),
      ]),
    ),
    byLeague: Object.fromEntries(
      [...leagueTotals.entries()].map(([key, { total, won }]) => [
        key,
        { total, won, hitRate: total > 0 ? won / total : null },
      ]),
    ),
    rawRows: rows,
  };

  const reportsDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../reports');
  await mkdir(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, 'backtest-data-audit.json');
  await writeFile(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved → ${outPath}`);
}

run()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
