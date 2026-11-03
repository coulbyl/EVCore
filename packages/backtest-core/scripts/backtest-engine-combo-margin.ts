/// <reference types="node" />
/**
 * Combiné du jour : départager par la marge 1xBet à chance égale ?
 *
 * POURQUOI. Le Combiné paie 8,9 % de marge 1xBet par jambe à des cotes de
 * 1,13 (docs/audits/2026-11-03/ETUDE-STRATEGIES.md § 2). Plan stratégies,
 * phase 5, étape 2.
 *
 * HYPOTHÈSE, FIXÉE AVANT LE REJEU. Dans chaque championnat retenu, prendre,
 * parmi les jambes éligibles dont la probabilité est à 2 points de celle de
 * la moins chère, celle à la marge 1xBet la plus basse, fait baisser la marge
 * payée par jambe sans que le réalisé/annoncé par jambe sorte du bruit
 * (le nouveau ratio reste dans l'intervalle à 95 % de l'actuel). Les
 * championnats retenus et la sélection mise en avant de chaque match (celle
 * de l'écran Décisions) ne changent pas : seul le match retenu dans un
 * championnat peut changer.
 *
 * CE QUI EST REJOUÉ. Pour chaque jour depuis le début des relevés 1xBet, à
 * l'heure de composition (17 h UTC la veille) : le vivier du service
 * (sélections retenues de la dernière analyse connue à cet instant, canaux
 * affichés, marchés du vivier, matchs sans alerte de calibration), la
 * calibration canal × compétition sur les 90 jours précédents (matchs finis
 * avant l'heure de composition), le prix 1xBet connu à cet instant (marge sur
 * le groupe d'issues de son dernier relevé, garde « jouable chez
 * l'opérateur »), puis composeEngineCombo avec et sans départage. Jambes
 * réglées par le résultat enregistré de la sélection.
 *
 * Le vivier est fait des sélections que le moteur a écrites à l'époque : le
 * compositeur est ce qui change, son entrée est celle qu'il aurait vue.
 *
 * Run: DATABASE_URL=... pnpm --filter @evcore/backtest-core backtest:engine-combo-margin
 * Output: packages/backtest-core/reports/backtest-engine-combo-margin-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@evcore/db";
import {
  COMBO_CONFIG,
  composeEngineCombo,
  OPERATOR_BOOKMAKERS,
  OPERATOR_MIN_ODDS,
  POOL_EXCLUDED_MARKETS,
  priceOutcomeGroups,
  shinOutcomeGroups,
  type CalibrationCell,
  type ComboCandidate,
  type ComboConfig,
} from "@evcore/analysis-core";

const DAY_MS = 24 * 60 * 60 * 1000;
// First 1xBet price in the base: 2026-09-13 14:39 UTC.
const FIRST_DAY = new Date("2026-09-14T00:00:00.000Z");
// Coupons are composed at 17:00 UTC the day before (docs/audits/2026-10-29/ENV-PROD.md).
const COMPOSE_LEAD_MS = 7 * 60 * 60 * 1000;
const CALIBRATION_WINDOW_DAYS = 90;
// A match counts in the calibration once it is over (kick-off + 3 h).
const SETTLED_AFTER_MS = 3 * 60 * 60 * 1000;
const TIE_WINDOW = 0.02;
const Z95 = 1.96;
// apps/backend coupon.constants.ts ENGINE_COMBO_POLICY.excludedChannels.
const EXCLUDED_CHANNELS = [
  "VALUE",
  "SAFE",
  "VANTAGE",
  "AVOID",
  "CONSENSUS",
  "CONTRARIAN",
];

type Candidate = ComboCandidate & { result: string | null };
type QuoteRow = {
  fixtureId: string;
  market: string;
  pick: string;
  bookmaker: string;
  odds: number;
  snapshotAt: Date;
};
type Leg = Candidate & { operatorOdds: number | null };
type Acc = {
  days: number;
  composed: number;
  daysWon: number;
  legs: number;
  announced: number;
  won: number;
  withMargin: number;
  margin: number;
  withOperatorOdds: number;
  operatorOdds: number;
};

const emptyAcc = (): Acc => ({
  days: 0,
  composed: 0,
  daysWon: 0,
  legs: 0,
  announced: 0,
  won: 0,
  withMargin: 0,
  margin: 0,
  withOperatorOdds: 0,
  operatorOdds: 0,
});

function quoteKey(row: { fixtureId: string; market: string; pick: string }) {
  return `${row.fixtureId}|${row.market}|${row.pick}`;
}

async function loadCandidates(day: Date, asOf: Date): Promise<Candidate[]> {
  const dayEnd = new Date(day.getTime() + DAY_MS);
  return prisma.$queryRaw<Candidate[]>`
    WITH latest AS (
      SELECT DISTINCT ON (cd.channel, mr."fixtureId", cs.market, cs.pick)
             mr."fixtureId"::text AS "fixtureId", c.code AS competition,
             cd.channel::text AS channel, cs.market::text AS market, cs.pick,
             cs.odds::float AS odds, cs.probability::float AS probability,
             cd.status::text AS status
      FROM public.channel_selection cs
      JOIN public.channel_decision cd ON cd.id = cs."channelDecisionId"
      JOIN public.model_run mr ON mr.id = cd."modelRunId"
      JOIN public.fixture f ON f.id = mr."fixtureId"
      JOIN public.season se ON se.id = f."seasonId"
      JOIN public.competition c ON c.id = se."competitionId"
      WHERE f."scheduledAt" >= ${day} AND f."scheduledAt" < ${dayEnd}
        AND mr."analyzedAt" < f."scheduledAt"
        AND mr."analyzedAt" <= ${asOf}
      ORDER BY cd.channel, mr."fixtureId", cs.market, cs.pick,
               mr."analyzedAt" DESC, cs.id DESC
    ), alerted AS (
      SELECT lr."fixtureId"
      FROM (
        SELECT DISTINCT ON (mr."fixtureId") mr."fixtureId", mr.features
        FROM public.model_run mr
        JOIN public.fixture fx ON fx.id = mr."fixtureId"
        WHERE fx."scheduledAt" >= ${day} AND fx."scheduledAt" < ${dayEnd}
          AND mr."analyzedAt" < fx."scheduledAt"
          AND mr."analyzedAt" <= ${asOf}
        ORDER BY mr."fixtureId", mr."analyzedAt" DESC
      ) lr
      WHERE jsonb_typeof(lr.features -> 'calibration_alert') = 'object'
         OR CASE
              WHEN jsonb_typeof(lr.features -> 'calibration_alert_over_under') = 'array'
              THEN jsonb_array_length(lr.features -> 'calibration_alert_over_under') > 0
              ELSE false
            END
    )
    SELECT l."fixtureId", l.competition, l.channel, l.market, l.pick,
           l.odds, l.probability, d.result::text AS result
    FROM latest l
    LEFT JOIN public.channel_selection_deduped d
      ON d."fixtureId"::text = l."fixtureId" AND d.channel::text = l.channel
     AND d.market::text = l.market AND d.pick = l.pick
    WHERE l.status = 'SELECTED'
      AND l.odds IS NOT NULL
      AND NOT (l.channel = ANY(${EXCLUDED_CHANNELS}::text[]))
      AND l.market <> ALL(${[...POOL_EXCLUDED_MARKETS]}::text[])
      AND l."fixtureId"::uuid NOT IN (SELECT "fixtureId" FROM alerted)
  `;
}

async function loadCalibration(
  day: Date,
  asOf: Date,
): Promise<CalibrationCell[]> {
  const since = new Date(day.getTime() - CALIBRATION_WINDOW_DAYS * DAY_MS);
  const settledBefore = new Date(asOf.getTime() - SETTLED_AFTER_MS);
  return prisma.$queryRaw<CalibrationCell[]>`
    SELECT s.channel::text AS channel, c.code AS competition,
           count(*)::int AS "sampleSize",
           CASE WHEN sum(s.probability) > 0
                THEN (sum((s.result = 'WON')::int) / sum(s.probability))::float
                ELSE NULL END AS ratio
    FROM public.channel_selection_deduped s
    JOIN public.fixture f ON f.id = s."fixtureId"
    JOIN public.season se ON se.id = f."seasonId"
    JOIN public.competition c ON c.id = se."competitionId"
    WHERE s.result IN ('WON', 'LOST')
      AND s."scheduledAt" >= ${since}
      AND s."scheduledAt" < ${settledBefore}
    GROUP BY s.channel, c.code
  `;
}

/** Each book's last price known at `asOf` on the candidates' markets. */
async function loadQuotes(
  candidates: readonly Candidate[],
  asOf: Date,
): Promise<QuoteRow[]> {
  if (candidates.length === 0) return [];
  const fixtureIds = [...new Set(candidates.map((c) => c.fixtureId))];
  const markets = [...new Set(candidates.map((c) => c.market))];
  return prisma.$queryRaw<QuoteRow[]>`
    WITH latest AS (
      SELECT DISTINCT ON (o."fixtureId", o.market, o.pick, o.bookmaker)
             o."fixtureId", o.market, o.pick, o.bookmaker, o.odds,
             o."homeOdds", o."drawOdds", o."awayOdds", o."snapshotAt"
      FROM public.odds_snapshot o
      JOIN public.fixture f ON f.id = o."fixtureId"
      WHERE o."fixtureId" = ANY(${fixtureIds}::uuid[])
        AND o.market::text = ANY(${markets}::text[])
        AND o.line IS NULL
        AND o."snapshotAt" <= f."scheduledAt"
        AND coalesce(o."observedAt", o."snapshotAt") <= ${asOf}
      ORDER BY o."fixtureId", o.market, o.pick, o.bookmaker, o."snapshotAt" DESC
    )
    SELECT latest."fixtureId"::text AS "fixtureId", latest.market::text AS market,
           latest.pick, latest.bookmaker, latest.odds::float AS odds,
           latest."snapshotAt"
    FROM latest
    WHERE latest.pick IS NOT NULL AND latest.odds IS NOT NULL
    UNION ALL
    SELECT latest."fixtureId"::text, latest.market::text, side.pick,
           latest.bookmaker, side.odds::float, latest."snapshotAt"
    FROM latest
    CROSS JOIN LATERAL (VALUES ('HOME', latest."homeOdds"), ('DRAW', latest."drawOdds"), ('AWAY', latest."awayOdds"))
      AS side(pick, odds)
    WHERE latest.pick IS NULL AND side.odds IS NOT NULL
  `;
}

