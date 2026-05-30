"use client";

import { Loader2, Trophy } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Page,
  PageHeader,
  PageHeaderActions,
  PageContent,
} from "@evcore/ui";
import { useTranslations, useLocale } from "next-intl";
import { useCoupons } from "@/domains/ai-engine/use-cases/use-coupons";
import { useCouponCelebration } from "@/hooks/use-coupon-celebration";
import { todayIso } from "@/lib/date";
import { DateNav } from "@/components/date-nav";
import { CouponCard } from "./coupon-card";

export function CouponsPageClient() {
  const t = useTranslations("coupons");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const date = searchParams.get("date") ?? todayIso();
  const { data, isLoading, isError } = useCoupons(date);

  const coupons = data ?? [];
  useCouponCelebration(coupons);

  function navigateTo(iso: string) {
    const params = new URLSearchParams({ date: iso });
    router.push(`/dashboard/coupons?${params.toString()}`);
  }

  return (
    <Page className="flex h-full flex-col">
      <PageHeader>
        <div />
        <PageHeaderActions>
          <DateNav date={date} onChange={navigateTo} />
        </PageHeaderActions>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-hidden rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col gap-5">
          <p className="shrink-0 text-[0.72rem] text-muted-foreground">
            {t("aiNote")}
          </p>

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
              <div className="grid grid-cols-1 items-stretch gap-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
                {coupons.map((coupon) => (
                  <CouponCard
                    key={coupon.id}
                    coupon={coupon}
                    locale={locale}
                    isTop={coupon.rank === 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
