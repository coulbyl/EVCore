/// <reference types="node" />
/**
 * Backtest jour par jour : le seuil EV >= 0.08 predit-il un meilleur ROI par
 * canal, ou juste en moyenne agregee (qui peut masquer du bruit) ?
 * Run: pnpm --filter @evcore/db db:backtest:ev-tiers
 * Output: packages/db/reports/backtest-ev-tiers-YYYY-MM-DD.txt
 *
 * Contexte : investir.service.ts limite le mode "value" (tri par EV) a
 * VALUE+SAFE car l'EV n'y discrimine le resultat que sur ces deux canaux
 * (verifie sur l'historique complet + split temporel). Ce script sert a
 * verifier, jour par jour plutot qu'en un seul agregat, si un canal comme
 * GOALS/DOMINANT/BTTS a des journees ou l'EV predit bien — et si ces
 * journees sont l'exception ou la regle.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { flatRoi } from "@evcore/analysis-core";
import { prisma } from "../src/client";

const EV_THRESHOLD = 0.08;
const CHANNELS = ["VALUE", "SAFE", "DOMINANT", "BTTS", "GOALS"] as const;

type Row = {
  day: Date;
  channel: string;
  ev: number | null;
  odds: number;
  result: "WON" | "LOST";
};

type SettledPick = { won: boolean; odds: number };

function roiPct(items: SettledPick[]): number {
  return flatRoi(items) * 100;
}

async function main() {
  // Dedup rolling-horizon passes: only the latest ModelRun per (fixture, channel).
  const rows = await prisma.$queryRaw<Row[]>`
    WITH latest AS (
      SELECT DISTINCT ON (mr."fixtureId", cd.channel)
        f."scheduledAt"::date AS day,
        cd.channel,
        cs.ev,
        cs.odds,
        cs.result
      FROM channel_decision cd
      JOIN model_run mr ON mr.id = cd."modelRunId"
      JOIN fixture f ON f.id = mr."fixtureId"
      JOIN channel_selection cs ON cs."channelDecisionId" = cd.id AND cs.rank = 1
      WHERE cd.status = 'SELECTED'
        AND cd.channel = ANY(${CHANNELS as unknown as string[]}::"StrategyChannel"[])
        AND cs.odds IS NOT NULL
      ORDER BY mr."fixtureId", cd.channel, mr."analyzedAt" DESC
    )
    SELECT day, channel, ev::float8 AS ev, odds::float8 AS odds, result
    FROM latest
    WHERE result IN ('WON', 'LOST')
    ORDER BY day
  `;

  // channel -> day (ISO) -> { below, above } settled picks
  type ChannelDays = Map<string, { below: SettledPick[]; above: SettledPick[] }>;
  const byChannel = new Map<string, ChannelDays>();

  for (const row of rows) {
    const channelDays = byChannel.get(row.channel) ?? new Map();
    byChannel.set(row.channel, channelDays);

    const dayKey = row.day.toISOString().slice(0, 10);
    const tiers = channelDays.get(dayKey) ?? { below: [], above: [] };
    channelDays.set(dayKey, tiers);

    const ev = row.ev ?? -Infinity;
    const tier = ev >= EV_THRESHOLD ? tiers.above : tiers.below;
    tier.push({ won: row.result === "WON", odds: row.odds });
  }

  const lines: string[] = [];
  const w = (s = "") => lines.push(s);

  w(`BACKTEST EV >= ${EV_THRESHOLD} PAR CANAL — jour par jour`);
  w(`Genere le ${new Date().toISOString()}`);
  w();

  for (const channel of CHANNELS) {
    const channelDays = byChannel.get(channel);
    if (!channelDays) {
      w(`=== ${channel} : aucune donnee ===`);
      w();
      continue;
    }

    // Only count a day for a tier if it had at least 3 picks in that tier —
    // a 1-pick "day" is a coin flip, not a data point about the tier.
    const MIN_PICKS_PER_DAY = 3;
    let daysAbovePositive = 0;
    let daysAboveNegative = 0;
    let daysBelowPositive = 0;
    let daysBelowNegative = 0;
    const totalAbove: SettledPick[] = [];
    const totalBelow: SettledPick[] = [];

    for (const tiers of channelDays.values()) {
      if (tiers.above.length >= MIN_PICKS_PER_DAY) {
        if (roiPct(tiers.above) > 0) daysAbovePositive += 1;
        else daysAboveNegative += 1;
        totalAbove.push(...tiers.above);
      }
      if (tiers.below.length >= MIN_PICKS_PER_DAY) {
        if (roiPct(tiers.below) > 0) daysBelowPositive += 1;
        else daysBelowNegative += 1;
        totalBelow.push(...tiers.below);
      }
    }

    w(`=== ${channel} ===`);
    w(
      `EV >= ${EV_THRESHOLD} : ${totalAbove.length} picks au total, ROI agrege ${roiPct(totalAbove).toFixed(2)}%`,
    );
    w(
      `  Jours avec >=${MIN_PICKS_PER_DAY} picks dans ce tier : ${daysAbovePositive + daysAboveNegative} — ${daysAbovePositive} jours positifs, ${daysAboveNegative} jours negatifs (${((100 * daysAbovePositive) / Math.max(1, daysAbovePositive + daysAboveNegative)).toFixed(1)}% des jours positifs)`,
    );
    w(
      `EV <  ${EV_THRESHOLD} : ${totalBelow.length} picks au total, ROI agrege ${roiPct(totalBelow).toFixed(2)}%`,
    );
    w(
      `  Jours avec >=${MIN_PICKS_PER_DAY} picks dans ce tier : ${daysBelowPositive + daysBelowNegative} — ${daysBelowPositive} jours positifs, ${daysBelowNegative} jours negatifs (${((100 * daysBelowPositive) / Math.max(1, daysBelowPositive + daysBelowNegative)).toFixed(1)}% des jours positifs)`,
    );
    w();
  }

  const report = lines.join("\n");
  console.log(report);

  const reportDir = join(process.cwd(), "reports");
  mkdirSync(reportDir, { recursive: true });
  const filename = `backtest-ev-tiers-${new Date().toISOString().slice(0, 10)}.txt`;
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
