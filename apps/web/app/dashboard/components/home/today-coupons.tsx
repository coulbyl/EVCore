"use client";

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Skeleton } from "@evcore/ui";
import { useCoupons } from "@/domains/coupon/use-cases/use-coupons";
import { couponClassMeta } from "@/domains/coupon/helpers/coupon-class";
import { useCouponCelebration } from "@/hooks/use-coupon-celebration";
import { todayIso } from "@/lib/date";
import { CouponCard } from "@/app/dashboard/coupons/components/coupon-card";

/**
 * Le coupon du jour, en tête de l'accueil : c'est la raison d'être du
 * produit, et il n'y figurait pas (revue UX du 2026-10-11, P0-3). Deux
 * sources le même jour (Analyse, Prix) : deux cartes, chacune avec son
 * étiquette. Aucun coupon : une phrase honnête, l'abstention est un résultat.
 */
export function TodayCoupons() {
  const t = useTranslations("dashboard.home");
  const locale = useLocale();
  const date = todayIso();
  const { data, isLoading, isError } = useCoupons(date);

  const coupons = (data ?? []).slice().sort((a, b) => {
    const oa = couponClassMeta(a.couponClass)?.order ?? 99;
    const ob = couponClassMeta(b.couponClass)?.order ?? 99;
    return oa !== ob ? oa - ob : a.rank - b.rank;
  });
  useCouponCelebration(coupons);

  return (
    <section
      data-tour="home-coupon"
      className="flex flex-col gap-3"
      aria-labelledby="home-coupon-title"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="home-coupon-title"
          className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          {t("couponTitle")}
        </h2>
        <Link
          href={`/dashboard/coupons?date=${date}`}
          className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80"
        >
          {t("couponsLink")} <ArrowRight size={12} />
        </Link>
      </div>

      {isLoading && <Skeleton className="h-72 rounded-2xl" />}

      {isError && !isLoading && (
        <p className="rounded-2xl border border-dashed border-border bg-panel/70 p-6 text-center text-sm text-muted-foreground">
          {t("couponError")}
        </p>
      )}

      {!isLoading && !isError && coupons.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-panel/70 px-6 py-10 text-center">
          <Trophy size={28} className="text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">
            {t("couponEmptyTitle")}
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {t("couponEmptyBody")}
          </p>
        </div>
      )}

      {!isLoading && !isError && coupons.length > 0 && (
        <div
          className={
            coupons.length > 1
              ? "grid grid-cols-1 gap-4 xl:grid-cols-2"
              : "grid grid-cols-1 gap-4"
          }
        >
          {coupons.map((coupon) => (
            <CouponCard key={coupon.id} coupon={coupon} locale={locale} />
          ))}
        </div>
      )}
    </section>
  );
}
