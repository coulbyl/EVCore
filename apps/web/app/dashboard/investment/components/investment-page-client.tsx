"use client";

import { ShieldCheck, Target, Ticket } from "lucide-react";
import {
  Page,
  PageHeader,
  PageHeaderActions,
  PageContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@evcore/ui";
import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useInvestment } from "@/domains/ai-engine/use-cases/use-investment";
import { todayIso } from "@/lib/date";
import { DateNav } from "@/components/date-nav";
import { IndicesDrawerButton } from "@/components/indices-drawer-button";
import { CANAL_ORDER, VIRTUAL_CANAL_ORDER } from "./canal-constants";
import { HighlightsSection } from "./highlights-section";
import { StrategyTabs } from "./strategy-tabs";
import { CouponCard } from "./coupon-card";
import { SkeletonSection } from "./skeleton-section";

export function InvestissementPageClient() {
  const today = todayIso();
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") ?? today;
  const locale = useLocale();
  const { data, isLoading, isError } = useInvestment(date);
  const hasLoadedWithoutPayload = !isLoading && !isError && !data;

  const hasAnyPicks =
    data &&
    (CANAL_ORDER.some((c) => (data.selections[c]?.length ?? 0) > 0) ||
      VIRTUAL_CANAL_ORDER.some(
        (c) => (data.virtualSelections?.[c]?.length ?? 0) > 0,
      ));

  function navigateTo(iso: string) {
    const params = new URLSearchParams({ date: iso });
    router.push(`/dashboard/investment?${params.toString()}`);
  }

  return (
    <Page className="flex h-full flex-col">
      <PageHeader>
        <div />
        <PageHeaderActions>
          <IndicesDrawerButton />
          <DateNav date={date} onChange={navigateTo} />
        </PageHeaderActions>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-hidden rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col gap-5">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-8 pb-6">
              {/* Context bar */}
              {data && (
                <p className="text-xs text-muted-foreground">
                  {data.totalCandidates} candidats analysés &middot;{" "}
                  {data.windowDays}j de fenêtre &middot;{" "}
                  {data.isAiCurated ? "Sélection IA" : "Sélection automatique"}
                </p>
              )}

              {isLoading && (
                <div className="flex flex-col gap-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonSection key={i} />
                  ))}
                </div>
              )}

              {isError && (
                <Empty className="rounded-[1.6rem] border-border bg-background/20">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ShieldCheck className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle>Chargement impossible</EmptyTitle>
                    <EmptyDescription>
                      Erreur de chargement. Réessayez plus tard.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}

              {hasLoadedWithoutPayload && (
                <Empty className="rounded-[1.6rem] border-border bg-background/20">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Target className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle>Aucune donnée disponible</EmptyTitle>
                    <EmptyDescription>
                      Le moteur n&apos;a retourné aucune projection pour cette
                      date.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}

              {data && !hasAnyPicks && (
                <Empty className="rounded-[1.6rem] border-border bg-background/20">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Target className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle>Aucun pick éligible</EmptyTitle>
                    <EmptyDescription>
                      Le moteur n&apos;a pas retenu de sélection exploitable
                      pour cette date.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}

              {data && hasAnyPicks && (
                <>
                  <HighlightsSection
                    top5={data.virtualTop5}
                    top10={data.virtualTop10}
                    locale={locale}
                  />

                  <StrategyTabs selections={data.selections} locale={locale} />

                  {data.coupons.length > 0 && (
                    <section className="flex flex-col gap-4">
                      <div>
                        <h2 className="text-base font-semibold">
                          Coupons du jour
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Combinaisons prêtes à lire avec cote, proba jointe et
                          détail de chaque jambe.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {data.coupons.map((coupon) => (
                          <CouponCard
                            key={coupon.rank}
                            coupon={coupon}
                            locale={locale}
                            isTop={coupon.rank === 1}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {data.coupons.length === 0 && (
                    <Empty className="rounded-[1.6rem] border-border bg-background/20">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Ticket className="size-5" />
                        </EmptyMedia>
                        <EmptyTitle>Aucun coupon composé</EmptyTitle>
                        <EmptyDescription>
                          Aucune combinaison n&apos;est proposée pour cette
                          date.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
