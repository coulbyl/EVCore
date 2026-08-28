"use client";

import { useState } from "react";
import { Empty } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { ScrollableTabs } from "@/components/scrollable-tabs";
import type { ChannelDecisionChannelGroupDto } from "@/domains/channel-decision/types/channel-decision";
import { groupByCompetition } from "@/lib/group-by-competition";
import { groupByHour } from "@/lib/group-by-hour";
import { translateCountry } from "@/lib/competition-i18n";
import { GroupBySelect, type GroupByMode } from "@/components/group-by-select";
import { FiltersPopover } from "@/components/filters-popover";
import { channelLabel } from "./channel-constants";
import { ChannelSelectionRow } from "./channel-selection-row";

// Active-channel state for the "Par canal" lens, lifted into a hook so the tab
// strip (pinned in the page sub-header) and the scrolling selection list (in the
// page content) stay in sync from different DOM regions. Falls back to the first
// channel, and re-anchors there if the selected channel disappears on a date change.
export function useChannelLens(
  channelGroups: ChannelDecisionChannelGroupDto[],
) {
  const [selected, setSelected] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupByMode>("none");

  const activeChannel =
    selected && channelGroups.some((g) => g.channel === selected)
      ? selected
      : (channelGroups[0]?.channel ?? null);

  const activeGroup =
    channelGroups.find((g) => g.channel === activeChannel) ?? null;

  return {
    channelGroups,
    activeChannel,
    setSelected,
    activeGroup,
    groupBy,
    setGroupBy,
  };
}

export type ChannelLensState = ReturnType<typeof useChannelLens>;

// The channel tab strip + grouping select. Lives in the pinned sub-header so
// it stays visible while the selections scroll underneath.
export function ChannelTabs({
  channelGroups,
  activeChannel,
  setSelected,
  groupBy,
  setGroupBy,
}: ChannelLensState) {
  const t = useTranslations("decisions");

  if (channelGroups.length === 0 || activeChannel === null) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <ScrollableTabs
          value={activeChannel}
          onValueChange={setSelected}
          items={channelGroups.map(({ channel, decisions }) => ({
            value: channel,
            label: (
              <>
                {channelLabel(channel, t)}
                <span className="ml-1 tabular-nums text-[0.65rem] opacity-60">
                  {decisions.length}
                </span>
              </>
            ),
          }))}
        />
      </div>
      <FiltersPopover label={t("filters.label")} active={groupBy !== "none"}>
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
    </div>
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