/** Same reading as PlayableOddsRepository.findPlayableQuotes. */
function priceAtOperator(rows: readonly QuoteRow[]): {
  operatorOdds: Map<string, number>;
  lowestOdds: Map<string, number>;
  margins: Map<string, number>;
  fairs: Map<string, number>;
} {
  const operatorOdds = new Map<string, number>();
  const lowestOdds = new Map<string, number>();
  for (const row of rows) {
    const key = quoteKey(row);
    const low = lowestOdds.get(key);
    if (low === undefined || row.odds < low) lowestOdds.set(key, row.odds);
  }
  const margins = new Map<string, number>();
  const fairs = new Map<string, number>();
  for (const bookmaker of OPERATOR_BOOKMAKERS) {
    const bookRows = rows.filter((row) => row.bookmaker === bookmaker);
    const lastSnapshot = new Map<string, number>();
    for (const row of bookRows) {
      if (!operatorOdds.has(quoteKey(row))) {
        operatorOdds.set(quoteKey(row), row.odds);
      }
      const key = `${row.fixtureId}|${row.market}`;
      const at = new Date(row.snapshotAt).getTime();
      lastSnapshot.set(key, Math.max(lastSnapshot.get(key) ?? 0, at));
    }
    const current = bookRows.filter(
      (row) =>
        new Date(row.snapshotAt).getTime() ===
        lastSnapshot.get(`${row.fixtureId}|${row.market}`),
    );
    for (const priced of priceOutcomeGroups(current)) {
      const key = quoteKey(priced);
      if (!margins.has(key)) margins.set(key, priced.margin.toNumber());
    }
    for (const priced of shinOutcomeGroups(current)) {
      const key = quoteKey(priced);
      if (!fairs.has(key)) {
        fairs.set(key, priced.fair.toDecimalPlaces(4).toNumber());
      }
    }
  }
  return { operatorOdds, lowestOdds, margins, fairs };
}

