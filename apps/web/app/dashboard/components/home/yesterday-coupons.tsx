"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn, Skeleton } from "@evcore/ui";
import { useCoupons } from "@/domains/coupon/use-cases/use-coupons";
import { couponClassMeta } from "@/domains/coupon/helpers/coupon-class";
import { couponSourceMeta } from "@/domains/coupon/helpers/coupon-source";
import { daysAgoIso } from "@/lib/date";
import type { CouponProposalDto } from "@/domains/coupon/types/coupon";

function resultKey(
  result: CouponProposalDto["result"],
): "won" | "partial" | "lost" | "void" | "pending" {
  if (result === "WON") return "won";
  if (result === "PARTIAL") return "partial";
  if (result === "LOST") return "lost";
  if (result === "VOID") return "void";
  return "pending";
}

/**
 * Hier : une ligne par coupon de la veille, son issue et la cote payée.
 * Vert pour un gain, gris pour le reste — jamais de rouge plein, un coupon
 * perdu n'appelle aucune action. Le bloc disparaît quand il n'y a rien.
 */
export function YesterdayCoupons() {
  const t = useTranslations("dashboard.home");
  const date = daysAgoIso(1);
  const { data, isLoading } = useCoupons(date);
  const coupons = data ?? [];

  if (!isLoading && coupons.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="home-yesterday">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="home-yesterday"
          className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          {t("yesterdayTitle")}
        </h2>
        <Link
          href={`/dashboard/coupons?date=${date}`}
          className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80"
        >
          {t("yesterdayLink")} <ArrowRight size={12} />
        </Link>
      </div>
      {isLoading ? (
        <Skeleton className="h-16 rounded-2xl" />
      ) : (
        <ul className="flex flex-col gap-2">
          {coupons.map((coupon) => {
            const key = resultKey(coupon.result);
            const won = key === "won" || key === "partial";
            const paid =
              coupon.realizedOdds !== null &&
              Math.abs(coupon.realizedOdds - coupon.combinedOdds) > 0.005;
            return (
              <li
                key={coupon.id}
                data-testid="yesterday-coupon"
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-panel px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {/* La classe (« Pari sûr du jour », « Coupon long »)
                        dit ce que c'était ; la source ne sert que s'il n'y
                        a pas de classe. */}
                    {couponClassMeta(coupon.couponClass)?.label.split(
                      " · ",
                    )[0] ?? couponSourceMeta(coupon.source).label}
                    <span className="text-muted-foreground">
                      {" · "}
                      {t("legs", { count: coupon.legs.length })}
                    </span>
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    @{coupon.combinedOdds.toFixed(2)}
                    {paid && coupon.realizedOdds !== null && (
                      <>
                        {" · "}
                        {t("paid", {
                          odds: coupon.realizedOdds.toFixed(2),
                        })}
                      </>
                    )}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide",
                    won
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {t(`result.${key}`)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
