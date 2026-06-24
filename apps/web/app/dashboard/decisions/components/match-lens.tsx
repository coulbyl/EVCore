"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@evcore/ui";
import type { ChannelDecisionMatchDto } from "@/domains/channel-decision/types/channel-decision";
import {
  compareMatchesByConviction,
  daySummary,
  pickCount,
} from "./decision-helpers";
import { DaySummary } from "./day-summary";
import { MatchCard } from "./match-card";

// Filter + summary state for the "Par match" lens. Lifted into a hook so the
// summary/filter bar (pinned in a second page header, outside the scroll) and
// the scrolling card grid can read the same state from different DOM regions.
// Channel filtering lives in the dedicated "Par canal" lens, not here.
export function useMatchLens(matches: ChannelDecisionMatchDto[]) {
  const [onlyPicks, setOnlyPicks] = useState(false);

  const summary = useMemo(() => daySummary(matches), [matches]);

  // Conviction sort is the default; the "only picks" toggle narrows the day.
  const visible = useMemo(() => {
    const sorted = [...matches].sort(compareMatchesByConviction);
    return sorted.filter((m) => !(onlyPicks && pickCount(m) === 0));
  }, [matches, onlyPicks]);

  return { onlyPicks, setOnlyPicks, summary, visible };
}

export type MatchLensState = ReturnType<typeof useMatchLens>;

// The orientation strip + "only picks" toggle. Lives in the pinned sub-header
// so it stays visible while the cards scroll underneath.
export function MatchFilters({ summary, onlyPicks, setOnlyPicks }: MatchLensState) {
  const t = useTranslations("decisions");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <DaySummary summary={summary} />

      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <Switch checked={onlyPicks} onCheckedChange={setOnlyPicks} />
        {t("filters.onlyPicks")}
      </label>
    </div>
  );
}

// The scrolling card grid for the "Par match" lens.
export function MatchGrid({
  visible,
  locale,
}: {
  visible: ChannelDecisionMatchDto[];
  locale: string;
}) {
  const t = useTranslations("decisions");

  if (visible.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("filters.noMatch")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((group) => (
        <MatchCard key={group.fixtureId} group={group} locale={locale} />
      ))}
    </div>
  );
}
