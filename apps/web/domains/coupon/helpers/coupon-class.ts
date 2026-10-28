import type { CouponClassName } from "@/domains/coupon/types/coupon";

// Historical categories remain readable. Regenerated historical win rates are not prospective evidence.
export type CouponClassMeta = {
  label: string;
  /** Nom court, sans « du jour » ni bande de cote : pour « Hier », les listes. */
  shortLabel: string;
  /** Fréquence de gain mesurée, formulée en « 1 sur N » — lisible sans stats. */
  frequency: string;
  /** Ordre d'affichage : du plus fréquent au plus rare. */
  order: number;
  badgeVariant: "success" | "accent" | "warning";
};

export const COUPON_CLASS_META: Record<CouponClassName, CouponClassMeta> = {
  // Le favori du jour : une jambe, favori à domicile à cote 1,20–1,35.
  // Renommé le 2026-10-24 (« Pari sûr du jour ») : « sûr » est une promesse
  // que la mesure ne tient pas (une perte sur cinq) et que les règles de
  // rédaction interdisent (apps/web/PRODUCT.md).
  // 84,8 % de jours gagnants sur 731 jours (docs/audits/2026-09-15/
  // GENERATOR.md), 80 % en prospectif sur 80 jours aux cotes d'analyse
  // (docs/audits/2026-10-12/MESURES-DECISIONS-COUPONS.md). Premier à l'écran :
  // c'est celui qu'un utilisateur lambda peut suivre sans se décourager.
  FAVOURITE: {
    label: "Favori du jour · cote 1,20–1,35",
    shortLabel: "Favori",
    frequency: "Gagne environ 4 jours sur 5",
    order: -2,
    badgeVariant: "success",
  },
  // Le combiné du jour : trois « Notre sélection » de Décisions, une par
  // championnat, les moins chères d'abord. 78 % de jours gagnants sur 87
  // jours, cote 1,4, pire série 3 (docs/audits/2026-10-12/
  // MESURES-DECISIONS-COUPONS.md §5).
  // 2026-10-18 : deux jambes à cote 1,20 ou plus (71 % de jours gagnants
  // mesurés, cote 1,55), pour que chaque jambe existe chez 1xBet au-dessus
  // de son minimum de 1,10 (docs/audits/2026-10-18/COTES-JOUABLES.md).
  COMBO: {
    // Sans nombre de jambes : la carte les montre, et un libellé figé à
    // « 2 sélections » deviendrait faux au premier combiné à 3.
    label: "Combiné du jour",
    shortLabel: "Combiné",
    frequency: "Gagne environ 7 jours sur 10",
    order: -1.5,
    badgeVariant: "accent",
  },
  // Le coupon cote 2 (2026-10-28) : deux jambes de cote combinée 2 à 3 chez
  // 1xBet, prises parmi tout ce qui est coté et classées par la probabilité
  // du marché sans marge. Rejoué sur 115 jours : un coupon 114 jours, 44 %
  // annoncés, 48 % ± 9 réalisés (docs/audits/2026-10-28/
  // SELECTIONS-LAISSEES.md). « Environ 1 jour sur 2 », jamais le 48 %.
  DOUBLE: {
    label: "Coupon cote 2",
    shortLabel: "Cote 2",
    frequency: "Gagne environ 1 jour sur 2",
    order: -1.25,
    badgeVariant: "accent",
  },
  // Le coupon long (2026-10-18) : cible 2,5, plafond 5, jambes de 1,20 à 1,80
  // les plus longues d'abord, sur les mêmes sélections calibrées. 34 % de
  // jours gagnants mesurés à cote 3,0, pire série 8 jours
  // (docs/audits/2026-10-18/COTES-JOUABLES.md §6).
  LONG: {
    label: "Coupon long · cote 2,5–5",
    shortLabel: "Coupon long",
    frequency: "Gagne environ 1 jour sur 3",
    order: -1,
    badgeVariant: "warning",
  },
  // L'ancien coupon 5–15 du compositeur par le prix : toujours généré et
  // mesuré, plus affiché depuis le 2026-10-18 (un jour sur sept).
  // Le coupon long : à cote 5–15, gagner plus d'un jour sur cinq est
  // arithmétiquement impossible (P ≤ 1 / cote). Mesuré : 13 à 20 % de jours
  // gagnants. Le dire sur la carte évite de le lire comme « le même produit
  // en mieux ».
  UNIQUE: {
    label: "Coupon prix · cote 5–15",
    shortLabel: "Coupon prix",
    frequency: "Gagne environ 1 jour sur 7",
    order: 0,
    badgeVariant: "warning",
  },
  SAFE: {
    label: "Cote courte",
    shortLabel: "Cote courte",
    frequency: "Historique ancien",
    order: 0,
    badgeVariant: "success",
  },
  BALANCED: {
    label: "Cote moyenne",
    shortLabel: "Cote moyenne",
    frequency: "Historique ancien",
    order: 1,
    badgeVariant: "accent",
  },
  BOLD: {
    label: "Cote longue",
    shortLabel: "Cote longue",
    frequency: "Historique ancien",
    order: 2,
    badgeVariant: "warning",
  },
  // Chasseurs (2026-10-28) : une sélection par jour sur un seul marché, ou
  // rien. Fréquences du rejeu de 116 jours et du marché sans marge
  // (docs/audits/2026-10-28/HUNTERS.md) ; mesurés en direct, jambe par
  // jambe. La pire série se lit sur la carte.
  HUNTER_BTTS: {
    label: "Chasseur Les deux marquent · cote 1,45–1,90",
    shortLabel: "Chasseur BTTS",
    frequency: "Gagne environ 3 fois sur 5",
    order: 1,
    badgeVariant: "accent",
  },
  HUNTER_DRAW: {
    label: "Chasseur Match nul · cote 2,90–3,60",
    shortLabel: "Chasseur Nul",
    frequency: "Gagne environ 1 fois sur 3",
    order: 2,
    badgeVariant: "warning",
  },
  HUNTER_SCORE: {
    label: "Chasseur Score exact · cote 5–12",
    shortLabel: "Chasseur Score",
    frequency: "Gagne environ 1 fois sur 9",
    order: 3,
    badgeVariant: "warning",
  },
  // Lot 6 (2026-10-29) : le marché des corners est calibré (49,9 % annoncés
  // pour 49,9 % réalisés sur 1 564 matchs) et 1xBet y prend environ 9,5 % :
  // un pari de variété, classé sur le coût, jamais un avantage.
  HUNTER_CORNERS: {
    label: "Chasseur Corners · cote 1,70–2,10",
    shortLabel: "Chasseur Corners",
    frequency: "Gagne environ 1 fois sur 2",
    order: 4,
    badgeVariant: "accent",
  },
};

export function couponClassMeta(
  name: CouponClassName | null,
): CouponClassMeta | null {
  return name ? COUPON_CLASS_META[name] : null;
}
