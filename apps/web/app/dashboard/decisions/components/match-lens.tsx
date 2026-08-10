"use client";

import { Fragment, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@evcore/ui";
import type { ChannelDecisionMatchDto } from "@/domains/channel-decision/types/channel-decision";
import { groupByCompetition } from "@/lib/group-by-competition";
import { translateCountry } from "@/lib/competition-i18n";
import { GroupBySelect, type GroupByMode } from "@/components/group-by-select";
import { pickCount } from "./decision-helpers";
import { MatchCard } from "./match-card";

// Filter state for the "Par match" lens. Lifted into a hook so the filter
// bar (pinned in a second page header, outside the scroll) and the scrolling
// card grid can read the same state from different DOM regions. Channel
// filtering lives in the dedicated "Par canal" lens, not here.
export function useMatchLens(matches: ChannelDecisionMatchDto[]) {
  const [onlyPicks, setOnlyPicks] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByMode>("none");

  // Chronological order (scheduledAt desc) comes straight from the API — no
  // client-side re-sort. The "only picks" toggle narrows the day.
  const visible = useMemo(() => {
    return matches.filter((m) => !(onlyPicks && pickCount(m) === 0));
  }, [matches, onlyPicks]);

  return { onlyPicks, setOnlyPicks, groupBy, setGroupBy, visible };
}

export type MatchLensState = ReturnType<typeof useMatchLens>;

// The "only picks" toggle + grouping select — rendered as direct siblings of
// DateNav in the header row (same level as Investir's filters), not a
// separate boxed panel.
export function MatchFilters({
  onlyPicks,
  setOnlyPicks,
  groupBy,
  setGroupBy,
}: MatchLensState) {
  const t = useTranslations("decisions");

  return (
    <Fragment>
      <label className="flex w-full shrink-0 items-center gap-2 text-xs text-muted-foreground lg:w-auto">
        <Switch checked={onlyPicks} onCheckedChange={setOnlyPicks} />
        {t("filters.onlyPicks")}
      </label>
      <GroupBySelect
        value={groupBy}
        onChange={setGroupBy}
        labels={{
          none: t("filters.groupByNone"),
          league: t("filters.groupByLeague"),
        }}
        className="w-full lg:w-auto lg:min-w-[190px]"
      />
    </Fragment>
  );
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

  if (groupBy === "none") {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {visible.map((group) => (
          <MatchCard key={group.fixtureId} group={group} locale={locale} />
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
