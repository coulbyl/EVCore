import { classForTargetOddsMin } from '@evcore/analysis-core';
import type { CouponResult } from '@evcore/db';

export type SlipDigestMessage = {
  title: string;
  body: string;
};

/** Un coupon suivi (« Suivre ce coupon ») et son résultat. */
export type FollowedResult = {
  targetOddsMin: number;
  result: CouponResult;
};

// Libellés des produits, comme sur l'écran (COUPON_CLASS_META du web).
const FOLLOWED_LABEL: Record<string, string> = {
  FAVOURITE: 'Favori du jour',
  COMBO: 'Combiné du jour',
  DOUBLE: 'Coupon cote 2',
  LONG: 'Coupon long',
  HUNTER_BTTS: 'Chasseur Les deux marquent',
  HUNTER_DRAW: 'Chasseur Match nul',
  HUNTER_SCORE: 'Chasseur Score exact',
  HUNTER_CORNERS: 'Chasseur Corners',
};

/** Noms courts des produits, comme sur l'Accueil. */
export const PRODUCT_SHORT_LABEL: Readonly<Record<string, string>> = {
  FAVOURITE: 'Favori',
  COMBO: 'Combiné',
  DOUBLE: 'Coupon cote 2',
  HUNTER_BTTS: 'Chasseur BTTS',
  HUNTER_DRAW: 'Chasseur Nul',
  HUNTER_SCORE: 'Chasseur Score',
  HUNTER_CORNERS: 'Chasseur Corners',
};

/** Raisons d'abstention, mêmes mots que l'écran (couponAbstentions). */
const ABSTENTION_REASON: Readonly<Record<string, string>> = {
  no_home_favourite_in_band: 'aucun favori à domicile entre 1,20 et 1,35',
  not_enough_calibrated_short_legs:
    'pas assez de paris fiables à cote courte, dans des championnats différents',
  no_priced_candidate: 'pas assez de paris cotés dans la bande',
  no_combination_in_window: 'aucune combinaison entre 2 et 3',
  no_candidate_in_band: 'aucun pari dans sa bande de cote',
  no_reliable_competition:
    'aucun championnat dont les stats de corners arrivent à coup sûr',
  no_operator_price: 'aucun corner coté',
};

const FOLLOWED_OUTCOME: Record<CouponResult, string> = {
  WON: 'gagné',
  // Gagné sur toutes ses jambes jouées, l'une remboursée.
  PARTIAL: 'gagné',
  LOST: 'perdu',
  VOID: 'remboursé',
};

function followedSentence(follows: readonly FollowedResult[]): string {
  const parts = follows.map((f) => {
    const name = classForTargetOddsMin(f.targetOddsMin);
    const label = (name && FOLLOWED_LABEL[name]) ?? 'Coupon';
    return `${label} ${FOLLOWED_OUTCOME[f.result]}`;
  });
  return `${follows.length > 1 ? 'Coupons suivis' : 'Coupon suivi'} : ${parts.join(', ')}.`;
}

export type MorningCoupon = { couponClass: string; odds: number };
export type MorningAbstention = { couponClass: string; reason: string | null };

function formatOdds(odds: number): string {
  return odds.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * La matinée d'un joueur (2026-10-29) : ses coupons suivis réglés s'il en a,
 * puis les coupons du jour (ou pourquoi un produit manque). Null s'il n'y a
 * rien à dire. Une perte s'écrit comme un gain, aucun appel à jouer, et
 * aucun montant : les coupons déclarés avec mise ont disparu (2026-10-31).
 */
export function composeMorningBrief(input: {
  follows: readonly FollowedResult[];
  coupons: readonly MorningCoupon[];
  abstentions: readonly MorningAbstention[];
}): SlipDigestMessage | null {
  const sentences: string[] =
    input.follows.length > 0 ? [followedSentence(input.follows)] : [];
  if (input.coupons.length > 0) {
    const list = input.coupons
      .map(
        (c) =>
          `${PRODUCT_SHORT_LABEL[c.couponClass] ?? 'Coupon'} ${formatOdds(c.odds)}`,
      )
      .join(' · ');
    sentences.push(`Coupons du jour : ${list}.`);
  }
  for (const abstention of input.abstentions) {
    const label = PRODUCT_SHORT_LABEL[abstention.couponClass];
    if (!label) continue;
    const reason =
      (abstention.reason ? ABSTENTION_REASON[abstention.reason] : undefined) ??
      'pas de pari qui tienne la règle ce jour-là';
    sentences.push(`Pas de ${label} aujourd'hui : ${reason}.`);
  }
  if (sentences.length === 0) return null;
  return { title: 'Ta matinée EVCore', body: sentences.join(' ') };
}

/** Bilan d'un produit public sur la semaine (findClassTrackRecord). */
export type WeeklyProduct = {
  couponClass: string;
  won: number;
  settled: number;
};

/**
 * Le relevé du lundi (2026-10-29) : les coupons suivis du joueur sur la
 * semaine passée et nos produits, jours gagnés sur jours joués. Null s'il
 * n'y a rien à dire.
 */
export function composeWeeklyStatement(input: {
  follows: readonly FollowedResult[];
  products: readonly WeeklyProduct[];
}): SlipDigestMessage | null {
  const sentences: string[] = [];
  if (input.follows.length > 0) {
    const won = input.follows.filter(
      (f) => f.result === 'WON' || f.result === 'PARTIAL',
    ).length;
    sentences.push(
      `Coupons suivis : ${won} gagné${won > 1 ? 's' : ''} sur ${input.follows.length}.`,
    );
  }
  const products = input.products.filter(
    (p) => p.settled > 0 && PRODUCT_SHORT_LABEL[p.couponClass],
  );
  if (products.length > 0) {
    const list = products
      .map(
        (p) =>
          `${PRODUCT_SHORT_LABEL[p.couponClass]} ${p.won} jour${p.won > 1 ? 's' : ''} gagné${p.won > 1 ? 's' : ''} sur ${p.settled}`,
      )
      .join(' · ');
    sentences.push(`Nos coupons : ${list}.`);
  }
  if (sentences.length === 0) return null;
  return { title: 'Ta semaine EVCore', body: sentences.join(' ') };
}
