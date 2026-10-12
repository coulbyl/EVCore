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
  // Le pari sûr du jour : une jambe, favori à domicile à cote 1,10–1,35.
  // 84,8 % de jours gagnants sur 731 jours (docs/audits/2026-09-15/
  // GENERATOR.md), 80 % en prospectif sur 80 jours aux cotes d'analyse
  // (docs/audits/2026-10-12/MESURES-DECISIONS-COUPONS.md). Premier à l'écran :
  // c'est celui qu'un utilisateur lambda peut suivre sans se décourager.
  FAVOURITE: {
    label: "Pari sûr du jour · cote 1,10–1,35",
    frequency: "Gagne environ 4 jours sur 5",
    order: -2,
    badgeVariant: "success",
  },
  // Le coupon long : à cote 5–15, gagner plus d'un jour sur cinq est
  // arithmétiquement impossible (P ≤ 1 / cote). Mesuré : 13 à 20 % de jours
  // gagnants. Le dire sur la carte évite de le lire comme « le même produit
  // en mieux ».
  UNIQUE: {
    label: "Coupon long · cote 5–15",
    frequency: "Gagne environ 1 jour sur 7",
    order: -1,
    badgeVariant: "warning",
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
