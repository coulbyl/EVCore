"use client";

import type {
  ChannelHealthItem,
  ChannelStatus,
} from "@/domains/dashboard/types/dashboard";

const CANAL_STYLES = {
  EV: {
    color: "var(--canal-ev)",
    soft: "var(--canal-ev-soft)",
    border: "color-mix(in srgb, var(--canal-ev) 20%, transparent)",
  },
  SV: {
    color: "var(--canal-sv)",
    soft: "var(--canal-sv-soft)",
    border: "color-mix(in srgb, var(--canal-sv) 20%, transparent)",
  },
  CONF: {
    color: "var(--canal-conf)",
    soft: "var(--canal-conf-soft)",
    border: "color-mix(in srgb, var(--canal-conf) 20%, transparent)",
  },
  DRAW: {
    color: "var(--canal-draw)",
    soft: "var(--canal-draw-soft)",
    border: "color-mix(in srgb, var(--canal-draw) 20%, transparent)",
  },
  BTTS: {
    color: "var(--canal-btts)",
    soft: "var(--canal-btts-soft)",
    border: "color-mix(in srgb, var(--canal-btts) 20%, transparent)",
  },
} as const;

const STATUS_STYLES: Record<
  ChannelStatus,
  { dot: string; badge: string; label: string }
> = {
  GREEN: {
    dot: "bg-success",
    badge: "text-success bg-success/10 border border-success/30",
    label: "OK",
  },
  ORANGE: {
    dot: "bg-warning",
    badge: "text-warning bg-warning/10 border border-warning/30",
    label: "~",
  },
  RED: {
    dot: "bg-danger",
    badge: "text-danger bg-danger/10 border border-danger/30",
    label: "!",
  },
  INACTIVE: {
    dot: "bg-muted-foreground",
    badge: "text-muted-foreground bg-secondary border border-border",
    label: "—",
  },
  INSUFFICIENT_DATA: {
    dot: "bg-muted-foreground",
    badge: "text-muted-foreground bg-secondary border border-border",
    label: "?",
  },
};

const CHANNEL_LABELS: Record<ChannelHealthItem["channel"], string> = {
  EV: "EV",
  SV: "SV",
  CONF: "VICTOIRE",
  DRAW: "NUL",
  BTTS: "BB",
};

function formatMetric(item: ChannelHealthItem): string {
  if (item.primaryMetricType === "ROI") {
    const v = item.primaryMetric;
    return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  }
  return `${item.primaryMetric.toFixed(1)}%`;
}

function ChannelHealthChip({ item }: { item: ChannelHealthItem }) {
  const canal = CANAL_STYLES[item.channel];
  const status = STATUS_STYLES[item.status];

  return (
    <div
      className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border px-3 py-2"
      style={{ borderColor: canal.border, background: canal.soft }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`size-2 shrink-0 rounded-full ${status.dot}`} />
        <span
          className="text-[0.65rem] font-bold uppercase tracking-[0.18em] truncate"
          style={{ color: canal.color }}
        >
          {CHANNEL_LABELS[item.channel]}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.sampleSize > 0 && (
          <span className="tabular-nums text-xs text-muted-foreground">
            {formatMetric(item)}
          </span>
        )}
        <span
          className={`rounded-md px-1.5 py-0.5 text-[0.6rem] font-semibold tabular-nums ${status.badge}`}
        >
          {status.label}
        </span>
      </div>
    </div>
  );
}

export function ChannelHealthStrip({ items }: { items: ChannelHealthItem[] }) {
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
      {items.map((item) => (
        <ChannelHealthChip key={item.channel} item={item} />
      ))}
    </div>
  );
}
