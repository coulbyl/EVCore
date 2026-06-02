"use client";

import { useState } from "react";
import { BarChart2, ShieldCheck, Target, Ticket } from "lucide-react";
import {
  Page,
  PageHeader,
  PageHeaderActions,
  PageContent,
  Skeleton,
  Button,
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
import { InvestmentIndicesDrawer } from "@/components/investment-indices-drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { CANAL_ORDER, VIRTUAL_CANAL_ORDER } from "./canal-constants";
import { CanalSection } from "./canal-section";
import { CouponCard } from "./coupon-card";
import { SkeletonSection } from "./skeleton-section";

export function InvestissementPageClient() {
  const today = todayIso();
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") ?? today;
  const [indicesOpen, setIndicesOpen] = useState(false);
  const locale = useLocale();
  const isMobile = useIsMobile();
  const { data, isLoading, isError } = useInvestment(date);

  const hasAnyPicks =
    data && CANAL_ORDER.some((c) => (data.selections[c]?.length ?? 0) > 0);
  const hasAnyVirtualPicks =
    data &&
    VIRTUAL_CANAL_ORDER.some(
      (c) => (data.virtualSelections?.[c]?.length ?? 0) > 0,
    );

  function navigateTo(iso: string) {
    const params = new URLSearchParams({ date: iso });
    router.push(`/dashboard/investment?${params.toString()}`);
  }

  return (
    <Page className="flex h-full flex-col">
      <PageHeader>
        <div />
        <PageHeaderActions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIndicesOpen(true)}
            className="h-7 gap-1.5 text-xs"
          >
            <BarChart2 size={12} />
            Indice de paris
          </Button>
          <DateNav date={date} onChange={navigateTo} />
          {data && !data.isAiCurated && (
            <span className="text-xs text-muted-foreground">
              Sélection automatique
            </span>
          )}
        </PageHeaderActions>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-hidden rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col gap-5">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-8 pb-6">
              {/* ── Top picks ─────────────────────────────────────────────── */}
              <section className="flex flex-col gap-6">
                <div>
                  <h2 className="text-base font-semibold">Top picks</h2>
                  <p className="text-sm text-muted-foreground">
                    Les sélections sont regroupées par stratégie pour réduire le
                    bruit et accélérer la lecture.
                  </p>
                </div>

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
                  <div className="flex flex-col gap-7">
                    {CANAL_ORDER.map((canal) => (
                      <CanalSection
                        key={canal}
                        canal={canal}
                        picks={data.selections[canal] ?? []}
                        locale={locale}
                      />
                    ))}
                  </div>
                )}
              </section>

              {data && hasAnyVirtualPicks && (
                <section className="flex flex-col gap-6">
                  <div>
                    <h2 className="text-base font-semibold">Canaux virtuels</h2>
                  </div>

                  <div className="flex flex-col gap-7">
                    {VIRTUAL_CANAL_ORDER.map((canal) => (
                      <CanalSection
                        key={canal}
                        canal={canal}
                        picks={data.virtualSelections[canal] ?? []}
                        locale={locale}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Coupons du jour ───────────────────────────────────────── */}
              <section className="flex flex-col gap-4">
                <div>
                  <h2 className="text-base font-semibold">Coupons du jour</h2>
                  <p className="text-sm text-muted-foreground">
                    Combinaisons prêtes à lire avec cote, proba jointe et détail
                    de chaque jambe.
                  </p>
                </div>

                {isLoading && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-72 rounded-[1.45rem]" />
                    ))}
                  </div>
                )}

                {data && data.coupons.length === 0 && !isLoading && (
                  <Empty className="rounded-[1.6rem] border-border bg-background/20">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Ticket className="size-5" />
                      </EmptyMedia>
                      <EmptyTitle>Aucun coupon composé</EmptyTitle>
                      <EmptyDescription>
                        Aucune combinaison n&apos;est proposée pour cette date.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}

                {data && data.coupons.length > 0 && (
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
                )}
              </section>
            </div>
          </div>
        </div>
      </PageContent>

      <InvestmentIndicesDrawer
        open={indicesOpen}
        onClose={() => setIndicesOpen(false)}
        isMobile={isMobile}
      />
    </Page>
  );
}
