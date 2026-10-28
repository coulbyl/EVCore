"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Scale, Target } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
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
import { formatDateLong, todayIso } from "@/lib/date";
import {
  useChannelDecisionFacets,
  useChannelDecisionMatches,
} from "@/domains/channel-decision/use-cases/use-channel-decisions";
import { useChannelCompetitionStats } from "@/domains/dashboard/use-cases/get-channel-health";
import { dateRangeForPeriod } from "@/app/dashboard/track-record/track-record-constants";
import { LeagueFilterBar } from "../../decisions/components/league-filter-bar";
import { buildCalibrationByKey } from "../../decisions/components/channel-constants";
import { ArbitrageCard } from "./arbitrage-card";
import { AiTrackRecordStrip } from "./ai-track-record-strip";
import { VerdictFilterBar } from "./verdict-filter-bar";
import {
  flattenArbitrageEntries,
  matchesFilter,
  type ArbitrageFilter,
} from "./arbitrage-constants";

export function ArbitragePageClient() {
  const today = todayIso();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("arbitrage");

  const date = searchParams.get("date") ?? today;
  // Ouvre sur les avis proposés : ce sont eux que le joueur vient lire. Le
  // compte du jour en tête dit combien de matchs ont été lus sans avis.
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

  // Plus de badge de fiabilité sur les cartes : cette calibration ne sert
  // qu'à retrouver « Notre sélection » du match par la même règle que
  // Décisions (primaryPick).
  const calibrationRange = dateRangeForPeriod("90");
  const calibrationStats = useChannelCompetitionStats(
    calibrationRange.from,
    calibrationRange.to,
  );
  const calibrationByKey = useMemo(
    () => buildCalibrationByKey(calibrationStats.data ?? []),
    [calibrationStats.data],
  );

  const allEntries = useMemo(
    () => flattenArbitrageEntries(matches.data ?? [], calibrationByKey),
    [matches.data, calibrationByKey],
  );

  // À venir d'abord ; les matchs terminés à part, repliés : un match fini en
  // tête de liste passait avant ceux qu'on peut encore jouer (revue UX du
  // 2026-10-27, P2-6).
  const { upcoming, finished } = useMemo(() => {
    const sorted = allEntries
      .filter((e) => matchesFilter(e, filter))
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
    return {
      upcoming: sorted.filter((e) => e.fixtureStatus !== "FINISHED"),
      finished: sorted.filter((e) => e.fixtureStatus === "FINISHED"),
    };
  }, [allEntries, filter]);
  const [showFinished, setShowFinished] = useState(false);
  const visibleCount = upcoming.length + finished.length;
  const plays = allEntries.filter((e) => e.status === "SELECTED").length;

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
      {/* Titre et une phrase qui dit ce que fait vraiment l'IA : l'écran
          promettait la rareté (« ne propose un pari que s'il repère un vrai
          désaccord ») alors qu'elle proposait un pari sur 8 matchs lus sur 10
          (revue UX du 2026-10-27, P1-1). */}
      <div
        data-tour="arbitrage-help"
        className="mb-3 flex shrink-0 flex-col gap-1"
      >
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <InfoTooltip label={t("title")} description={t("description")} />
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("intro")}
        </p>
      </div>

      <PageHeader>
        <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-3">
          {hasLeagueFacets && (
            <LeagueFilterBar
              options={leagueOptions}
              selected={selectedLeague}
              onSelect={(code) => navigate({ league: code })}
            />
          )}
          <VerdictFilterBar
            value={filter}
            onSelect={(v) => navigate({ filter: v })}
            label={t("filters.label")}
            options={[
              { value: "all", label: t("filters.all") },
              { value: "play", label: t("filters.play") },
              { value: "no_play", label: t("filters.noPlay") },
            ]}
          />
        </div>
        <PageHeaderActions className="w-full lg:w-auto">
          <DateNav
            date={date}
            onChange={(iso) => navigate({ date: iso })}
            className="flex-1"
          />
        </PageHeaderActions>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 pb-20">
          <AiTrackRecordStrip />

          {!isLoading && !matches.isError && hasData && (
            <p
              data-testid="ai-today-count"
              className="text-sm text-muted-foreground"
            >
              {t("today", {
                day: date === today ? t("todayLabel") : formatDateLong(date),
                plays,
                reads: allEntries.length,
                abstentions: allEntries.length - plays,
              })}
            </p>
          )}

          {isLoading && (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
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
                <EmptyTitle>{t("loadError")}</EmptyTitle>
                <EmptyDescription>
                  <Button
                    variant="outline"
                    onClick={() => void matches.refetch()}
                  >
                    {t("retry")}
                  </Button>
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {!isLoading && !matches.isError && visibleCount === 0 && (
            <Empty className="rounded-[1.6rem] border-border bg-background/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Scale className="size-5" />
                </EmptyMedia>
                <EmptyTitle>
                  {hasData ? t("emptyFilteredTitle") : t("emptyTitle")}
                </EmptyTitle>
                <EmptyDescription>
                  {hasData
                    ? t("emptyFilteredDescription")
                    : t("emptyDescription")}
                </EmptyDescription>
                {hasData && filter !== "all" && (
                  <Button
                    variant="outline"
                    onClick={() => navigate({ filter: "all" })}
                  >
                    {t("showAll")}
                  </Button>
                )}
              </EmptyHeader>
            </Empty>
          )}

          {!isLoading && !matches.isError && upcoming.length > 0 && (
            <div className="flex flex-col gap-4">
              {upcoming.map((entry) => (
                <ArbitrageCard key={entry.id} entry={entry} locale={locale} />
              ))}
            </div>
          )}

          {!isLoading && !matches.isError && finished.length > 0 && (
            <section className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setShowFinished((v) => !v)}
                className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-border bg-panel px-4 text-sm font-medium text-foreground"
              >
                {t("finished", { count: finished.length })}
                {showFinished ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>
              {showFinished &&
                finished.map((entry) => (
                  <ArbitrageCard key={entry.id} entry={entry} locale={locale} />
                ))}
            </section>
          )}
        </div>
      </PageContent>
    </Page>
  );
}
