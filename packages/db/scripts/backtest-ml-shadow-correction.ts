/// <reference types="node" />
/**
 * docs/ml-worker-sync.md — la correction ML (`computeShadowMlByChannel`,
 * betting-engine.service.ts) est calculée en shadow depuis le 2026-07-01
 * mais n'a jamais été validée hors du dataset d'entraînement lui-même : les
 * métriques `roiShadow`/`brierScore` de `ml_model_version.metrics` viennent
 * du split interne du worker Python (`correction.py`), jamais rejouées
 * contre les vraies décisions prises en prod. L'audit du 2026-08-12 a montré
 * que ce chiffre peut être trompeur (BTTS:BTTS et ALL sont restés "meilleurs
 * sur le papier" pendant 6 semaines alors que leur fichier modèle était mort
 * — voir TODO.md).
 *
 * Ce script évalue la correction ML **comme elle a réellement tourné en
 * prod** : pour chaque `ChannelSelection` rang 1 réglée (WON/LOST), on
 * compare le Brier score de la probabilité déterministe brute
 * (`ChannelSelection.probability`, Poisson + facteurs de calibration) à
 * celui de la probabilité corrigée telle qu'elle a été écrite au moment de
 * l'analyse (`ModelRun.features.shadow_ml_by_channel[channel].correctedP`).
 *
 * Différence volontaire avec les backtests H2H (pas de grid-search de
 * paramètre ici) : on n'entraîne rien dans ce script, on évalue une
 * fonction déjà figée (le modèle actif au moment de chaque analyse). Chaque
 * valeur `correctedP` a été produite en walk-forward (le modèle qui a
 * généré la correction est celui qui était actif ce jour-là, jamais
 * ré-appliqué a posteriori) — pas de fuite temporelle à corriger côté script.
 *
 * On reporte systématiquement deux fenêtres : tout l'historique disponible
 * ET les 30 derniers jours seuls, pour détecter un signal qui aurait
 * dérivé/cassé récemment (cf. incident ALL/BTTS:BTTS ci-dessus — un modèle
 * mort depuis 6 semaines aurait été invisible dans un Brier "tout temps"
 * dilué par la période où il fonctionnait encore).
 *
 * Run: pnpm --filter @evcore/db db:backtest:ml-shadow-correction
 * Output: packages/db/reports/backtest-ml-shadow-correction-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

const MIN_SAMPLE_CONCLUSIVE = 100;
const RECENT_WINDOW_DAYS = 30;

const ML_SHADOW_CHANNELS = [
  "VALUE",
  "DOMINANT",
  "BTTS",
  "DRAW",
  "GOALS",
  "CLEAN_SHEET",
  "TEAM_TOTAL",
  "WIN_EITHER_HALF",
] as const;

type Point = {
  segment: string;
  channel: string;
  analyzedAt: Date;
  baseline: number;
  corrected: number;
  actual: 0 | 1;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  return typeof v === "number" ? v : Number(v);
}

function brierScore(points: Point[], probFn: (p: Point) => number): number {
  const sum = points.reduce((s, p) => s + (probFn(p) - p.actual) ** 2, 0);
  return sum / points.length;
}

function calibrationError(
  points: Point[],
  probFn: (p: Point) => number,
): number {
  // |moyenne(prob prédite) - taux de réussite réel|, diagnostic simple de biais
  // directionnel (sur- ou sous-confiance globale), en plus du Brier.
  const meanProb = points.reduce((s, p) => s + probFn(p), 0) / points.length;
  const actualRate = points.reduce((s, p) => s + p.actual, 0) / points.length;
  return Math.abs(meanProb - actualRate);
}

function reportSegment(
  out: (line?: string) => void,
  label: string,
  points: Point[],
): void {
  const bySegment = new Map<string, Point[]>();
  for (const p of points) {
    const arr = bySegment.get(p.segment) ?? [];
    arr.push(p);
    bySegment.set(p.segment, arr);
  }

  out(`--- ${label} ---`);
  if (points.length === 0) {
    out("  Aucune donnée sur cette fenêtre.");
    out();
    return;
  }

  out(
    "  segment                              | n    | Brier base | Brier ML  | delta    | calib.base | calib.ML | verdict",
  );
  const rows = Array.from(bySegment.entries())
    .map(([segment, segPoints]) => {
      const baselineBrier = brierScore(segPoints, (p) => p.baseline);
      const correctedBrier = brierScore(segPoints, (p) => p.corrected);
      const baselineCalib = calibrationError(segPoints, (p) => p.baseline);
      const correctedCalib = calibrationError(segPoints, (p) => p.corrected);
      return {
        segment,
        n: segPoints.length,
        baselineBrier,
        correctedBrier,
        baselineCalib,
        correctedCalib,
      };
    })
    .sort((a, b) => b.n - a.n);

  for (const row of rows) {
    const delta = row.correctedBrier - row.baselineBrier;
    const verdict =
      row.n < MIN_SAMPLE_CONCLUSIVE
        ? `n<${MIN_SAMPLE_CONCLUSIVE}, non concluant`
        : delta < 0
          ? "ML améliore"
          : "ML dégrade";
    out(
      `  ${row.segment.padEnd(37)} | ${String(row.n).padEnd(4)} | ${row.baselineBrier.toFixed(6)}   | ${row.correctedBrier.toFixed(6)}  | ${delta >= 0 ? "+" : ""}${delta.toFixed(6)} | ${row.baselineCalib.toFixed(6)}   | ${row.correctedCalib.toFixed(6)} | ${verdict}`,
    );
  }

  const conclusive = rows.filter((r) => r.n >= MIN_SAMPLE_CONCLUSIVE);
  const improved = conclusive.filter((r) => r.correctedBrier < r.baselineBrier);
  out(
    `  → ${improved.length}/${conclusive.length} segments concluants (n>=${MIN_SAMPLE_CONCLUSIVE}) où le ML améliore le Brier.`,
  );
  out();
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-ml-shadow-correction-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out("═══════════════════════════════════════════════════════");
  out(
    "  EVCore — Validation de la correction ML shadow vs baseline déterministe",
  );
  out(
    `  ${dateLabel} — évaluation walk-forward (aucun paramètre ré-entraîné ici)`,
  );
  out("═══════════════════════════════════════════════════════");
  out();

  out("Chargement des ChannelSelection rang 1 réglées avec correction ML...");
  // Raw SQL plutôt que Prisma include : on ne veut que la clé
  // `shadow_ml_by_channel` du JSON `features`, pas le blob complet
  // (candidatePicks/evaluatedPicks/etc, plusieurs Ko par ligne) — le
  // `statement_timeout` de 30s du rôle read-only analyst est atteint sinon
  // sur l'historique complet des sélections réglées.
  const rows = await prisma.$queryRaw<
    {
      market: string;
      probability: unknown;
      result: string;
      channel: string;
      analyzedAt: Date;
      correctedP: number | null;
    }[]
  >`
    SELECT
      cs.market,
      cs.probability,
      cs.result,
      cd.channel,
      mr."analyzedAt",
      (mr.features -> 'shadow_ml_by_channel' -> cd.channel::text ->> 'correctedP')::float AS "correctedP"
    FROM channel_selection cs
    JOIN channel_decision cd ON cd.id = cs."channelDecisionId"
    JOIN model_run mr ON mr.id = cd."modelRunId"
    WHERE cs.rank = 1
      AND cs.result IN ('WON', 'LOST')
      AND cd.channel::text = ANY(${[...ML_SHADOW_CHANNELS]})
      AND mr.features -> 'shadow_ml_by_channel' -> cd.channel::text ->> 'correctedP' IS NOT NULL
  `;
  out(
    `  ${rows.length} sélections rang 1 réglées avec une correction ML présente.`,
  );

  const points: Point[] = [];
  let skippedNoShadow = 0;
  for (const row of rows) {
    const baseline = toNum(row.probability);
    const corrected = row.correctedP;
    if (
      corrected == null ||
      !Number.isFinite(baseline) ||
      !Number.isFinite(corrected)
    ) {
      skippedNoShadow++;
      continue;
    }
    points.push({
      segment: `${row.channel}:${row.market}`,
      channel: row.channel,
      analyzedAt: row.analyzedAt,
      baseline,
      corrected,
      actual: row.result === "WON" ? 1 : 0,
    });
  }
  out(
    `  ${points.length} exploitables, ${skippedNoShadow} écartées (valeur non numérique).`,
  );

  if (points.length === 0) {
    out();
    out("Aucune donnée exploitable — rien à évaluer.");
    writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
    return;
  }

  points.sort((a, b) => a.analyzedAt.getTime() - b.analyzedAt.getTime());
  out(
    `  Période couverte : ${points[0]!.analyzedAt.toISOString().slice(0, 10)} → ${points[points.length - 1]!.analyzedAt.toISOString().slice(0, 10)}`,
  );
  out();

  reportSegment(out, "Tout l'historique disponible", points);

  const recentCutoff = new Date(
    generatedAt.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const recentPoints = points.filter((p) => p.analyzedAt >= recentCutoff);
  reportSegment(
    out,
    `Derniers ${RECENT_WINDOW_DAYS} jours seulement (depuis ${recentCutoff.toISOString().slice(0, 10)})`,
    recentPoints,
  );

  out("--- Verdict global ---");
  out(
    "  Un Brier plus bas côté ML sur la fenêtre récente ET sur tout l'historique, avec n>=" +
      `${MIN_SAMPLE_CONCLUSIVE}, est le seuil minimal avant de considérer une promotion hors` +
      " shadow pour ce segment. Une amélioration qui n'apparaît que sur 'tout l'historique'" +
      " mais pas sur les 30 derniers jours doit être traitée comme suspecte (modèle qui a pu" +
      " se dégrader depuis, cf. incident ALL/BTTS:BTTS) plutôt que comme un signal exploitable.",
  );
  out(
    "  Rappel : ce script ne calcule pas de ROI simulé (dépendrait de l'odds au moment du pick," +
      " hors scope ici) — seul le Brier/calibration sont comparés. Un gain de Brier ne garantit" +
      " pas un gain de ROI, à vérifier séparément avant toute promotion réelle.",
  );

  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
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
