import type { CouponClassName } from "@/domains/coupon/types/coupon";

// Historical categories remain readable. Regenerated historical win rates are not prospective evidence.
export type CouponClassMeta = {
  label: string;
  /** Fréquence de gain mesurée, formulée en « 1 sur N » — lisible sans stats. */
  frequency: string;
  /** Ordre d'affichage : du plus fréquent au plus rare. */
  order: number;
  badgeVariant: "success" | "accent" | "warning";
};

export const COUPON_CLASS_META: Record<CouponClassName, CouponClassMeta> = {
  UNIQUE: {
    label: "Coupon du jour · cote 5–15",
    frequency: "Performance en cours de mesure",
    order: -1,
    badgeVariant: "accent",
  },
  SAFE: {
    label: "Cote courte",
    frequency: "Historique ancien",
    order: 0,
    badgeVariant: "success",
  },
  BALANCED: {
    label: "Cote moyenne",
    frequency: "Historique ancien",
    order: 1,
    badgeVariant: "accent",
  },
  BOLD: {
    label: "Cote longue",
    frequency: "Historique ancien",
    order: 2,
    badgeVariant: "warning",
  },
};

export function couponClassMeta(
  name: CouponClassName | null,
): CouponClassMeta | null {
  return name ? COUPON_CLASS_META[name] : null;
}
