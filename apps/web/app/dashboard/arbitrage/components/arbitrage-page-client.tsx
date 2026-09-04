"use client";

import { useMemo } from "react";
import { Scale, Target } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Page,
  PageContent,
  PageHeader,
  PageHeaderActions,
  Skeleton,
} from "@evcore/ui";
import { DateNav } from "@/components/date-nav";
import { InfoTooltip } from "@/components/info-tooltip";
import { ScrollableTabs } from "@/components/scrollable-tabs";
import { todayIso } from "@/lib/date";
import {
  useChannelDecisionFacets,
  useChannelDecisionMatches,
} from "@/domains/channel-decision/use-cases/use-channel-decisions";
import { LeagueFilterBar } from "../../decisions/components/league-filter-bar";
import { ArbitrageCard } from "./arbitrage-card";
import {
  flattenArbitrageEntries,
  matchesFilter,
  verdictOf,
  type ArbitrageFilter,
} from "./arbitrage-constants";

export function ArbitragePageClient() {
  const today = todayIso();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("arbitrage");

  const date = searchParams.get("date") ?? today;
  // Default to "play" — most reads are "no_play" (VANTAGE's own majority
  // outcome), so opening on "all" buries the handful of picks that actually
  // matter under a long list of "nothing to add" cards.
  const filter =
    (searchParams.get("filter") as ArbitrageFilter | null) ?? "play";
  const selectedLeague = searchParams.get("league");

  // Channel-unfiltered on purpose — every channel, not just VANTAGE — so
  // flattenArbitrageEntries can borrow a sibling channel's odds for the same
  // (market, pick) when VANTAGE's own selection (which never carries odds)
  // matches one exactly. `competition` IS pushed server-side though: it's
  // orthogonal to that (siblings live on the same fixture either way), and
  // asking the backend for just the selected league instead of fetching
  // every fixture and filtering in memory is the whole point of this pass.
  const matches = useChannelDecisionMatches(date, {
    competition: selectedLeague ? [selectedLeague] : undefined,
  });
  const isLoading = matches.isLoading || matches.isFetching;

  // Cheap and independent of the matches fetch above — see Decisions'
  // equivalent comment (decisions-page-client.tsx). Arbitrage only uses the
  // league half of the facets response (single-select bar, unchanged scope).
  const facets = useChannelDecisionFacets(date);
  const leagueOptions = facets.data?.leagues ?? [];
  const hasLeagueFacets = leagueOptions.length > 0;

  const allEntries = useMemo(
    () => flattenArbitrageEntries(matches.data ?? []),
    [matches.data],
  );

  const visibleEntries = useMemo(() => {
    return allEntries
      .filter((e) => matchesFilter(e, filter))
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
  }, [allEntries, filter]);

  const playCount = useMemo(
    () => allEntries.filter((e) => verdictOf(e) === "play").length,
    [allEntries],
  );

  function navigate(next: {
    date?: string;
    filter?: ArbitrageFilter;
    league?: string | null;
  }) {
    const params = new URLSearchParams({
      date: next.date ?? date,
      filter: next.filter ?? filter,
    });
    const nextLeague = next.league !== undefined ? next.league : selectedLeague;
    if (nextLeague) params.set("league", nextLeague);
    router.push(`/dashboard/arbitrage?${params.toString()}`);
  }

  const hasData = allEntries.length > 0;

  return (
    <Page className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2 shrink-0">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "var(--canal-vantage-soft)" }}
        >
          <Scale className="size-4" style={{ color: "var(--canal-vantage)" }} />
        </div>
        <h1 className="text-base font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <span
          className="rounded-md px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide"
          style={{
            backgroundColor: "var(--canal-vantage-soft)",
            color: "var(--canal-vantage)",
          }}
        >
          {t("badge")}
        </span>
        <InfoTooltip label={t("title")} description={t("description")} />
        {hasData && (
          <span className="ml-auto text-xs text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">
              {allEntries.length}
            </span>{" "}
            {t("stats.readsToday")}
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            <span
              className="font-semibold tabular-nums"
              style={{ color: "var(--canal-vantage)" }}
            >
              {playCount}
            </span>{" "}
            {t("stats.plays")}
          </span>
        )}
      </div>

      {hasLeagueFacets && (
        <div className="mb-3 shrink-0">
          <LeagueFilterBar
            options={leagueOptions}
            selected={selectedLeague}
            onSelect={(code) => navigate({ league: code })}
          />
        </div>
      )}

      <PageHeader>
        <ScrollableTabs
          value={filter}
          onValueChange={(v) => navigate({ filter: v as ArbitrageFilter })}
          items={[
            { value: "all", label: t("filters.all") },
            { value: "play", label: t("filters.play") },
            { value: "no_play", label: t("filters.noPlay") },
          ]}
        />
        <PageHeaderActions className="w-full lg:w-auto">
          <DateNav
            date={date}
            onChange={(iso) => navigate({ date: iso })}
            className="flex-1"
          />
        </PageHeaderActions>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="min-h-full">
          {isLoading && (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          )}

          {!isLoading && matches.isError && (
            <Empty className="rounded-[1.6rem] border-border bg-background/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Target className="size-5" />
                </EmptyMedia>
                <EmptyTitle>Chargement impossible</EmptyTitle>
                <EmptyDescription>
                  Erreur de chargement. Réessayez plus tard.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {!isLoading && !matches.isError && visibleEntries.length === 0 && (
            <Empty className="rounded-[1.6rem] border-border bg-background/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Scale className="size-5" />
                </EmptyMedia>
                {/* Default filter is "play", and most reads are "no_play" by
                    design — an empty filtered list here usually just means
                    "nothing worth flagging today", not "nothing was
                    analyzed". Distinct copy for the two cases so it doesn't
                    read as a broken page on an ordinary day. */}
                <EmptyTitle>
                  {hasData ? t("emptyFilteredTitle") : t("emptyTitle")}
                </EmptyTitle>
                <EmptyDescription>
                  {hasData
                    ? t("emptyFilteredDescription")
                    : t("emptyDescription")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {!isLoading && !matches.isError && visibleEntries.length > 0 && (
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              {visibleEntries.map((entry) => (
                <ArbitrageCard key={entry.id} entry={entry} locale={locale} />
              ))}
            </div>
          )}
        </div>
      </PageContent>
    </Page>
  );
}
