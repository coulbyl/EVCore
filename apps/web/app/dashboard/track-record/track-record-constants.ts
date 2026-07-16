import type {
  ChannelHealthItem,
  ChannelStatsItem,
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

export const PERIODS: { key: PeriodKey; label: string; days: number | null }[] = [
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
  BTTS: "BTTS (BB)",
  GOALS: "GOALS (Buts)",
};

// Display order matching the formation lessons (VALUE/SAFE proven or
// promising, DOMINANT/DRAW improving, BTTS/GOALS exploratory signals).
export const CHANNEL_DISPLAY_ORDER: ChannelStatsItem["channel"][] = [
  "VALUE",
  "SAFE",
  "DOMINANT",
  "DRAW",
  "BTTS",
  "GOALS",
];

export type MergedChannelRow = ChannelStatsItem & {
  status: ChannelHealthItem["status"];
};

export function mergeChannelData(
  stats: ChannelStatsItem[],
  health: ChannelHealthItem[],
): MergedChannelRow[] {
  const statusByChannel = new Map(health.map((h) => [h.channel, h.status]));
  return CHANNEL_DISPLAY_ORDER.map((channel) => {
    const row = stats.find((s) => s.channel === channel);
    return {
      channel,
      hitRate: row?.hitRate ?? null,
      avgThreshold: row?.avgThreshold ?? null,
      vsThreshold: row?.vsThreshold ?? null,
      roi: row?.roi ?? null,
      netUnits: row?.netUnits ?? null,
      maxDrawdown: row?.maxDrawdown ?? null,
      sampleSize: row?.sampleSize ?? 0,
      oddsAvailabilityRate: row?.oddsAvailabilityRate ?? 0,
      trend: row?.trend ?? "FLAT",
      status: statusByChannel.get(channel) ?? "INSUFFICIENT_DATA",
    };
  });
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
