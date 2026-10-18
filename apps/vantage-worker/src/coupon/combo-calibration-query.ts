import { prisma } from "@evcore/db";
import type { CalibrationCell } from "@evcore/analysis-core";

/**
 * Calibration canal × compétition sur une fenêtre glissante — réel / annoncé
 * et volume, sur les sélections réglées d'avant coup d'envoi. La même matière
 * que la pastille de confiance de Décisions et que le combiné du moteur
 * (apps/backend `findChannelCompetitionCalibration`) : les deux combinés
 * doivent juger l'éligibilité d'une jambe avec les mêmes chiffres.
 */
export async function loadChannelCompetitionCalibration(
  since: Date,
): Promise<CalibrationCell[]> {
  const rows = await prisma.$queryRaw<
    {
      channel: string;
      competition: string;
      sampleSize: number;
      ratio: number | null;
    }[]
  >`
    SELECT s.channel::text AS channel,
           c.code          AS competition,
           count(*)::int   AS "sampleSize",
           CASE WHEN sum(s.probability) > 0
                THEN (sum((s.result = 'WON')::int) / sum(s.probability))::float
                ELSE NULL END AS ratio
    FROM public.channel_selection_deduped s
    JOIN public.fixture f ON f.id = s."fixtureId"
    JOIN public.season se ON se.id = f."seasonId"
    JOIN public.competition c ON c.id = se."competitionId"
    WHERE s.result IN ('WON', 'LOST')
      AND s."scheduledAt" >= ${since}
    GROUP BY s.channel, c.code
  `;
  return rows.map((r) => ({
    channel: r.channel,
    competition: r.competition,
    sampleSize: r.sampleSize,
    ratio: r.ratio,
  }));
}

/** Books où les utilisateurs misent, et leur minimum de cote — mêmes
 * valeurs que apps/backend (playable-odds.constants.ts). */
export const OPERATOR_BOOKMAKERS: readonly string[] = ["1xBet"];
export const OPERATOR_MIN_ODDS = 1.1;

export type OperatorQuoteKey = {
  fixtureId: string;
  market: string;
  pick: string;
};

export function operatorQuoteKey(key: OperatorQuoteKey): string {
  return `${key.fixtureId}|${key.market}|${key.pick}`;
}

/**
 * Dernier prix d'avant coup d'envoi chez le book de l'utilisateur pour
 * chaque choix demandé (1X2 relevé en triplet : une ligne par issue). Sert
 * la garde « jouable chez l'opérateur » du combiné Analyse IA, la même que
 * celle des produits du moteur côté backend.
 */
export async function loadOperatorQuotes(
  keys: readonly OperatorQuoteKey[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (keys.length === 0) return result;
  const fixtureIds = [...new Set(keys.map((k) => k.fixtureId))];
  const markets = [...new Set(keys.map((k) => k.market))];
  const wanted = new Set(keys.map(operatorQuoteKey));
  const rows = await prisma.$queryRaw<
    { fixtureId: string; market: string; pick: string; odds: number }[]
  >`
    WITH latest AS (
      SELECT DISTINCT ON (o."fixtureId", o.market, o.pick)
             o."fixtureId", o.market, o.pick, o.odds, o."homeOdds", o."drawOdds", o."awayOdds"
      FROM public.odds_snapshot o
      JOIN public.fixture f ON f.id = o."fixtureId"
      WHERE o."fixtureId" = ANY(${fixtureIds}::uuid[])
        AND o.market::text = ANY(${markets}::text[])
        AND o.bookmaker = ANY(${[...OPERATOR_BOOKMAKERS]}::text[])
        AND o.line IS NULL
        AND o."snapshotAt" <= f."scheduledAt"
      ORDER BY o."fixtureId", o.market, o.pick, o."snapshotAt" DESC
    )
    SELECT latest."fixtureId"::text AS "fixtureId", latest.market::text AS market, latest.pick, latest.odds::float AS odds
    FROM latest WHERE latest.pick IS NOT NULL AND latest.odds IS NOT NULL
    UNION ALL
    SELECT latest."fixtureId"::text, latest.market::text, side.pick, side.odds::float
    FROM latest
    CROSS JOIN LATERAL (VALUES ('HOME', latest."homeOdds"), ('DRAW', latest."drawOdds"), ('AWAY', latest."awayOdds")) AS side(pick, odds)
    WHERE latest.pick IS NULL AND side.odds IS NOT NULL
  `;
  for (const row of rows) {
    const key = operatorQuoteKey(row);
    if (wanted.has(key)) result.set(key, row.odds);
  }
  return result;
}
