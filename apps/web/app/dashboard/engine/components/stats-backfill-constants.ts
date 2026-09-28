// Shared display helpers for the automatic stats backfill section.

export const STATS_BACKFILL_WAVE_LABELS: Record<number, string> = {
  1: "Vague 1 · Top 5",
  2: "Vague 2 · Europe & D2",
  3: "Vague 3 · UEFA & mondial",
  4: "Vague 4 · Reste du backtest",
};

export function formatCount(value: number): string {
  return value.toLocaleString("fr-FR");
}

export function waveLabel(wave: number): string {
  return STATS_BACKFILL_WAVE_LABELS[wave] ?? `Vague ${wave}`;
}
