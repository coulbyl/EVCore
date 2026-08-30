"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ChannelDecisionMatchDto } from "@/domains/channel-decision/types/channel-decision";
import { groupByCompetition } from "@/lib/group-by-competition";
import { groupByHour } from "@/lib/group-by-hour";
import { translateCountry } from "@/lib/competition-i18n";
import { GroupBySelect, type GroupByMode } from "@/components/group-by-select";
import { MatchCard } from "./match-card";

// Grouping state for the "Par match" lens. Lifted into a hook so the filter
// bar (pinned in a second page header, outside the scroll) and the scrolling
// card grid can read the same state from different DOM regions. Channel
// filtering lives in the dedicated "Par canal" lens, not here.
export function useMatchLens(matches: ChannelDecisionMatchDto[]) {
  const [groupBy, setGroupBy] = useState<GroupByMode>("none");

  // Chronological order (scheduledAt desc) comes straight from the API — no
  // client-side re-sort or filtering here.
  return { groupBy, setGroupBy, visible: matches };
}

export type MatchLensState = ReturnType<typeof useMatchLens>;

// The grouping select — collapsed into a FiltersPopover (see
// decisions-page-frame.tsx) instead of its own full-width row, which used to
// push mobile users several screens' worth of chrome down before any match
// content.
export function MatchFilters({ groupBy, setGroupBy }: MatchLensState) {
  const t = useTranslations("decisions");

  return (
    <GroupBySelect
      value={groupBy}
      onChange={setGroupBy}
      labels={{
        none: t("filters.groupByNone"),
        league: t("filters.groupByLeague"),
      }}
      className="w-full"
    />
  );
}

// True when a non-default filter is set — drives the FiltersPopover's
// active-state dot so collapsing the controls doesn't hide that state.
export function hasActiveMatchFilters(state: MatchLensState): boolean {
  return state.groupBy !== "none";
}

// The scrolling card grid for the "Par match" lens.
export function MatchGrid({
  visible,
  locale,
  groupBy,
}: {
  visible: ChannelDecisionMatchDto[];
  locale: string;
  groupBy: GroupByMode;
}) {
  const t = useTranslations("decisions");

  if (visible.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("filters.noMatch")}
      </p>
    );
  }

  // Default view: grouped by kickoff time rather than a flat list — the
  // kickoff used to be buried in each card's muted metadata line (2026-08 UX
  // audit finding). `kickoff` arrives pre-formatted "HH:mm", so a string sort
  // is already chronological.
  if (groupBy === "none") {
    const hourGroups = groupByHour(visible, (m) => m.kickoff);
    return (
      <div className="flex flex-col gap-6">
        {hourGroups.map((hourGroup) => (
          <section key={hourGroup.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-[0.95rem] font-bold text-foreground">
                {hourGroup.key}
              </h3>
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                {hourGroup.items.length} match
                {hourGroup.items.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {hourGroup.items.map((group) => (
                <MatchCard
                  key={group.fixtureId}
                  group={group}
                  locale={locale}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const groups = groupByCompetition(
    visible,
    (m) => m.competitionName ?? m.competition ?? "—",
  );

  return (
    <div className="flex flex-col gap-6">
      {groups.map((competitionGroup) => (
        <section key={competitionGroup.key} className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {competitionGroup.key}
            {competitionGroup.items[0]?.country && (
              <span className="ml-1.5 font-normal normal-case opacity-70">
                · {translateCountry(competitionGroup.items[0].country, locale)}
              </span>
            )}
            <span className="ml-1.5 font-normal opacity-60">
              ({competitionGroup.items.length})
            </span>
          </h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {competitionGroup.items.map((group) => (
              <MatchCard key={group.fixtureId} group={group} locale={locale} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
