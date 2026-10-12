import type { CouponSource } from "@/domains/coupon/types/coupon";

export type CouponSourceMeta = {
  label: string;
  /** Infobulle : dit ce qui distingue réellement les deux générateurs. */
  hint: string;
};

/**
 * Les deux générateurs tournent en parallèle sur la MÊME cible de cote (5–15).
 * Sans distinction visible, l'utilisateur voit deux coupons du jour sans savoir
 * qu'ils viennent de deux méthodes opposées — et nous ne pourrions pas
 * interpréter ce qu'il choisit de jouer.
 */
export const COUPON_SOURCE_META: Record<CouponSource, CouponSourceMeta> = {
  LLM: {
    label: "Analyse IA",
    hint: "Sélection par analyse contextuelle : le moteur estime une probabilité par match, puis la confronte à la cote.",
  },
  ENGINE: {
    label: "Sélections du moteur",
    hint: "Les sélections mises en avant sur l'écran Décisions (canal fiable sur la compétition, cote courte), combinées une par championnat, les moins chères d'abord.",
  },
  PRICE_COMPOSER: {
    label: "Choisi sur les cotes",
    hint: "Sélection par le prix : aucune prédiction de match. Les jambes sont classées sur le coût réellement mesuré de chaque marché.",
  },
};

export function couponSourceMeta(source: CouponSource): CouponSourceMeta {
  return COUPON_SOURCE_META[source];
}
