"use client";

import { useChannelStats } from "@/domains/dashboard/use-cases/get-channel-health";
import type { ChannelStatsItem } from "@/domains/dashboard/types/dashboard";

const CANAL_LABEL: Record<ChannelStatsItem["channel"], string> = {
  VALUE: "VALUE",
  SAFE: "SAFE",
  DOMINANT: "VICTOIRE",
  BTTS: "BTTS",
  DRAW: "DRAW",
};

const CANAL_COLOR: Record<ChannelStatsItem["channel"], string> = {
  VALUE: "var(--canal-value)",
  SAFE: "var(--canal-safe)",
  DOMINANT: "var(--canal-dominant)",
  BTTS: "var(--canal-btts)",
  DRAW: "var(--canal-draw)",
};

const HR_TARGET: Partial<Record<ChannelStatsItem["channel"], number>> = {
  SAFE: 60,
  BTTS: 65,
  DOMINANT: 50,
};

const MAX_DRAWDOWN_TARGET = 10;

function fmt(value: number | null, suffix = "%", decimals = 1): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}${suffix}`;
}

function MetricCell({
  value,
  suffix = "%",
  decimals = 1,
  good,
  warn,
}: {
  value: number | null;
  suffix?: string;
  decimals?: number;
  good?: boolean;
  warn?: boolean;
}) {
  if (value === null)
    return (
      <span className="text-[0.6rem] italic text-muted-foreground">—</span>
    );

  const colorClass = good
    ? "text-success"
    : warn
      ? "text-warning"
      : "text-danger";

  return (
    <span className={`tabular-nums text-xs font-semibold ${colorClass}`}>
      {fmt(value, suffix, decimals)}
    </span>
  );
}

function ChannelRow({ item }: { item: ChannelStatsItem }) {
  const color = CANAL_COLOR[item.channel];
  const hrTarget = HR_TARGET[item.channel];
  const insufficient = item.sampleSize < 20;

  const roiGood = item.roi !== null && item.roi >= 0;
  const roiWarn = item.roi !== null && item.roi < 0 && item.roi >= -10;

  const hrGood =
    hrTarget !== undefined && item.hitRate !== null && item.hitRate >= hrTarget;
  const hrWarn =
    hrTarget !== undefined &&
    item.hitRate !== null &&
    item.hitRate >= hrTarget - 5 &&
    !hrGood;

  const ddValue = item.maxDrawdown;
  const ddGood = ddValue !== null && ddValue < MAX_DRAWDOWN_TARGET;
  const ddWarn =
    ddValue !== null &&
    ddValue >= MAX_DRAWDOWN_TARGET &&
    ddValue < MAX_DRAWDOWN_TARGET * 1.5;

  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-panel/50 transition-colors">
      <td className="py-2.5 pl-3 pr-2">
        <span
          className="text-[0.65rem] font-bold uppercase tracking-[0.18em]"
          style={{ color }}
        >
          {CANAL_LABEL[item.channel]}
        </span>
      </td>

      <td className="px-2 py-2.5 text-right">
        {item.hitRate !== null ? (
          <span className="flex flex-col items-end gap-0.5">
            <MetricCell value={item.hitRate} good={hrGood} warn={hrWarn} />
            {hrTarget !== undefined && (
              <span className="text-[0.55rem] text-muted-foreground">
                cible {hrTarget}%
              </span>
            )}
          </span>
        ) : (
          <span className="text-[0.6rem] italic text-muted-foreground">—</span>
        )}
      </td>

      <td className="px-2 py-2.5 text-right">
        <MetricCell value={item.roi} good={roiGood} warn={roiWarn} />
      </td>

      <td className="px-2 py-2.5 text-right">
        <MetricCell
          value={item.netUnits}
          suffix=" u."
          decimals={2}
          good={(item.netUnits ?? -1) > 0}
          warn={(item.netUnits ?? -1) >= -5 && (item.netUnits ?? -1) <= 0}
        />
      </td>

      <td className="px-2 py-2.5 text-right">
        {ddValue !== null ? (
          <span className="flex flex-col items-end gap-0.5">
            <MetricCell
              value={-ddValue}
              suffix=" u."
              decimals={1}
              good={ddGood}
              warn={ddWarn}
            />
            <span className="text-[0.55rem] text-muted-foreground">
              max &lt; {MAX_DRAWDOWN_TARGET}u
            </span>
          </span>
        ) : (
          <span className="text-[0.6rem] italic text-muted-foreground">—</span>
        )}
      </td>

      <td className="px-2 py-2.5 text-right">
        <span
          className={`text-xs tabular-nums ${insufficient ? "text-muted-foreground" : "text-foreground"}`}
        >
          {item.sampleSize}
          {insufficient && (
            <span className="ml-1 text-[0.55rem] text-warning">insuff.</span>
          )}
        </span>
      </td>
    </tr>
  );
}

export function ChannelPerformanceTable() {
  const { data, isLoading } = useChannelStats();

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Performance par canal
          </p>
          <p className="mt-0.5 text-[0.6rem] text-muted-foreground/70">
            200 derniers paris settlés par canal
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              {[
                "Canal",
                "Hit rate",
                "ROI",
                "Unités nettes",
                "Drawdown max",
                "Volume",
              ].map((col) => (
                <th
                  key={col}
                  className="px-2 py-2 text-right text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground first:pl-3 first:text-left"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  Chargement…
                </td>
              </tr>
            ) : (
              (data ?? []).map((item) => (
                <ChannelRow key={item.channel} item={item} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