function record(acc: Acc, legs: readonly Leg[] | null) {
  acc.days += 1;
  if (legs === null) return;
  acc.composed += 1;
  const settled = legs.filter((l) => l.result === "WON" || l.result === "LOST");
  if (legs.every((l) => l.result === "WON" || l.result === "VOID")) {
    acc.daysWon += legs.some((l) => l.result === "WON") ? 1 : 0;
  }
  for (const leg of settled) {
    acc.legs += 1;
    acc.announced += leg.probability;
    acc.won += leg.result === "WON" ? 1 : 0;
    if (leg.margin != null) {
      acc.withMargin += 1;
      acc.margin += leg.margin;
    }
    if (leg.operatorOdds !== null) {
      acc.withOperatorOdds += 1;
      acc.operatorOdds += leg.operatorOdds;
    }
  }
}

function ratioOf(acc: Acc): { ratio: number; low: number; high: number } {
  const real = acc.legs > 0 ? acc.won / acc.legs : 0;
  const ann = acc.legs > 0 ? acc.announced / acc.legs : 1;
  const half =
    acc.legs > 0 ? Z95 * Math.sqrt((real * (1 - real)) / acc.legs) : 0;
  return {
    ratio: real / ann,
    low: (real - half) / ann,
    high: (real + half) / ann,
  };
}

