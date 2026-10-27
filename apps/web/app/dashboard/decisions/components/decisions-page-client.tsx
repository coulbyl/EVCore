"use client";

import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  useChannelDecisionChannels,
  useChannelDecisionFacets,
  useChannelDecisionMatches,
} from "@/domains/channel-decision/use-cases/use-channel-decisions";
import { useChannelCompetitionStats } from "@/domains/dashboard/use-cases/get-channel-health";
import type { StrategyChannel } from "@/domains/channel-decision/types/channel-decision";
import { todayIso } from "@/lib/date";
import { dateRangeForPeriod } from "@/app/dashboard/track-record/track-record-constants";
import { DecisionsPageFrame } from "./decisions-page-frame";
import { LeagueFilterBar } from "./league-filter-bar";
import { ChannelFilterBar } from "./channel-filter-bar";
import { buildCalibrationByKey } from "./channel-constants";
import {
  MatchFilters,
  MatchGrid,
  hasActiveMatchFilters,
  useMatchLens,
} from "./match-lens";
import {
  ChannelList,
  ChannelGroupByControl,
  useChannelLens,
} from "./channel-lens";

// Single decisions surface: one route, two lenses (by match / by channel)
// toggled in-page via the channel switcher — "Match" plus one entry per
// channel, replacing the old segmented toggle + separate "Par canal" tab
// strip. Date, the selected league and the active channel all live in the
// URL so the view survives a refresh and stays shareable. Both switchers
// (league, channel) are single-select — there is no separate multi-select
// "filter" concept layered on top of the channel switch: picking a channel
// both displays it and narrows the backend fetch to it.
export function DecisionsPageClient() {
  const today = todayIso();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();

  const date = searchParams.get("date") ?? today;
  // null (no "active" param) → "Match" view, i.e. grouped-by-match.
  const activeChannel = searchParams.get("active");
  const view = activeChannel === null ? "matches" : "channels";
  const selectedLeague = searchParams.get("league");

  // Server-side filter — selecting a league/channel asks the backend for
  // just that subset instead of fetching every fixture/channel for the day
  // and filtering in memory (see ChannelDecisionRepository.findByDate's
  // DISTINCT ON cost).
  const filters = {
    competition: selectedLeague ? [selectedLeague] : undefined,
    channel:
      view === "channels" && activeChannel
        ? [activeChannel as StrategyChannel]
        : undefined,
  };
  const matches = useChannelDecisionMatches(date, filters, {
    enabled: view === "matches",
  });
  const channels = useChannelDecisionChannels(date, filters, {
    enabled: view === "channels",
  });
  const active = view === "matches" ? matches : channels;
  // isLoading alone only covers the first-ever fetch of a queryKey — toggling
  // back to a lens whose data is cached (view switch, revisited filter) skips
  // straight to fetchStatus "fetching" without a "pending" phase, so isLoading
  // stays false while the network call is in flight. isFetching covers that.
  const isLoading = active.isLoading || active.isFetching;

  // Cheap, independent of the (much heavier) matches/channels fetch above —
  // renders instantly and never needs to filter itself by the current
  // selection (the point of a facet: it always offers a way back out).
  const facets = useChannelDecisionFacets(date);
  const facetsData = facets.data ?? { leagues: [], channels: [] };
  const hasFacets = facetsData.leagues.length > 0;

  // Calibration canal × championnat sur 90 jours : ne sert plus qu'au choix
  // de « Notre sélection » (primaryPick) ; plus aucun badge ne l'affiche
  // (décision du 2026-10-27, docs/audits/2026-10-27/DECISIONS.md).
  const calibrationRange = dateRangeForPeriod("90");
  const calibrationStats = useChannelCompetitionStats(
    calibrationRange.from,
    calibrationRange.to,
  );
  const calibrationByKey = useMemo(
    () => buildCalibrationByKey(calibrationStats.data ?? []),
    [calibrationStats.data],
  );

  // Hooks stay unconditional (rules of hooks); the inactive lens just runs
  // over an empty list.
  const matchLens = useMatchLens(matches.data ?? []);
  const channelLens = useChannelLens(channels.data ?? [], activeChannel);

  function navigate(next: {
    date?: string;
    active?: string | null;
    league?: string | null;
  }) {
    const params = new URLSearchParams({ date: next.date ?? date });
    const nextActive = next.active !== undefined ? next.active : activeChannel;
    if (nextActive !== null) params.set("active", nextActive);
    const nextLeague = next.league !== undefined ? next.league : selectedLeague;
    if (nextLeague !== null) params.set("league", nextLeague);
    router.push(`/dashboard/decisions?${params.toString()}`);
  }

  const hasData = (active.data?.length ?? 0) > 0;

  return (
    <DecisionsPageFrame
      date={date}
      onDateChange={(iso) => navigate({ date: iso })}
      emptyTitle="Aucune décision"
      emptyDescription="Le moteur n'a produit aucune décision de canal pour cette date."
      hasData={hasData}
      isError={active.isError}
      isLoading={isLoading}
      filters={
        !hasFacets ? null : (
          <>
            <LeagueFilterBar
              options={facetsData.leagues}
              selected={selectedLeague}
              onSelect={(league) => navigate({ league })}
            />
            <ChannelFilterBar
              options={facetsData.channels}
              selected={activeChannel}
              onSelect={(channel) => navigate({ active: channel })}
            />
          </>
        )
      }
      displayControls={
        !hasData ? undefined : view === "matches" ? (
          <MatchFilters {...matchLens} />
        ) : (
          <ChannelGroupByControl
            groupBy={channelLens.groupBy}
            setGroupBy={channelLens.setGroupBy}
          />
        )
      }
      activeFilterCount={
        (selectedLeague !== null ? 1 : 0) +
        (activeChannel !== null ? 1 : 0) +
        (hasData && view === "matches" && hasActiveMatchFilters(matchLens)
          ? 1
          : 0)
      }
    >
      {view === "matches" ? (
        <MatchGrid
          visible={matchLens.visible}
          locale={locale}
          groupBy={matchLens.groupBy}
          calibrationByKey={calibrationByKey}
        />
      ) : (
        <ChannelList
          activeGroup={channelLens.activeGroup}
          locale={locale}
          groupBy={channelLens.groupBy}
        />
      )}
    </DecisionsPageFrame>
  );
}
