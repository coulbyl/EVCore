/**
 * Audit calibration par (canal × marché × ligue) — lit les sélections déjà
 * réglées en base (`ChannelSelection.result`), PAS un rejeu du pipeline. Ce
 * n'est délibérément pas un backtest (feedback_backtest_definition : un
 * backtest doit rejouer le pipeline actuel, jamais lire des décisions déjà
 * enregistrées) — c'est un audit de performance live : "avec la config
 * actuelle, ce canal est-il bien calibré sur ce marché, dans cette ligue,
 * aujourd'hui ?", pas "aurait-il bien performé sous une autre config".
 *
 * Objectif (docs/prediction-engine-families.md §0.3, chantier 3) : établir
 * lesquels des 16 canaux de marché méritent réellement d'alimenter
 * VALUE/SAFE — un canal en sur-confiance (calibGap > 0) gonfle l'edge que
 * VALUE calcule (probabilité − 1/cote) sans edge réel, exactement le
 * mécanisme derrière le plancher d'edge VALUE déjà patché une fois
 * (memory project_value_edge_floor).
 *
 * calibGap = avg(probabilité annoncée) − hit rate réel.
 *   > 0  → sur-confiant (le modèle claim plus qu'il ne tient)
 *   < 0  → sous-confiant (marge de sécurité, moins dangereux pour VALUE)
 *
 * Run: pnpm --filter @evcore/db db:audit:channel-market-league-calibration
 * Output: packages/db/reports/audit-channel-market-league-calibration-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

const MIN_N = 30;
const RELIABLE_N = 100;
const OVERCONFIDENT_GAP = 0.08; // matches the scale of gaps already flagged in past audits (project_value_edge_floor: ~0.08pp)

type Row = {
  channel: string;
  market: string;
  competitionCode: string;
  n: number;
  hitRate: number;
  avgProb: number;
  brier: number;
  calibGap: number;
  roi: number | null;
  nPriced: number;
};

async function main(): Promise<void> {
  console.log("Chargement des sélections réglées (WON/LOST)...");
  const selections = await prisma.channelSelection.findMany({
    where: { result: { in: ["WON", "LOST"] } },
    select: {
      probability: true,
      odds: true,
      result: true,
      market: true,
      channelDecision: {
        select: {
          channel: true,
          modelRun: {
            select: {
              fixture: {
                select: {
                  season: {
                    select: { competition: { select: { code: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  console.log(`  ${selections.length} sélections réglées chargées.`);

  type Bucket = {
    n: number;
    won: number;
    probSum: number;
    brierSum: number;
    roiSum: number;
    nPriced: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const sel of selections) {
    const channel = sel.channelDecision.channel;
    const market = sel.market;
    const competitionCode =
      sel.channelDecision.modelRun.fixture.season.competition.code;
    const key = `${channel}::${market}::${competitionCode}`;
    const bucket =
      buckets.get(key) ??
      ({
        n: 0,
        won: 0,
        probSum: 0,
        brierSum: 0,
        roiSum: 0,
        nPriced: 0,
      } as Bucket);

    const prob = Number(sel.probability);
    const won = sel.result === "WON" ? 1 : 0;
    bucket.n += 1;
    bucket.won += won;
    bucket.probSum += prob;
    bucket.brierSum += (prob - won) ** 2;
    if (sel.odds !== null) {
      const odds = Number(sel.odds);
      bucket.roiSum += won ? odds - 1 : -1;
      bucket.nPriced += 1;
    }
    buckets.set(key, bucket);
  }

  const rows: Row[] = [];
  for (const [key, b] of buckets) {
    const [channel, market, competitionCode] = key.split("::") as [
      string,
      string,
      string,
    ];
    if (b.n < MIN_N) continue;
    rows.push({
      channel,
      market,
      competitionCode,
      n: b.n,
      hitRate: b.won / b.n,
      avgProb: b.probSum / b.n,
      brier: b.brierSum / b.n,
      calibGap: b.probSum / b.n - b.won / b.n,
      roi: b.nPriced > 0 ? b.roiSum / b.nPriced : null,
      nPriced: b.nPriced,
    });
  }

  rows.sort((a, b) => {
    if (a.channel !== b.channel) return a.channel.localeCompare(b.channel);
    return b.n - a.n;
  });

  const overconfident = rows.filter(
    (r) => r.calibGap > OVERCONFIDENT_GAP && r.n >= RELIABLE_N,
  );
  const wellCalibratedReliable = rows.filter(
    (r) => Math.abs(r.calibGap) <= 0.03 && r.n >= RELIABLE_N,
  );

  const fmt = (r: Row) =>
    `  ${r.channel.padEnd(16)} ${r.market.padEnd(18)} ${r.competitionCode.padEnd(6)} ` +
    `n=${String(r.n).padStart(5)} hit=${r.hitRate.toFixed(3)} prob=${r.avgProb.toFixed(3)} ` +
    `brier=${r.brier.toFixed(4)} gap=${r.calibGap >= 0 ? "+" : ""}${r.calibGap.toFixed(4)} ` +
    `roi=${r.roi !== null ? (r.roi >= 0 ? "+" : "") + r.roi.toFixed(3) : "n/a"} (nPriced=${r.nPriced})`;

  const lines: string[] = [
    "═══════════════════════════════════════════════════════",
    "  EVCore — Audit calibration par (canal × marché × ligue)",
    `  ${new Date().toISOString().slice(0, 10)} — données live réglées (WON/LOST), pas un rejeu`,
    `  seuil minimum n>=${MIN_N} (fiable n>=${RELIABLE_N}), sur-confiance flag > ${OVERCONFIDENT_GAP}`,
    "═══════════════════════════════════════════════════════",
    "",
    `${rows.length} combinaisons (canal × marché × ligue) au-dessus de n>=${MIN_N}.`,
    "",
    `--- Sur-confiants et fiables (n>=${RELIABLE_N}, gap > ${OVERCONFIDENT_GAP}) : ${overconfident.length} ---`,
    ...overconfident.map(fmt),
    "",
    `--- Bien calibrés et fiables (n>=${RELIABLE_N}, |gap|<=0.03) : ${wellCalibratedReliable.length} ---`,
    ...wellCalibratedReliable.map(fmt),
    "",
    "--- Détail complet, par canal ---",
    ...rows.map(fmt),
  ];

  const report = lines.join("\n");
  console.log(report);

  const reportsDir = join(__dirname, "..", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outPath = join(
    reportsDir,
    `audit-channel-market-league-calibration-${new Date().toISOString().slice(0, 10)}.txt`,
  );
  writeFileSync(outPath, report + "\n");
  console.log(`\nÉcrit dans ${outPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
