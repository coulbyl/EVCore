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