function formatAcc(acc: Acc): string {
  const { ratio, low, high } = ratioOf(acc);
  const n = Math.max(acc.legs, 1);
  return (
    `jours ${acc.composed}/${acc.days} (gagnés ${acc.daysWon}) | jambes ${acc.legs} ` +
    `annoncé ${(acc.announced / n).toFixed(3)} réalisé ${(acc.won / n).toFixed(3)} ` +
    `ratio ${ratio.toFixed(3)} [${low.toFixed(3)} ; ${high.toFixed(3)}] | ` +
    `marge 1xBet ${((acc.margin / Math.max(acc.withMargin, 1)) * 100).toFixed(2)} % ` +
    `(connue ${acc.withMargin}/${acc.legs}) | cote 1xBet ${(acc.operatorOdds / Math.max(acc.withOperatorOdds, 1)).toFixed(3)}`
  );
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-engine-combo-margin-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };
  out(
    `Combiné du jour, départage par la marge 1xBet à ${TIE_WINDOW * 100} points — ${generatedAt.toISOString()}`,
  );
  out(
    `Composition à 17 h UTC la veille, calibration 90 jours, depuis ${FIRST_DAY.toISOString().slice(0, 10)}.`,
  );
  out();

  const rules: ReadonlyArray<{ label: string; config: ComboConfig }> = [
    {
      label: "actuelle (la moins chère)",
      config: { ...COMBO_CONFIG, marginTieBreak: undefined },
    },
    {
      label: "départage marge",
      config: { ...COMBO_CONFIG, marginTieBreak: { window: TIE_WINDOW } },
    },
  ];
  const lastDay = new Date(
    Math.floor((generatedAt.getTime() - DAY_MS) / DAY_MS) * DAY_MS,
  );
  const days: Date[] = [];
  for (let t = FIRST_DAY.getTime(); t < lastDay.getTime(); t += DAY_MS) {
    days.push(new Date(t));
  }
  const middle = days[Math.floor(days.length / 2)];
  if (!middle) throw new Error("no day to replay");
  const accs = new Map<string, Acc>();
  const accFor = (window: string, label: string): Acc => {
    const key = `${window}|${label}`;
    const acc = accs.get(key) ?? emptyAcc();
    accs.set(key, acc);
    return acc;
  };
  let changedLegs = 0;
  // Paired reading: only the legs the tie-break swaps, out and in.
  const swappedOut: Leg[] = [];
  const swappedIn: Leg[] = [];
  let changedDays = 0;

  for (const day of days) {
    const asOf = new Date(day.getTime() - COMPOSE_LEAD_MS);
    const [candidates, calibration] = await Promise.all([
      loadCandidates(day, asOf),
      loadCalibration(day, asOf),
    ]);
    const { operatorOdds, lowestOdds, margins, fairs } = priceAtOperator(
      await loadQuotes(candidates, asOf),
    );
    const pool: Candidate[] = candidates
      .filter((c) => {
        const price =
          operatorOdds.get(quoteKey(c)) ?? lowestOdds.get(quoteKey(c));
        return price === undefined || price >= OPERATOR_MIN_ODDS;
      })
      .map((c) => ({
        ...c,
        margin: margins.get(quoteKey(c)) ?? null,
        fairProbability: fairs.get(quoteKey(c)) ?? null,
      }));
    const byKey = new Map(pool.map((c) => [`${c.channel}|${quoteKey(c)}`, c]));
    const window = day < middle ? "ancienne" : "récente";
    const picked: Leg[][] = [];
    for (const rule of rules) {
      const selection = composeEngineCombo(pool, calibration, rule.config);
      const legs =
        selection.outcome === "picked"
          ? selection.legs.map((leg): Leg => {
              const source = byKey.get(`${leg.channel}|${quoteKey(leg)}`);
              return {
                ...leg,
                result: source?.result ?? null,
                operatorOdds: operatorOdds.get(quoteKey(leg)) ?? null,
              };
            })
          : null;
      picked.push(legs ?? []);
      for (const w of [window, "total"]) record(accFor(w, rule.label), legs);
    }
    const legKey = (l: Leg) => `${l.channel}|${quoteKey(l)}`;
    const [current = [], candidate = []] = picked;
    const currentKeys = new Set(current.map(legKey));
    const candidateKeys = new Set(candidate.map(legKey));
    const removed = current.filter((l) => !candidateKeys.has(legKey(l)));
    const added = candidate.filter((l) => !currentKeys.has(legKey(l)));
    swappedOut.push(...removed);
    swappedIn.push(...added);
    const differs = removed.length;
    changedLegs += differs;
    changedDays += differs > 0 ? 1 : 0;
    console.log(
      `${day.toISOString().slice(0, 10)} vivier ${pool.length} jambes changées ${differs}`,
    );
  }

  out(
    `${days.length} jours, coupure ${middle.toISOString().slice(0, 10)}. Jambes changées par le départage : ${changedLegs} sur ${changedDays} jours.`,
  );
  out();
  for (const window of ["ancienne", "récente", "total"]) {
    out(`== ${window.toUpperCase()} ==`);
    for (const rule of rules) {
      out(
        `  ${rule.label.padEnd(26)} ${formatAcc(accFor(window, rule.label))}`,
      );
    }
    out();
  }
  for (const [label, legs] of [
    ["jambes retirées", swappedOut],
    ["jambes prises à la place", swappedIn],
  ] as const) {
    const acc = emptyAcc();
    acc.days = 1;
    record(acc, legs);
    const known = legs.filter((l) => l.fairProbability != null);
    const fair =
      known.reduce((sum, l) => sum + (l.fairProbability ?? 0), 0) /
      Math.max(known.length, 1);
    out(
      `  ${label.padEnd(26)} ${formatAcc(acc).replace(/^jours [^|]*\| /, "")} | fréquence 1xBet ${fair.toFixed(3)}`,
    );
  }
  out();
  const [currentRule, newRule] = rules;
  if (!currentRule || !newRule) throw new Error("rules");
  const current = accFor("total", currentRule.label);
  const candidate = accFor("total", newRule.label);
  const marginDrops =
    candidate.margin / Math.max(candidate.withMargin, 1) <
    current.margin / Math.max(current.withMargin, 1);
  const band = ratioOf(current);
  const ratio = ratioOf(candidate).ratio;
  const inNoise = ratio >= band.low && ratio <= band.high;
  out(
    marginDrops && inNoise
      ? "VERDICT : la marge baisse et le ratio reste dans le bruit — expédier."
      : `VERDICT : ${marginDrops ? "la marge baisse" : "la marge ne baisse pas"}, ${inNoise ? "ratio dans le bruit" : "ratio hors du bruit"} — rien n'est expédié.`,
  );

  writeFileSync(outputPath, lines.join("\n") + "\n");
  console.log(`Rapport écrit : ${outputPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
