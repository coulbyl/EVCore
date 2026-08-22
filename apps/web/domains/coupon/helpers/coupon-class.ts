import type { CouponClassName } from "@/domains/coupon/types/coupon";

/**
 * Présentation des trois classes de coupon.
 *
 * Les libellés et les taux affichés viennent de la mesure réelle, pas d'une
 * promesse marketing (5 passes de régénération, 2025-01 → 2026-08, n=2844
 * coupons réglés) :
 *
 *   SAFE      n=803   cote 1.94   1 coupon gagnant sur 2
 *   BALANCED  n=1207  cote 5.39   1 sur 5
 *   BOLD      n=834   cote 12.26  1 sur 11
 *
 * Le taux de réussite est affiché AU MÊME NIVEAU que la cote, délibérément :
 * une classe à cote 12 n'est pas « la même en plus audacieux », elle gagne
 * quatre fois moins souvent qu'une classe à cote 2. Sans ce chiffre à côté,
 * la cote seule suggère le contraire.
 *
 * Les libellés sont DESCRIPTIFS (« Cote courte/moyenne/longue »), pas
 * qualificatifs. « Sûr » avait été essayé et retiré : à 49% de réussite, une
 * classe n'est pas sûre, et un badge en capitales qui l'affirme est à la fois
 * une promesse qu'on ne tient pas et une gêne à la lecture. Décrire le
 * produit laisse l'utilisateur juger ; le qualifier juge à sa place.
 */
export type CouponClassMeta = {
  label: string;
  /** Fréquence de gain mesurée, formulée en « 1 sur N » — lisible sans stats. */
  frequency: string;
  /** Ordre d'affichage : du plus fréquent au plus rare. */
  order: number;
  badgeVariant: "success" | "accent" | "warning";
};

export const COUPON_CLASS_META: Record<CouponClassName, CouponClassMeta> = {
  SAFE: {
    label: "Cote courte",
    frequency: "≈ 1 gagnant sur 2",
    order: 0,
    badgeVariant: "success",
  },
  BALANCED: {
    label: "Cote moyenne",
    frequency: "≈ 1 gagnant sur 5",
    order: 1,
    badgeVariant: "accent",
  },
  BOLD: {
    label: "Cote longue",
    frequency: "≈ 1 gagnant sur 11",
    order: 2,
    badgeVariant: "warning",
  },
};

export function couponClassMeta(
  name: CouponClassName | null,
): CouponClassMeta | null {
  return name ? COUPON_CLASS_META[name] : null;
}
