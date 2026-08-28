import type {
  ChannelHealthItem,
  ChannelStatsItem,
  ChannelStatus,
  PnlSummary,
} from "@/domains/dashboard/types/dashboard";

export type PnlByCanalResponse = {
  from: string;
  to: string;
  global: PnlSummary;
  value: PnlSummary;
  safe: PnlSummary;
};

export type PeriodKey = "30" | "90" | "all";

export const PERIODS: { key: PeriodKey; label: string; days: number | null }[] =
  [
    { key: "30", label: "30 jours", days: 30 },
    { key: "90", label: "90 jours", days: 90 },
    { key: "all", label: "Tout l'historique", days: null },
  ];

// Earliest settled data currently in the DB (verified 2026-07-18) — used as
// the "from" bound for the "all" period instead of an arbitrary far-past date.
const EARLIEST_DATA_DATE = "2023-01-01";

export function resolvePeriod(value: string | undefined): PeriodKey {
  return value === "30" || value === "90" || value === "all" ? value : "90";
}

export function dateRangeForPeriod(period: PeriodKey): {
  from: string;
  to: string;
} {
  const to = new Date().toISOString().slice(0, 10);
  const config = PERIODS.find((p) => p.key === period);
  if (!config || config.days === null) {
    return { from: EARLIEST_DATA_DATE, to };
  }
  const from = new Date(Date.now() - config.days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

// CODE (Français) — même convention que la formation (apps/web/content/formation).
export const CHANNEL_LABELS: Record<ChannelStatsItem["channel"], string> = {
  VALUE: "VALUE (Valeur)",
  SAFE: "SAFE (Sécurité)",
  DOMINANT: "DOMINANT (Victoire)",
  DRAW: "DRAW (Nul)",
  BTTS: "BTTS (Les deux marquent)",
  GOALS: "GOALS (Buts)",
  CLEAN_SHEET: "CLEAN_SHEET (Cage inviolée)",
  TEAM_TOTAL: "TEAM_TOTAL (Buts par équipe)",
  DOUBLE_CHANCE: "DOUBLE_CHANCE (Double chance)",
  DRAW_NO_BET: "DRAW_NO_BET (Remboursé si nul)",
  WIN_TO_NIL: "WIN_TO_NIL (Gagne sans encaisser)",
  FIRST_HALF: "FIRST_HALF (1ʳᵉ mi-temps)",
  OVER_UNDER_HT: "OVER_UNDER_HT (Plus/moins mi-temps)",
  HALF_TIME_FULL_TIME: "HALF_TIME_FULL_TIME (Mi-temps/Fin)",
  RESULT_TOTAL_GOALS: "RESULT_TOTAL_GOALS (Issue + total)",
  RESULT_BTTS: "RESULT_BTTS (Issue + BTTS)",
  WIN_EITHER_HALF: "WIN_EITHER_HALF (Gagne une mi-temps)",
  CORRECT_SCORE: "CORRECT_SCORE (Score exact)",
  VANTAGE: "VANTAGE (Lecture croisée)",
};

/**
 * Ordre d'affichage — purement cosmétique.
 *
 * Ce n'est PAS un filtre, et c'est la correction du 2026-08-22 : cette liste
 * en contenait 10 et servait de `filter()`, ce qui rendait 8 canaux
 * invisibles sur la page de performance malgré leurs résultats réglés —
 * DOUBLE_CHANCE le premier, alors qu'il est le mieux mesuré du système. Les
 * canaux absents d'ici sont désormais affichés à la suite, jamais masqués
 * (voir mergedChannelRows).
 */
export const CHANNEL_DISPLAY_ORDER: ChannelStatsItem["channel"][] = [
  "DOUBLE_CHANCE",
  "DRAW",
  "VALUE",
  "SAFE",
  "DOMINANT",
  "TEAM_TOTAL",
  "DRAW_NO_BET",
  "BTTS",
  "GOALS",
  "FIRST_HALF",
  "OVER_UNDER_HT",
  "CLEAN_SHEET",
  "WIN_EITHER_HALF",
  "WIN_TO_NIL",
  "RESULT_TOTAL_GOALS",
  "RESULT_BTTS",
  "HALF_TIME_FULL_TIME",
  "CORRECT_SCORE",
  "VANTAGE",
];

/** Canaux reçus, classés selon CHANNEL_DISPLAY_ORDER, inconnus à la fin. */
export function orderChannels<
  T extends { channel: ChannelStatsItem["channel"] },
>(items: readonly T[]): T[] {
  const rank = (channel: ChannelStatsItem["channel"]) => {
    const i = CHANNEL_DISPLAY_ORDER.indexOf(channel);
    return i === -1 ? CHANNEL_DISPLAY_ORDER.length : i;
  };
  return [...items].sort((a, b) => rank(a.channel) - rank(b.channel));
}

export type MergedChannelRow = ChannelStatsItem & {
  status: ChannelHealthItem["status"];
};

/**
 * Fusionne stats et santé, pour TOUS les canaux renvoyés par le serveur.
 *
 * On part de `stats`, pas d'une liste locale : c'est le serveur qui sait
 * quels canaux existent. La version précédente itérait sur
 * CHANNEL_DISPLAY_ORDER, ce qui transformait un ordre d'affichage en filtre —
 * un canal absent de la liste locale disparaissait de la page même quand le
 * serveur renvoyait ses résultats.
 */
export function mergeChannelData(
  stats: ChannelStatsItem[],
  health: ChannelHealthItem[],
): MergedChannelRow[] {
  const statusByChannel = new Map(health.map((h) => [h.channel, h.status]));
  return orderChannels(
    stats.map((row) => ({
      ...row,
      status: statusByChannel.get(row.channel) ?? "INSUFFICIENT_DATA",
    })),
  );
}

// `roi`/`netUnits` come back from the backend already in percentage-number
// scale (e.g. 14.98 means +14.98%), NOT as a 0-1 fraction — see
// dashboard.service.ts `flatBetRoi`. Do not multiply by 100 here.
export function formatRoi(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

// `hitRate` IS a 0-1 fraction (`won / total`) — see `hitRateOf`.
export function formatHitRate(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

// Same signal as ChannelStatusBadge, applied to the ROI figure itself so the
// number reads as positive/negative/borderline before the reader parses the
// sign — the badge alone left ROI as flat, uncolored text.
const ROI_TONE_CLASS: Record<ChannelStatus, string> = {
  GREEN: "text-success",
  ORANGE: "text-warning",
  RED: "text-danger",
  INACTIVE: "text-muted-foreground",
  INSUFFICIENT_DATA: "text-muted-foreground",
};

export function roiToneClass(status: ChannelStatus): string {
  return ROI_TONE_CLASS[status];
}
