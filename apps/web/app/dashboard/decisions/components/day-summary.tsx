import { useTranslations } from "next-intl";
import {
  CHANNEL_COLOR,
  CHANNEL_COLOR_SOFT,
  channelLabel,
} from "./channel-constants";
import type { DaySummary as DaySummaryData } from "./decision-helpers";

// One-glance orientation strip above the cards: how many matches, how many
// picks, how many flagged for avoidance, and the per-channel breakdown.
export function DaySummary({ summary }: { summary: DaySummaryData }) {
  const t = useTranslations("decisions");

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border/60 bg-background/30 px-4 py-2.5 text-xs">
      <Stat value={summary.matches} label={t("summary.matches")} />
      <Stat value={summary.picks} label={t("summary.picks")} />
      <Stat value={summary.withPicks} label={t("summary.withPicks")} />
      {summary.avoided > 0 && (
        <Stat
          value={summary.avoided}
          label={t("summary.avoided")}
          color="var(--canal-avoid)"
        />
      )}

      {summary.byChannel.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {summary.byChannel.map(({ channel, count }) => (
            <span
              key={channel}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium tabular-nums"
              style={{
                color: CHANNEL_COLOR[channel],
                backgroundColor: CHANNEL_COLOR_SOFT[channel],
              }}
            >
              {channelLabel(channel, t)}
              <span className="font-semibold">{count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <span className="flex items-baseline gap-1">
      <span
        className="text-sm font-semibold tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
