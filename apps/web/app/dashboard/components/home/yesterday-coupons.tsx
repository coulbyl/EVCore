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
  // Le coupon 5–15 du compositeur par le prix n'est plus affiché nulle part
  // depuis le 2026-10-18 (toujours généré et mesuré).
  const coupons = (data ?? []).filter((c) => c.couponClass !== "UNIQUE");

  if (!isLoading && coupons.length === 0) return null;

  // Bilan d'une ligne au-dessus de la liste : « hier a-t-il gagné ? » se lit
  // sans compter (revue UX du 2026-10-24, P1 n°3).
  const tally = { won: 0, lost: 0, void: 0, pending: 0 };
  for (const coupon of coupons) {
    const key = resultKey(coupon.result);
    if (key === "won" || key === "partial") tally.won += 1;
    else if (key === "lost") tally.lost += 1;
    else if (key === "void") tally.void += 1;
    else tally.pending += 1;
  }
  const tallyLine = (
    [
      ["won", tally.won],
      ["lost", tally.lost],
      ["void", tally.void],
      ["pending", tally.pending],
    ] as const
  )
    .filter(([, count]) => count > 0)
    .map(([key, count]) => t(`yesterdayTally.${key}`, { count }))
    .join(" · ");

  // Deux coupons de la même classe (le coupon long sous deux générateurs) :
  // on ajoute la source, sinon les deux lignes sont indiscernables (P2-11).
  const classCount = new Map<string, number>();
  for (const coupon of coupons) {
    const k = coupon.couponClass ?? "";
    classCount.set(k, (classCount.get(k) ?? 0) + 1);
  }

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
        <p data-testid="yesterday-tally" className="text-sm text-foreground">
          {tallyLine}
        </p>
      )}
      {!isLoading && (
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
                    {/* Nom court de la classe (« Favori », « Coupon long ») :
                        « du jour » n'a pas sa place sous « Hier ». La source
                        ne sert que s'il n'y a pas de classe. */}
                    {couponClassMeta(coupon.couponClass)?.shortLabel ??
                      couponSourceMeta(coupon.source).label}
                    {couponClassMeta(coupon.couponClass) &&
                      (classCount.get(coupon.couponClass ?? "") ?? 0) > 1 && (
                        <span className="text-muted-foreground">
                          {" · "}
                          {couponSourceMeta(coupon.source).label}
                        </span>
                      )}
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
