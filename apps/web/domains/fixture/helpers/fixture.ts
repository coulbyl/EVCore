import { formatTime } from "@/lib/date";
import type { FixtureRow } from "../types/fixture";
import type { FixturePanel } from "@/types/dashboard";

/** Formate le score d'un fixture terminé.
 *  score: "2 - 1", htScore: "1 - 0" → "2 – 1 (1 – 0 MT)" */
export function formatScore(
  score: string | null,
  htScore: string | null,
): string | null {
  if (!score) return null;
  const normalized = score.replace(/-/g, "–");
  if (!htScore) return normalized;
  return `${normalized} (${htScore.replace(/-/g, "–")} MT)`;
}

/** Formate l'heure de coup d'envoi. */
export function formatKickoff(iso: string): string {
  return formatTime(iso);
}

/** Convertit un FixtureRow en FixturePanel pour le side panel / drawer. */
export function toFixturePanel(row: FixtureRow): FixturePanel {
  const mr = row.modelRun;
  return {
    fixtureId: row.fixtureId,
    fixture: row.fixture,
    homeLogo: row.homeLogo,
    awayLogo: row.awayLogo,
    competition: row.competition,
    startTime: row.scheduledAt,
    market: mr?.market ?? "-",
    pick: mr?.pick ?? "-",
    modelConfidence: mr
      ? `Source : ${mr.predictionSource ?? "—"} — Score final : ${mr.finalScore}`
      : "Aucun model run disponible.",
    notes: [
      mr?.lambdaHome ? `λ domicile : ${mr.lambdaHome}` : null,
      mr?.lambdaAway ? `λ extérieur : ${mr.lambdaAway}` : null,
      mr?.expectedTotalGoals
        ? `buts attendus : ${mr.expectedTotalGoals}`
        : null,
    ].filter((n): n is string => n !== null),
    metrics: [
      { label: "EV", value: mr?.ev ?? "+0.000", tone: "accent" },
      {
        label: "Score final",
        value: mr?.finalScore ?? "0.00",
        tone: "success",
      },
      {
        label: "Déterministe",
        value: mr?.deterministicScore ?? "0.00",
        tone: "warning",
      },
      { label: "Prob.", value: mr?.probEstimated ?? "—", tone: "neutral" },
    ],
  };
}
