/// <reference types="node" />
/**
 * Backtest jour par jour : le topN du mode d'abonnement "DECISIONS" doit-il
 * rester "premiers matchs du jour par heure de coup d'envoi" (comportement
 * actuel de SubscriptionMatchingService, DESIGN.md §Décisions de conception,
 * point 2) ou passer à un classement edge/probabilité comme le mode
 * "INVESTIR" (MODE_RANKING) ?
 *
 * Run: pnpm --filter @evcore/db db:backtest:decisions-ranking
 * Output: packages/db/reports/backtest-decisions-ranking-YYYY-MM-DD.txt
 *
 * Contrainte du mode DECISIONS a respecter dans ce backtest (sinon on
 * mesurerait autre chose que ce que ce mode produit vraiment) : PAS de
 * calibration, PAS d'exclusion AVOID, PAS de gate EV, PAS de filtre de
 * coherence lambda — seulement les decisions SELECTED avec une cote sur leur
 * selection rank=1, exactement le pool que ChannelDecisionService.listByChannel
 * expose deja a SubscriptionMatchingService.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

const TOP_NS = [3, 5] as const;
const TRAIN_SPLIT = 0.6;

type Row = {
  scheduledAt: Date;
  channel: string;
  probability: number;
  odds: number;
  result: "WON" | "LOST";
};

type Formula = {
  name: string;
  // null => baseline chronologique (ordre deja fourni, pas de tri par score)
  score: ((r: Row) => number) | null;
};

const FORMULAS: Formula[] = [
  {
    name: "premiers N (comportement actuel, coup d'envoi croissant)",
    score: null,
  },
  {
    name: "derniers N (coup d'envoi decroissant)",
    score: (r) => r.scheduledAt.getTime(),
  },
  { name: "probabilite brute (non calibree)", score: (r) => r.probability },
  {
    name: "edge brut = probabilite - 1/cote",
    score: (r) => r.probability - 1 / r.odds,
  },
];

const CHANNELS = ["VALUE", "SAFE", "DOMINANT", "DRAW", "BTTS", "TEAM_TOTAL"];

type TopNStats = {
  days: number;
  positiveDays: number;
  picks: number;
  wins: number;
  roiSum: number;
};
function emptyStats(): TopNStats {
  return { days: 0, positiveDays: 0, picks: 0, wins: 0, roiSum: 0 };
}
function pickRoi(r: Row): number {
  return r.result === "WON" ? r.odds - 1 : -1;
}
function accumulate(stats: TopNStats, top: Row[]): void {
  let dayRoi = 0;
  for (const r of top) {
    const roi = pickRoi(r);
    dayRoi += roi;
    stats.roiSum += roi;
    stats.picks += 1;
    if (r.result === "WON") stats.wins += 1;
  }
  stats.days += 1;
  if (dayRoi > 0) stats.positiveDays += 1;
}
function formatStats(s: TopNStats): string {
  if (s.picks === 0) return "aucun jour eligible";
  const roi = ((s.roiSum / s.picks) * 100).toFixed(2);
  const hit = ((s.wins / s.picks) * 100).toFixed(1);
  const posDays = ((s.positiveDays / Math.max(1, s.days)) * 100).toFixed(1);
  return `${s.days} jours, ${s.picks} picks — ROI ${roi}%, hit ${hit}%, jours positifs ${posDays}%`;
}

function evaluateChannel(channel: string, rows: Row[]): string[] {
  const byDay = new Map<string, Row[]>();
  for (const row of rows) {
    const dayKey = row.scheduledAt.toISOString().slice(0, 10);
    const list = byDay.get(dayKey) ?? [];
    list.push(row);
    byDay.set(dayKey, list);
  }
  const dayKeys = [...byDay.keys()].sort();
  if (dayKeys.length === 0) return [`=== ${channel} : aucune donnee ===`, ""];
  const splitIndex = Math.floor(dayKeys.length * TRAIN_SPLIT);
  const splitKey = dayKeys[splitIndex] ?? "9999-12-31";

  const perFormula = new Map<
    string,
    Map<number, { all: TopNStats; train: TopNStats; valid: TopNStats }>
  >();
  for (const formula of FORMULAS) {
    const byN = new Map<
      number,
      { all: TopNStats; train: TopNStats; valid: TopNStats }
    >();
    for (const n of TOP_NS)
      byN.set(n, {
        all: emptyStats(),
        train: emptyStats(),
        valid: emptyStats(),
      });
    perFormula.set(formula.name, byN);
  }

  for (const dayKey of dayKeys) {
    const dayRows = byDay.get(dayKey) ?? [];
    const chronological = [...dayRows].sort(
      (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
    );

    for (const formula of FORMULAS) {
      const ordered = formula.score
        ? [...dayRows].sort((a, b) => formula.score!(b) - formula.score!(a))
        : chronological;

      for (const n of TOP_NS) {
        if (ordered.length < n) continue;
        const top = ordered.slice(0, n);
        const stats = perFormula.get(formula.name)?.get(n);
        if (!stats) continue;
        accumulate(stats.all, top);
        accumulate(dayKey < splitKey ? stats.train : stats.valid, top);
      }
    }
  }

  const lines: string[] = [];
  lines.push(`=== ${channel} ===`);
  lines.push(
    `Jours avec decisions : ${dayKeys.length} — split train/valid au ${splitKey} (${Math.round(TRAIN_SPLIT * 100)}/${Math.round((1 - TRAIN_SPLIT) * 100)})`,
  );
  for (const formula of FORMULAS) {
    lines.push(`--- ${formula.name} ---`);
    for (const n of TOP_NS) {
      const stats = perFormula.get(formula.name)?.get(n);
      if (!stats) continue;
      lines.push(`  top${n} : ${formatStats(stats.all)}`);
      lines.push(`    train : ${formatStats(stats.train)}`);
      lines.push(`    valid : ${formatStats(stats.valid)}`);
    }
  }
  lines.push("");
  return lines;
}

async function main() {
  const rows = await prisma.$queryRaw<Row[]>`
    WITH latest AS (
      SELECT DISTINCT ON (mr."fixtureId", cd.channel)
        f."scheduledAt" AS "scheduledAt",
        cd.channel,
        cs.probability,
        cs.odds,
        cs.result
      FROM channel_decision cd
      JOIN model_run mr ON mr.id = cd."modelRunId"
      JOIN fixture f ON f.id = mr."fixtureId"
      JOIN channel_selection cs ON cs."channelDecisionId" = cd.id AND cs.rank = 1
      WHERE cd.status = 'SELECTED'
        AND cd.channel = ANY(${CHANNELS}::"StrategyChannel"[])
        AND cs.odds IS NOT NULL
      ORDER BY mr."fixtureId", cd.channel, mr."analyzedAt" DESC
    )
    SELECT "scheduledAt", channel, probability::float8 AS probability, odds::float8 AS odds, result
    FROM latest
    WHERE result IN ('WON', 'LOST')
    ORDER BY "scheduledAt"
  `;

  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  w("BACKTEST CLASSEMENT TOPN — mode d'abonnement DECISIONS");
  w(
    `Genere le ${new Date().toISOString()} — ${rows.length} decisions settled (${CHANNELS.join("+")})`,
  );
  w(
    "Pool identique a SubscriptionMatchingService : SELECTED, rank=1, odds non nulle, sans calibration/AVOID/EV-gate.",
  );
  w();

  for (const channel of CHANNELS) {
    lines.push(
      ...evaluateChannel(
        channel,
        rows.filter((r) => r.channel === channel),
      ),
    );
  }

  const report = lines.join("\n");
  console.log(report);

  const reportDir = join(process.cwd(), "reports");
  mkdirSync(reportDir, { recursive: true });
  const filename = `backtest-decisions-ranking-${new Date().toISOString().slice(0, 10)}.txt`;
  writeFileSync(join(reportDir, filename), report, "utf8");
  console.log(`\nRapport ecrit : reports/${filename}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
