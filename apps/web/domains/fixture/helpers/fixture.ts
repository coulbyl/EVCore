import { formatTime } from "@/lib/date";

const BETTABLE_CUTOFF_MINUTES = 30;
const NON_BETTABLE_STATUSES = new Set(["FINISHED", "POSTPONED", "CANCELLED"]);

/** Returns true only if a bet can still be placed on this fixture.
 *  Blocks if status is terminal OR if kickoff was more than 30 min ago
 *  (guards against ETL lag where status hasn't been updated yet). */
export function isFixtureBettable(fixture: {
  status: string;
  scheduledAt: string;
}): boolean {
  if (NON_BETTABLE_STATUSES.has(fixture.status)) return false;
  const cutoff =
    new Date(fixture.scheduledAt).getTime() + BETTABLE_CUTOFF_MINUTES * 60_000;
  return Date.now() < cutoff;
}

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
