"use client";

import { useState } from "react";
import { Empty } from "@evcore/ui";
import { useTranslations } from "next-intl";
import type { ChannelDecisionChannelGroupDto } from "@/domains/channel-decision/types/channel-decision";
import { groupByCompetition } from "@/lib/group-by-competition";
import { groupByHour } from "@/lib/group-by-hour";
import { translateCountry } from "@/lib/competition-i18n";
import { GroupBySelect, type GroupByMode } from "@/components/group-by-select";
import { FiltersPopover } from "@/components/filters-popover";
import { ChannelSelectionRow } from "./channel-selection-row";

// Active-channel state for the "Par canal" lens. The active channel itself is
// now a URL-driven, page-level concern (ChannelFilterBar — no more a
// separate "Par canal" sub-header) — this hook just resolves it against the
// currently loaded channelGroups (falls back to the first one if the
// requested channel disappeared, e.g. a date change) and keeps its own
// grouping mode, unrelated to the URL.
export function useChannelLens(
  channelGroups: ChannelDecisionChannelGroupDto[],
  requestedChannel: string | null,
) {
  const [groupBy, setGroupBy] = useState<GroupByMode>("none");

  const activeChannel =
    requestedChannel && channelGroups.some((g) => g.channel === requestedChannel)
      ? requestedChannel
      : (channelGroups[0]?.channel ?? null);

  const activeGroup =
    channelGroups.find((g) => g.channel === activeChannel) ?? null;

  return {
    channelGroups,
    activeChannel,
    activeGroup,
    groupBy,
    setGroupBy,
  };
}

export type ChannelLensState = ReturnType<typeof useChannelLens>;

// Grouping control for the "Par canal" content — sits in the same headerExtra
// slot MatchFilters uses for "Par match", now that switching channels itself
// lives in ChannelFilterBar.
export function ChannelGroupByControl({
  groupBy,
  setGroupBy,
}: Pick<ChannelLensState, "groupBy" | "setGroupBy">) {
  const t = useTranslations("decisions");

  return (
    <FiltersPopover label={t("filters.displayLabel")} active={groupBy !== "none"}>
      <GroupBySelect
        value={groupBy}
        onChange={setGroupBy}
        labels={{
          none: t("filters.groupByNone"),
          league: t("filters.groupByLeague"),
        }}
        className="w-full"
      />
    </FiltersPopover>
  );
}

// The scrolling selection list for the active channel.
export function ChannelList({
  activeGroup,
  locale,
  groupBy,
}: {
  activeGroup: ChannelLensState["activeGroup"];
  locale: string;
  groupBy: GroupByMode;
}) {
  if (activeGroup === null || activeGroup.decisions.length === 0) {
    return (
      <Empty className="rounded-[1.6rem] border-border bg-background/20">
        Aucune sélection retenue pour cette date.
      </Empty>
    );
  }

  // Default view: grouped by kickoff time — see match-lens.tsx's MatchGrid
  // for the same rationale (2026-08 UX audit).
  if (groupBy === "none") {
    const hourGroups = groupByHour(activeGroup.decisions, (d) => d.kickoff);
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
              {hourGroup.items.map((decision) => (
                <ChannelSelectionRow
                  key={decision.id}
                  decision={decision}
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
    activeGroup.decisions,
    (d) => d.competitionName ?? d.competition ?? "—",
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
            {competitionGroup.items.map((decision) => (
              <ChannelSelectionRow
                key={decision.id}
                decision={decision}
                locale={locale}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
