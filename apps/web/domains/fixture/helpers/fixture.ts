import { formatTime } from "@/lib/date";

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
