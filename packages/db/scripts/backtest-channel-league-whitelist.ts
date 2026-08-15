/// <reference types="node" />
/**
 * DRAW n'a aucune whitelist par ligue (juste un poids global bas,
 * CANAL_BASE_WEIGHT.DRAW=0.2) ; BTTS en a une (`BTTS_STAKED_LEAGUES` =
 * [PL, BL1, SA]) issue d'un backtest du 2026-07-28 sans split temporel.
 * Un coup d'œil agrégé cette session (2026-08-09) montre déjà que PL et SA
 * ont basculé négatifs depuis, et que DRAW a un écart de ROI par ligue
 * énorme (+41% à -45%) qui justifierait sa propre whitelist.
 *
 * Ce script formalise ça avec un split temporel 60/40 par canal (même
 * convention que backtest-invest-ranking.ts) — une ligue n'est "confirmée"
 * que si train ET valid sont positifs avec n>=MIN_SPLIT_SAMPLE chacun.
 *
 * Important (cf. session 2026-08-09) : ce whitelisting par ligue est un
 * filtre GROSSIER — "ce marché est-il jouable dans cette ligue" — pas un
 * jugement sur la qualité d'une jambe individuelle (ça, c'est le rôle des
 * signaux leg-level : stabilité, conflict, offensiveBalance, cf.
 * backtest-coupon-quality-signals.ts). Les deux se combinent, l'un ne
 * remplace pas l'autre.
 *
 * Run: pnpm --filter @evcore/db db:backtest:channel-league-whitelist
 * Output: packages/db/reports/backtest-channel-league-whitelist-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { BetStatus, StrategyChannel } from "../src/generated/prisma/client";
import { prisma } from "../src/client";

const TRAIN_SPLIT = 0.6;
const MIN_SPLIT_SAMPLE = 20;
const CHANNELS = [
  StrategyChannel.DRAW,
  StrategyChannel.BTTS,
  StrategyChannel.CONSENSUS,
  StrategyChannel.CLEAN_SHEET,
  StrategyChannel.WIN_EITHER_HALF,
] as const;

type Row = {
  competitionCode: string;
  competitionName: string;
  result: BetStatus;
  odds: number;
  dayKey: string;
};

type Stats = { n: number; won: number; roiPct: number; hitPct: number };

function toNum(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

function computeStats(rows: Row[]): Stats {
  const n = rows.length;
  const won = rows.filter((r) => r.result === BetStatus.WON).length;
  const pnl = rows.reduce(
    (sum, r) => sum + (r.result === BetStatus.WON ? r.odds - 1 : -1),
    0,
  );
  return {
    n,
    won,
    roiPct: n > 0 ? (pnl / n) * 100 : 0,
    hitPct: n > 0 ? (won / n) * 100 : 0,
  };
}

function formatStats(s: Stats): string {
  if (s.n === 0) return "n=0";
  return `n=${s.n}, hit=${s.hitPct.toFixed(1)}%, ROI=${s.roiPct.toFixed(2)}%`;
}

// A fixture is re-analyzed on a rolling horizon in the run-up to kickoff
// (ModelRun.phase ADVANCE re-runs daily/hourly) — each pass writes its own
// ChannelDecision/ChannelSelection for that (fixture, channel). Without
// dedup, one real match inflates n by however many passes it got re-analyzed
// (confirmed 2026-08-09 on RUS1/DRAW: reported n=22 was actually 6 distinct
// matches, none of them draws — same DISTINCT ON pattern already used by
// ChannelDecisionRepository.findByDate).
async function fetchRows(channel: StrategyChannel): Promise<Row[]> {
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
              analyzedAt: true,
              fixture: {
                select: {
                  id: true,
                  scheduledAt: true,
                  season: {
                    select: {
                      competition: { select: { code: true, name: true } },
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

  const latestPerFixture = new Map<string, (typeof selections)[number]>();
  for (const s of selections) {
    const fixtureId = s.channelDecision.modelRun.fixture.id;
    const existing = latestPerFixture.get(fixtureId);
    if (
      !existing ||
      s.channelDecision.modelRun.analyzedAt >
        existing.channelDecision.modelRun.analyzedAt
    ) {
      latestPerFixture.set(fixtureId, s);
    }
  }

  return [...latestPerFixture.values()].map((s) => ({
    result: s.result!,
    odds: toNum(s.odds),
    competitionCode: s.channelDecision.modelRun.fixture.season.competition.code,
    competitionName: s.channelDecision.modelRun.fixture.season.competition.name,
    dayKey: s.channelDecision.modelRun.fixture.scheduledAt
      .toISOString()
      .slice(0, 10),
  }));
}

function splitByDay(rows: Row[]): {
  train: Row[];
  valid: Row[];
  splitKey: string;
} {
  const dayKeys = Array.from(new Set(rows.map((r) => r.dayKey))).sort();
  const splitIndex = Math.floor(dayKeys.length * TRAIN_SPLIT);
  const splitKey = dayKeys[splitIndex] ?? "9999-12-31";
  return {
    train: rows.filter((r) => r.dayKey < splitKey),
    valid: rows.filter((r) => r.dayKey >= splitKey),
    splitKey,
  };
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-channel-league-whitelist-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Whitelist par ligue (DRAW / BTTS), split train/valid 60/40");
  out(
    `  ${dateLabel} — confirmé seulement si train ET valid >= n=${MIN_SPLIT_SAMPLE} et positifs`,
  );
  out("═══════════════════════════════════════════════════════");

  for (const channel of CHANNELS) {
    out();
    out(`──── ${channel} ────`);

    const allRows = await fetchRows(channel);
    const { train, valid, splitKey } = splitByDay(allRows);
    out(
      `Sélections réglées : ${allRows.length} — split au ${splitKey} ` +
        `(${Math.round(TRAIN_SPLIT * 100)}/${Math.round((1 - TRAIN_SPLIT) * 100)})`,
    );
    out(`Agrégat global : ${formatStats(computeStats(allRows))}`);
    out();

    const codes = Array.from(new Set(allRows.map((r) => r.competitionCode)));
    const perLeague = codes.map((code) => {
      const name =
        allRows.find((r) => r.competitionCode === code)?.competitionName ??
        code;
      const overall = computeStats(
        allRows.filter((r) => r.competitionCode === code),
      );
      const trainStats = computeStats(
        train.filter((r) => r.competitionCode === code),
      );
      const validStats = computeStats(
        valid.filter((r) => r.competitionCode === code),
      );
      const confirmed =
        trainStats.n >= MIN_SPLIT_SAMPLE &&
        validStats.n >= MIN_SPLIT_SAMPLE &&
        trainStats.roiPct >= 0 &&
        validStats.roiPct >= 0;
      const conflicting =
        trainStats.n >= MIN_SPLIT_SAMPLE &&
        validStats.n >= MIN_SPLIT_SAMPLE &&
        Math.sign(trainStats.roiPct) !== Math.sign(validStats.roiPct);
      return {
        code,
        name,
        overall,
        trainStats,
        validStats,
        confirmed,
        conflicting,
      };
    });

    perLeague.sort((a, b) => b.overall.n - a.overall.n);

    out(
      "  ligue                                    | code | overall              | train                 | valid                 | verdict",
    );
    for (const l of perLeague) {
      if (l.overall.n < MIN_SPLIT_SAMPLE) continue;
      const verdict = l.confirmed
        ? "CONFIRMÉ positif"
        : l.conflicting
          ? "instable (signes opposés)"
          : "non concluant / négatif";
      const label = `${l.name} (${l.code})`;
      out(
        `  ${label.padEnd(41).slice(0, 41)} | ${l.code.padEnd(4)} | ${formatStats(l.overall).padEnd(21)} | ${formatStats(l.trainStats).padEnd(22)} | ${formatStats(l.validStats).padEnd(22)} | ${verdict}`,
      );
    }

    const confirmedLeagues = perLeague
      .filter((l) => l.confirmed)
      .map((l) => l.code);
    out();
    out(
      `  → Ligues confirmées (train+valid positifs, n>=${MIN_SPLIT_SAMPLE} chacun) : ${confirmedLeagues.join(", ") || "aucune"}`,
    );
  }

  out();
  out("═══════════════════════════════════════════════════════");
  out("  Rappel : ce filtre par ligue est grossier (le marché est-il jouable");
  out(
    "  ici) — il ne remplace pas un scoring leg-level une fois dans le pool.",
  );
  out("═══════════════════════════════════════════════════════");

  const report = lines.join("\n");
  writeFileSync(outputPath, `${report}\n`, "utf8");
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
