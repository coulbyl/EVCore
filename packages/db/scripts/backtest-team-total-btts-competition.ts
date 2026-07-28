/// <reference types="node" />
/**
 * TEAM_TOTAL et BTTS sont candidats à la promotion vers le staking réel
 * (track record all-time : TEAM_TOTAL +3.40% ROI n=845, BTTS +0.76% ROI
 * n=3983 — voir la session de promotion des canaux). Avant de câbler
 * Investir/Coupon, ce script vérifie si l'edge agrégé cache des poches de
 * compétitions négatives (à exclure) ou particulièrement positives — même
 * démarche que l'investigation CORRECT_SCORE par ligue cette session.
 *
 * Dédup : aucune — même convention que
 * DashboardRepository.findChannelSelectionsInRange (dashboard.repository.ts),
 * qui ne déduplique pas par fixture pour ce type d'agrégat ROI/hit-rate.
 *
 * Run: pnpm --filter @evcore/db db:backtest:team-total-btts-competition
 * Output: packages/db/reports/backtest-team-total-btts-competition-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { BetStatus, StrategyChannel } from "../src/generated/prisma/client";
import { prisma } from "../src/client";

const MIN_GROUP_SAMPLE = 100;
const CHANNELS = [StrategyChannel.TEAM_TOTAL, StrategyChannel.BTTS] as const;

type Row = {
  result: BetStatus;
  odds: number;
  competitionCode: string;
  competitionName: string;
  competitionCountry: string;
};

type GroupStat = {
  code: string;
  name: string;
  country: string;
  n: number;
  won: number;
  roiPct: number;
  hitPct: number;
};

function toNum(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

function computeGroupStats(rows: Row[]): GroupStat[] {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = groups.get(r.competitionCode) ?? [];
    arr.push(r);
    groups.set(r.competitionCode, arr);
  }
  return Array.from(groups.entries())
    .map(([code, groupRows]) => {
      const won = groupRows.filter((r) => r.result === BetStatus.WON).length;
      const pnl = groupRows.reduce(
        (sum, r) =>
          sum + (r.result === BetStatus.WON ? r.odds - 1 : -1),
        0,
      );
      return {
        code,
        name: groupRows[0]!.competitionName,
        country: groupRows[0]!.competitionCountry,
        n: groupRows.length,
        won,
        roiPct: (pnl / groupRows.length) * 100,
        hitPct: (won / groupRows.length) * 100,
      };
    })
    .sort((a, b) => b.n - a.n);
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-team-total-btts-competition-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out("═══════════════════════════════════════════════════════");
  out("  EVCore — TEAM_TOTAL / BTTS, ROI par compétition");
  out(`  ${dateLabel} — seuil min-sample par groupe : n>=${MIN_GROUP_SAMPLE}`);
  out("═══════════════════════════════════════════════════════");

  for (const channel of CHANNELS) {
    out();
    out(`──── ${channel} ────`);

    const selections = await prisma.channelSelection.findMany({
      where: {
        result: { in: [BetStatus.WON, BetStatus.LOST] },
        odds: { not: null },
        channelDecision: { is: { channel } },
      },
      select: {
        result: true,
        odds: true,
        channelDecision: {
          select: {
            modelRun: {
              select: {
                fixture: {
                  select: {
                    season: {
                      select: {
                        competition: {
                          select: { code: true, name: true, country: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const rows: Row[] = selections.map((s) => ({
      result: s.result!,
      odds: toNum(s.odds),
      competitionCode: s.channelDecision.modelRun.fixture.season.competition.code,
      competitionName: s.channelDecision.modelRun.fixture.season.competition.name,
      competitionCountry:
        s.channelDecision.modelRun.fixture.season.competition.country,
    }));

    const totalWon = rows.filter((r) => r.result === BetStatus.WON).length;
    const totalPnl = rows.reduce(
      (sum, r) => sum + (r.result === BetStatus.WON ? r.odds - 1 : -1),
      0,
    );
    out(
      `  Agrégat toutes compétitions : n=${rows.length}, hit=${((totalWon / rows.length) * 100).toFixed(1)}%, ROI=${((totalPnl / rows.length) * 100).toFixed(2)}%`,
    );
    out();

    const groups = computeGroupStats(rows);
    out(
      "  compétition                              | pays            | n     | hit%  | ROI%   | verdict",
    );
    for (const g of groups) {
      const verdict =
        g.n < MIN_GROUP_SAMPLE
          ? "n<seuil, non concluant"
          : g.roiPct >= 0
            ? "positif"
            : "négatif";
      const label = `${g.name} (${g.code})`;
      out(
        `  ${label.padEnd(41).slice(0, 41)} | ${g.country.padEnd(15).slice(0, 15)} | ${String(g.n).padEnd(5)} | ${g.hitPct.toFixed(1).padStart(5)} | ${g.roiPct.toFixed(2).padStart(6)} | ${verdict}`,
      );
    }

    const conclusive = groups.filter((g) => g.n >= MIN_GROUP_SAMPLE);
    const positive = conclusive.filter((g) => g.roiPct >= 0);
    out();
    out(
      `  → ${positive.length}/${conclusive.length} compétitions concluantes (n>=${MIN_GROUP_SAMPLE}) en ROI positif.`,
    );
    const negative = conclusive.filter((g) => g.roiPct < 0);
    if (negative.length > 0) {
      out(
        `  → Compétitions concluantes en ROI négatif (candidates à l'exclusion) : ${negative
          .map((g) => `${g.code} (${g.roiPct.toFixed(2)}%, n=${g.n})`)
          .join(", ")}`,
      );
    }
  }

  const report_ = lines.join("\n");
  writeFileSync(outputPath, `${report_}\n`, "utf8");
  console.log(`\nRapport écrit : reports/${outputPath.split("/").pop()}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
