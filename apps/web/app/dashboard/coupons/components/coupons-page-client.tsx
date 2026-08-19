"use client";

import { Loader2, Trophy } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Page, PageHeader, PageHeaderActions, PageContent } from "@evcore/ui";
import { useTranslations, useLocale } from "next-intl";
import { useCoupons } from "@/domains/coupon/use-cases/use-coupons";
import { useCouponCelebration } from "@/hooks/use-coupon-celebration";
import { todayIso, formatDayLabel } from "@/lib/date";
import { DateNav } from "@/components/date-nav";
import { FormationHelpLink } from "@/components/formation-help-link";
import { CouponCard } from "./coupon-card";
import type { CouponProposalDto } from "@/domains/coupon/types/coupon";

// findByDate (backend) returns every coupon batch whose fixture window
// OVERLAPS the requested day, not just batches actually generated for it —
// a weekend/midweek batch generated on forDate=D1 with a multi-day window
// still shows up when viewing D2. Each batch ranks itself independently
// (rank 1 = "Meilleur" within its own generation), so two batches sharing
// the viewed day each contribute their own rank 1 — grouping by forDate
// (and labeling the group) is what tells them apart instead of rendering
// two unlabeled "Meilleur · Coupon 1" cards side by side.
function groupByForDate(
  coupons: CouponProposalDto[],
): { forDate: string; coupons: CouponProposalDto[] }[] {
  const byDate = new Map<string, CouponProposalDto[]>();
  for (const coupon of coupons) {
    const key = coupon.forDate.slice(0, 10);
    const arr = byDate.get(key) ?? [];
    arr.push(coupon);
    byDate.set(key, arr);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([forDate, group]) => ({
      forDate,
      coupons: group.slice().sort((a, b) => a.rank - b.rank),
    }));
}

export function CouponsPageClient() {
  const t = useTranslations("coupons");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const date = searchParams.get("date") ?? todayIso();
  const { data, isLoading, isError } = useCoupons(date);

  const coupons = data ?? [];
  useCouponCelebration(coupons);
  const groups = groupByForDate(coupons);

  function navigateTo(iso: string) {
    const params = new URLSearchParams({ date: iso });
    router.push(`/dashboard/coupons?${params.toString()}`);
  }

  return (
    <Page className="flex h-full flex-col">
      <PageHeader>
        <div />
        <PageHeaderActions className="w-full lg:w-auto">
          <DateNav
            date={date}
            onChange={navigateTo}
            className="w-full lg:w-auto"
          />
          <FormationHelpLink
            slug="channels-overview"
            label={t("helpLink")}
            tourId="coupons-help"
          />
        </PageHeaderActions>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 size={22} className="animate-spin" />
              </div>
            )}

            {isError && !isLoading && (
              <div className="rounded-[1.2rem] border border-dashed border-border bg-panel/70 p-8 text-center text-sm text-muted-foreground">
                {t("loadError")}
              </div>
            )}

            {!isLoading && !isError && coupons.length === 0 && (
              <div className="flex flex-col items-center gap-4 rounded-[1.2rem] border border-dashed border-border bg-panel/70 px-8 py-16 text-center">
                <Trophy size={36} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              </div>
            )}

            {!isLoading && !isError && coupons.length > 0 && (
              <div className="flex flex-col gap-4 pb-4">
                {groups.map((group) => (
                  <div key={group.forDate} className="flex flex-col gap-2">
                    {groups.length > 1 && (
                      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {formatDayLabel(group.forDate)}
                      </p>
                    )}
                    <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {group.coupons.map((coupon) => (
                        <CouponCard
                          key={coupon.id}
                          coupon={coupon}
                          locale={locale}
                          isTop={coupon.rank === 1}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
