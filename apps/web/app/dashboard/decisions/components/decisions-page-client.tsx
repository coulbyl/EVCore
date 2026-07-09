"use client";

import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useChannelDecisionChannels,
  useChannelDecisionMatches,
} from "@/domains/channel-decision/use-cases/use-channel-decisions";
import { todayIso } from "@/lib/date";
import { DecisionsPageFrame } from "./decisions-page-frame";
import type { DecisionsView } from "./lens-toggle";
import { MatchFilters, MatchGrid, useMatchLens } from "./match-lens";
import { ChannelTabs, ChannelList, useChannelLens } from "./channel-lens";

// Single decisions surface: one route, two lenses (by match / by channel)
// toggled in-page. Date and view both live in the URL so the view survives a
// refresh and stays shareable, without a second page.
export function DecisionsPageClient() {
  const today = todayIso();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();

  const date = searchParams.get("date") ?? today;
  const view: DecisionsView =
    searchParams.get("view") === "channels" ? "channels" : "matches";

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

  // Hooks stay unconditional (rules of hooks); the inactive lens just runs over
  // an empty list. Each lens pins its own bar (filters / tabs) in the sub-header.
  const matchLens = useMatchLens(matches.data ?? []);
  const channelLens = useChannelLens(channels.data ?? []);

  function navigate(next: { date?: string; view?: DecisionsView }) {
    const params = new URLSearchParams({
      date: next.date ?? date,
      view: next.view ?? view,
    });
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
      subHeaderMobileHidden={view === "matches"}
      subHeader={
        !hasData ? null : view === "matches" ? (
          <MatchFilters {...matchLens} />
        ) : (
          <ChannelTabs {...channelLens} />
        )
      }
    >
      {view === "matches" ? (
        <MatchGrid visible={matchLens.visible} locale={locale} />
      ) : (
        <ChannelList activeGroup={channelLens.activeGroup} locale={locale} />
      )}
    </DecisionsPageFrame>
  );
}
