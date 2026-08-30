"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useChannelDecisionChannels,
  useChannelDecisionMatches,
} from "@/domains/channel-decision/use-cases/use-channel-decisions";
import { todayIso } from "@/lib/date";
import { deriveLeagueOptions, filterByLeague } from "@/lib/league-filter";
import { FiltersPopover } from "@/components/filters-popover";
import { DecisionsPageFrame } from "./decisions-page-frame";
import { LeagueFilterBar } from "./league-filter-bar";
import type { DecisionsView } from "./lens-toggle";
import {
  MatchFilters,
  MatchGrid,
  hasActiveMatchFilters,
  useMatchLens,
} from "./match-lens";
import { ChannelTabs, ChannelList, useChannelLens } from "./channel-lens";

// Single decisions surface: one route, two lenses (by match / by channel)
// toggled in-page. Date and view both live in the URL so the view survives a
// refresh and stays shareable, without a second page.
export function DecisionsPageClient() {
  const today = todayIso();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("decisions");

  const date = searchParams.get("date") ?? today;
  const view: DecisionsView =
    searchParams.get("view") === "channels" ? "channels" : "matches";
  // Championship filter — shared by both lenses via the URL (not per-lens
  // state) so it survives switching between "Par match" and "Par canal".
  const selectedLeague = searchParams.get("league");

  const matches = useChannelDecisionMatches(
    date,
    {},
    { enabled: view === "matches" },
  );
  const channels = useChannelDecisionChannels(
    date,
    {},
    { enabled: view === "channels" },
  );
  const active = view === "matches" ? matches : channels;
  // isLoading alone only covers the first-ever fetch of a queryKey — toggling
  // back to a lens whose data is cached (view switch, revisited filter) skips
  // straight to fetchStatus "fetching" without a "pending" phase, so isLoading
  // stays false while the network call is in flight. isFetching covers that.
  const isLoading = active.isLoading || active.isFetching;

  // Client-side filter over the day's already-fetched data — no refetch, so
  // switching leagues (or the whole "Tous" reset) is instant.
  const filteredMatches = useMemo(
    () =>
      filterByLeague(matches.data ?? [], selectedLeague, (m) => m.competition),
    [matches.data, selectedLeague],
  );
  const filteredChannelGroups = useMemo(() => {
    const groups = channels.data ?? [];
    if (!selectedLeague) return groups;
    return groups.map((group) => ({
      ...group,
      decisions: group.decisions.filter(
        (d) => d.competition === selectedLeague,
      ),
    }));
  }, [channels.data, selectedLeague]);

  // Options come from whichever lens is currently loaded — both cover the
  // same date's fixtures, just shaped differently, so the set of leagues
  // present is the same either way. Narrowed to the shape deriveLeagueOptions
  // actually needs so the union of the two DTOs doesn't fight generic
  // inference.
  const leagueOptions = useMemo(() => {
    const items: {
      competition: string | null;
      competitionName: string | null;
      country: string | null;
    }[] =
      view === "matches"
        ? (matches.data ?? [])
        : (channels.data ?? []).flatMap((g) => g.decisions);
    return deriveLeagueOptions(items, (item) => ({
      code: item.competition,
      name: item.competitionName,
      country: item.country,
    }));
  }, [view, matches.data, channels.data]);

  // Hooks stay unconditional (rules of hooks); the inactive lens just runs over
  // an empty list. Each lens pins its own bar (filters / tabs) in the sub-header.
  const matchLens = useMatchLens(filteredMatches);
  const channelLens = useChannelLens(filteredChannelGroups);

  function navigate(next: {
    date?: string;
    view?: DecisionsView;
    league?: string | null;
  }) {
    const params = new URLSearchParams({
      date: next.date ?? date,
      view: next.view ?? view,
    });
    const nextLeague = next.league !== undefined ? next.league : selectedLeague;
    if (nextLeague) params.set("league", nextLeague);
    router.push(`/dashboard/decisions?${params.toString()}`);
  }

  const hasData = (active.data?.length ?? 0) > 0;

  return (
    <DecisionsPageFrame
      date={date}
      view={view}
      onViewChange={(v) => navigate({ view: v })}
      onDateChange={(iso) => navigate({ date: iso })}
      emptyTitle="Aucune décision"
      emptyDescription="Le moteur n'a produit aucune décision de canal pour cette date."
      hasData={hasData}
      isError={active.isError}
      isLoading={isLoading}
      leagueFilter={
        !hasData ? null : (
          <LeagueFilterBar
            options={leagueOptions}
            selected={selectedLeague}
            onSelect={(code) => navigate({ league: code })}
          />
        )
      }
      headerExtra={
        !hasData || view !== "matches" ? null : (
          <FiltersPopover
            label={t("filters.label")}
            active={hasActiveMatchFilters(matchLens)}
          >
            <MatchFilters {...matchLens} />
          </FiltersPopover>
        )
      }
      subHeader={
        !hasData || view !== "channels" ? null : (
          <ChannelTabs {...channelLens} />
        )
      }
    >
      {view === "matches" ? (
        <MatchGrid
          visible={matchLens.visible}
          locale={locale}
          groupBy={matchLens.groupBy}
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
