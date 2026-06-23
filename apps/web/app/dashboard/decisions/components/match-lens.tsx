"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Switch, cn } from "@evcore/ui";
import type {
  ChannelDecisionMatchDto,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";
import { CHANNEL_COLOR, CHANNEL_COLOR_SOFT, channelLabel } from "./channel-constants";
import {
  compareMatchesByConviction,
  daySummary,
  pickCount,
  selectedPicks,
} from "./decision-helpers";
import { DaySummary } from "./day-summary";
import { MatchCard } from "./match-card";

export function MatchLens({
  matches,
  locale,
}: {
  matches: ChannelDecisionMatchDto[];
  locale: string;
}) {
  const t = useTranslations("decisions");
  const [channel, setChannel] = useState<StrategyChannel | null>(null);
  const [onlyPicks, setOnlyPicks] = useState(false);

  const summary = useMemo(() => daySummary(matches), [matches]);

  // Conviction sort is the default; client-side filters narrow the day.
  const visible = useMemo(() => {
    const sorted = [...matches].sort(compareMatchesByConviction);
    return sorted.filter((m) => {
      if (onlyPicks && pickCount(m) === 0) return false;
      if (channel && !selectedPicks(m).some((d) => d.channel === channel)) {
        return false;
      }
      return true;
    });
  }, [matches, channel, onlyPicks]);

  // Only offer channel chips that actually produced a pick today.
  const channelOptions = summary.byChannel.map((c) => c.channel);

  return (
    <div className="flex flex-col gap-4">
      <DaySummary summary={summary} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={channel === null}
            onClick={() => setChannel(null)}
          >
            {t("filters.all")}
          </FilterChip>
          {channelOptions.map((c) => (
            <FilterChip
              key={c}
              active={channel === c}
              color={CHANNEL_COLOR[c]}
              softColor={CHANNEL_COLOR_SOFT[c]}
              onClick={() => setChannel(channel === c ? null : c)}
            >
              {channelLabel(c, t)}
            </FilterChip>
          ))}
        </div>

        <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={onlyPicks} onCheckedChange={setOnlyPicks} />
          {t("filters.onlyPicks")}
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("filters.noMatch")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((group) => (
            <MatchCard key={group.fixtureId} group={group} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  color,
  softColor,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  softColor?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[0.7rem] font-medium transition-colors",
        active
          ? "border-transparent"
          : "border-border/60 text-muted-foreground hover:text-foreground",
      )}
      style={
        active
          ? {
              color: color ?? "var(--foreground)",
              backgroundColor: softColor ?? "var(--accent-soft)",
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}
