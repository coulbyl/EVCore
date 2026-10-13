"use client";

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Skeleton } from "@evcore/ui";
import { useCoupons } from "@/domains/coupon/use-cases/use-coupons";
import {
  trackRecordFor,
  useCouponTrackRecord,
} from "@/domains/coupon/use-cases/use-coupon-track-record";
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
  const { data: trackRecords } = useCouponTrackRecord();

  // Le coupon long (cote 5–15, un jour gagnant sur sept) reste sur la page
  // Coupons avec sa fréquence écrite dessus, mais pas en tête de l'accueil :
  // onze « Perdu » sur quatorze jours n'y disent rien d'utile (2026-10-12).
  // Le coupon long (cote 5–15, un jour sur sept) et le combiné « Analyse IA »
  // (même vivier que celui du moteur, mesuré jambe à jambe sur la page
  // Coupons) restent sur la page Coupons : l'accueil montre un pari sûr et
  // un combiné, pas deux combinés.
  const coupons = (data ?? [])
    .filter(
      (c) =>
        c.couponClass !== "UNIQUE" &&
        !(c.couponClass === "COMBO" && c.source === "LLM"),
    )
    .slice()
    .sort((a, b) => {
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
        <div className="grid grid-cols-1 gap-4">
          {/* Toujours une colonne : à deux cartes côte à côte dans la colonne
              principale, les noms d'équipes et la tuile « Chances » étaient
              tronqués à 1 280 px. */}
          {coupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              locale={locale}
              trackRecord={trackRecordFor(trackRecords, coupon)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
