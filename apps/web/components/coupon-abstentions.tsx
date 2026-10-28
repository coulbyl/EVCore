"use client";

import { useTranslations } from "next-intl";
import { useCouponAbstentions } from "@/domains/coupon/use-cases/use-coupons";
import { couponClassMeta } from "@/domains/coupon/helpers/coupon-class";
import type { CouponClassName } from "@/domains/coupon/types/coupon";

const KNOWN_REASONS = new Set([
  "no_home_favourite_in_band",
  "not_enough_calibrated_short_legs",
  "no_priced_candidate",
  "no_combination_in_window",
  "no_candidate_in_band",
  "no_reliable_competition",
  "no_operator_price",
]);

/**
 * « Pas de Coupon cote 2 aujourd'hui : aucune combinaison entre 2 et 3. »
 * S'abstenir est un résultat (PRODUCT.md, principe 4) : chaque produit absent
 * dit pourquoi, au lieu d'un texte fixe (2026-10-29).
 */
export function CouponAbstentions({ date }: { date: string }) {
  const t = useTranslations("couponAbstentions");
  const { data } = useCouponAbstentions(date);
  if (!data || data.length === 0) return null;
  return (
    <ul
      data-testid="coupon-abstentions"
      className="flex flex-col gap-1.5 text-xs leading-5 text-muted-foreground"
    >
      {data.map((abstention) => {
        const meta = couponClassMeta(abstention.couponClass as CouponClassName);
        const reason =
          abstention.reason && KNOWN_REASONS.has(abstention.reason)
            ? abstention.reason
            : "other";
        return (
          <li key={abstention.couponClass}>
            {t("line", {
              product: meta?.shortLabel ?? abstention.couponClass,
              reason: t(`reasons.${reason}`),
            })}
          </li>
        );
      })}
    </ul>
  );
}
