"use client";

import { Fragment, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Page,
  PageHeader,
  PageHeaderActions,
  PageContent,
  Skeleton,
} from "@evcore/ui";
import { useTranslations, useLocale } from "next-intl";
import { useInvestmentPicks } from "@/domains/investment/use-cases/use-investment-picks";
import {
  INVESTMENT_VIEWS,
  type InvestmentChannel,
  type InvestmentView,
} from "@/domains/investment/types/investment";
import { todayIso } from "@/lib/date";
import { DateNav } from "@/components/date-nav";
import { FormationHelpLink } from "@/components/formation-help-link";
import { FiltersPopover } from "@/components/filters-popover";
import { groupByCompetition } from "@/lib/group-by-competition";
import { translateCountry } from "@/lib/competition-i18n";
import { GroupBySelect, type GroupByMode } from "@/components/group-by-select";
import {
  CHANNEL_FILTER_ORDER,
  groupPicksByFixture,
} from "./investment-constants";
import { InvestmentChannelFilter } from "./investment-channel-filter";
import { InvestmentFixtureCard } from "./investment-fixture-card";
import { InvestmentViewToggle } from "./investment-view-toggle";

// Le canal n'est filtrable que sur les surfaces de revue : « Ce qu'on
// assume » est défini par la mesure (ROI shrinké recalculé côté serveur), pas
// par un choix d'affichage.
const CHANNEL_FILTERABLE_VIEWS: InvestmentView[] = ["watch", "excluded"];

export function InvestmentPageClient() {
  const t = useTranslations("investment");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [groupBy, setGroupBy] = useState<GroupByMode>("none");

  const date = searchParams.get("date") ?? todayIso();
  const viewParam = searchParams.get("view");
  const view: InvestmentView = INVESTMENT_VIEWS.includes(
    viewParam as InvestmentView,
  )
    ? (viewParam as InvestmentView)
    : "assumed";
  const channelParam = searchParams.get("channel");
  const channel: InvestmentChannel | null =
    CHANNEL_FILTERABLE_VIEWS.includes(view) &&
    CHANNEL_FILTER_ORDER.includes(channelParam as InvestmentChannel)
      ? (channelParam as InvestmentChannel)
      : null;

  const {
    data,
    isLoading: isFirstLoading,
    isFetching,
    isError,
  } = useInvestmentPicks({ date, view, channel });
  // isLoading alone only covers the very first fetch of a queryKey —
  // revisiting a date/view/channel combo whose cache has gone stale re-fetches
  // silently (isFetching true, isLoading false), leaving the previous filter's
  // picks on screen with no feedback that new data is loading.
  const isLoading = isFirstLoading || isFetching;

  const picks = data ?? [];
  const fixtureGroups = groupPicksByFixture(picks);
  const canFilterByChannel = CHANNEL_FILTERABLE_VIEWS.includes(view);

  // next.channel : undefined = inchangé, null = tous canaux.
  function navigateTo(next: {
    date?: string;
    view?: InvestmentView;
    channel?: InvestmentChannel | null;
  }) {
    const nextView = next.view ?? view;
    const params = new URLSearchParams({
      date: next.date ?? date,
      view: nextView,
    });
    const nextChannel = next.channel === undefined ? channel : next.channel;
    if (nextChannel !== null && CHANNEL_FILTERABLE_VIEWS.includes(nextView)) {
      params.set("channel", nextChannel);
    }
    router.push(`/dashboard/investment?${params.toString()}`);
  }

  return (
    <Page className="flex h-full flex-col">
      <PageHeader>
        <InvestmentViewToggle
          view={view}
          onChange={(next) => navigateTo({ view: next })}
        />
        <PageHeaderActions className="w-full lg:w-auto">
          <FiltersPopover
            label={t("filtersLabel")}
            active={groupBy !== "none" || channel !== null}
          >
            <GroupBySelect
              value={groupBy}
              onChange={setGroupBy}
              labels={{
                none: t("groupByNone"),
                league: t("groupByLeague"),
              }}
              className="w-full"
            />
            {canFilterByChannel && (
              <InvestmentChannelFilter
                channel={channel}
                onChange={(next) => navigateTo({ channel: next })}
              />
            )}
          </FiltersPopover>
          <DateNav
            date={date}
            onChange={(iso) => navigateTo({ date: iso })}
            className="flex-1"
          />
          <FormationHelpLink
            slug="ev-probabilites-cotes"
            label={t("helpLink")}
            tourId="investment-help"
          />
        </PageHeaderActions>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col gap-5">
          <p className="shrink-0 text-[0.72rem] text-muted-foreground">
            {t(`views.${view}.subtitle`)}
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-2xl" />
                ))}
              </div>
            )}

            {isError && !isLoading && (
              <div className="rounded-[1.2rem] border border-dashed border-border bg-panel/70 p-8 text-center text-sm text-muted-foreground">
                {t("loadError")}
              </div>
            )}

            {!isLoading && !isError && picks.length === 0 && (
              <div className="flex flex-col items-center gap-4 rounded-[1.2rem] border border-dashed border-border bg-panel/70 px-8 py-16 text-center">
                <TrendingUp size={36} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {t(`views.${view}.empty`)}
                </p>
              </div>
            )}

            {!isLoading && !isError && picks.length > 0 && (
              <div className="columns-1 gap-4 pb-4 sm:columns-2 lg:columns-3">
                {groupBy === "none"
                  ? fixtureGroups.map((group) => (
                      <div
                        key={group.fixtureId}
                        className="mb-4 break-inside-avoid"
                      >
                        <InvestmentFixtureCard
                          group={group}
                          view={view}
                          locale={locale}
                        />
                      </div>
                    ))
                  : groupByCompetition(
                      fixtureGroups,
                      (g) => g.competition ?? "—",
                    ).map((competitionGroup) => (
                      <Fragment key={competitionGroup.key}>
                        <div className="mb-2 [column-span:all]">
                          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {competitionGroup.key}
                            {competitionGroup.items[0]?.country && (
                              <span className="ml-1.5 font-normal normal-case opacity-70">
                                ·{" "}
                                {translateCountry(
                                  competitionGroup.items[0].country,
                                  locale,
                                )}
                              </span>
                            )}
                            <span className="ml-1.5 font-normal opacity-60">
                              ({competitionGroup.items.length})
                            </span>
                          </h3>
                        </div>
                        {competitionGroup.items.map((group) => (
                          <div
                            key={group.fixtureId}
                            className="mb-4 break-inside-avoid"
                          >
                            <InvestmentFixtureCard
                              group={group}
                              view={view}
                              locale={locale}
                            />
                          </div>
                        ))}
                      </Fragment>
                    ))}
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
