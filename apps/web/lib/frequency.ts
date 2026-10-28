/**
 * Une probabilité en fréquence (PRODUCT.md : « une fois sur N ») : sous 50 %,
 * « 1 sur N » ; au-dessus, « k sur 10 », plafonné à 9 pour ne jamais écrire
 * « 10 sur 10 ». Partagé par la carte coupon et Décisions, pour qu'un même
 * pourcentage se lise pareil sur les deux écrans.
 */
export function frequencyOf(probability: number): {
  count: number;
  total: number;
} {
  if (probability < 0.5) {
    return {
      count: 1,
      total: Math.max(2, Math.round(1 / Math.max(probability, 0.01))),
    };
  }
  return { count: Math.min(9, Math.round(probability * 10)), total: 10 };
}

/** 1,52 au format de la langue : virgule en français. */
export function formatOddsValue(odds: number, locale: string): string {
  return odds.toLocaleString(locale === "en" ? "en-GB" : "fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
