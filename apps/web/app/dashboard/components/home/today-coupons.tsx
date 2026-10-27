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
import type {
  CouponClassName,
  CouponProposalDto,
} from "@/domains/coupon/types/coupon";
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

  // L'accueil montre deux cartes au plus : le favori et le combiné du moteur,
  // un de chaque. Le coupon long (2,5–5, perd deux jours sur trois), le
  // combiné « Analyse IA » (même vivier, mesuré jambe à jambe) et le 5–15 du
  // compositeur par le prix vivent sur la page Coupons ; le coupon long y est
  // signalé par une seule ligne (revue UX du 2026-10-24, P1 n°2 : le filtre
  // laissait passer la classe LONG créée le 2026-10-18).
  const all = data ?? [];
  const coupons = pickHomeCoupons(all);
  const longCoupon =
    all.find((c) => c.couponClass === "LONG" && c.source !== "LLM") ??
    all.find((c) => c.couponClass === "LONG") ??
    null;

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
          {t("couponTitle", { date: formatDayLabel(date, locale) })}
        </h2>
        <Link
          href={`/dashboard/coupons?date=${date}`}
          className="-my-3 flex min-h-11 items-center gap-1 text-xs font-medium text-accent hover:text-accent/80"
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

      {!isLoading && !isError && longCoupon && (
        <Link
          href={`/dashboard/coupons?date=${date}`}
          data-testid="home-long-coupon-link"
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-panel px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
        >
          <span>
            {t("longCouponLink", {
              odds: longCoupon.combinedOdds.toFixed(2),
            })}
          </span>
          <ArrowRight size={14} className="shrink-0" />
        </Link>
      )}
    </section>
  );
}

/**
 * « 2026-10-24 » → « ven. 24 oct. » : le titre dit de quel jour il s'agit
 * (revue UX du 2026-10-24, P1 n°4 : aucune date sur la page).
 */
function formatDayLabel(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)));
}

/** Classes affichées en tête de l'accueil, dans cet ordre. */
const HOME_CLASSES: readonly CouponClassName[] = ["FAVOURITE", "COMBO"];

/**
 * Une carte par classe d'accueil, la mieux classée, hors source LLM : un
 * second batch « intraday » de la même classe reste sur la page Coupons.
 */
function pickHomeCoupons(
  coupons: readonly CouponProposalDto[],
): CouponProposalDto[] {
  const picked: CouponProposalDto[] = [];
  for (const couponClass of HOME_CLASSES) {
    const best = coupons
      .filter((c) => c.couponClass === couponClass && c.source !== "LLM")
      .sort((a, b) => a.rank - b.rank)[0];
    if (best) picked.push(best);
  }
  return picked;
}
