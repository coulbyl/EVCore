import { classForTargetOddsMin, formatMoney } from '@evcore/analysis-core';
import type { CouponResult } from '@evcore/db';
import {
  sumSlipMoney,
  type SlipMoney,
} from '@modules/bet-slip/bet-slip-outcome';

export type SlipDigestMessage = {
  title: string;
  body: string;
  settled: number;
  net: string;
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
};

/** Noms courts des produits, comme sur l'Accueil. */
export const PRODUCT_SHORT_LABEL: Readonly<Record<string, string>> = {
  FAVOURITE: 'Favori',
  COMBO: 'Combiné',
  DOUBLE: 'Coupon cote 2',
  HUNTER_BTTS: 'Chasseur BTTS',
  HUNTER_DRAW: 'Chasseur Nul',
  HUNTER_SCORE: 'Chasseur Score',
};

/** Raisons d'abstention, mêmes mots que l'écran (couponAbstentions). */
const ABSTENTION_REASON: Readonly<Record<string, string>> = {
  no_home_favourite_in_band: 'aucun favori à domicile entre 1,20 et 1,35',
  not_enough_calibrated_short_legs:
    'pas assez de paris fiables à cote courte, dans des championnats différents',
  no_priced_candidate: 'pas assez de paris cotés chez 1xBet dans la bande',
  no_combination_in_window: 'aucune combinaison entre 2 et 3',
  no_candidate_in_band: 'aucun pari dans sa bande de cote',
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

function plural(count: number, one: string, other: string): string {
  return `${count} ${count > 1 ? other : one}`;
}

/**
 * Le résumé du matin d'un joueur, ou null s'il n'a aucun coupon réglé. Une
 * perte s'écrit comme un gain : mêmes mots, aucun « Bravo », et aucun appel
 * à rejouer (décision du 2026-10-28).
 */
export function composeSlipDigest(
  results: readonly SlipMoney[],
  currency: string | null,
  follows: readonly FollowedResult[] = [],
): SlipDigestMessage | null {
  const totals = sumSlipMoney(results);
  if (totals.settledSlips === 0 && follows.length === 0) return null;
  const count = (status: SlipMoney['status']) =>
    results.filter((r) => r.status === status).length;
  const pending = totals.pendingSlips;
  const { settledStake: staked, returned, net } = totals;

  const sentences: string[] = [];
  if (totals.settledSlips > 0) {
    const outcomes = [
      plural(count('WON'), 'gagné', 'gagnés'),
      plural(count('LOST'), 'perdu', 'perdus'),
      ...(count('VOID') > 0
        ? [plural(count('VOID'), 'remboursé', 'remboursés')]
        : []),
    ].join(', ');
    sentences.push(
      `${plural(totals.settledSlips, 'coupon réglé', 'coupons réglés')} : ${outcomes}.`,
      `Misé ${formatMoney(staked.toString(), { currency })}, rendu ${formatMoney(returned.toString(), { currency })} : ${formatMoney(net.toString(), { currency, signed: true })}.`,
    );
    if (pending > 0) {
      sentences.push(
        `${plural(pending, 'coupon encore en attente', 'coupons encore en attente')}.`,
      );
    }
  }
  // Suivre sans mise : le résultat seulement, aucun montant.
  if (follows.length > 0) sentences.push(followedSentence(follows));

  return {
    title: 'Tes coupons réglés',
    body: sentences.join(' '),
    settled: totals.settledSlips,
    net: net.toFixed(2),
  };
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
 * La matinée d'un joueur (2026-10-29) : ses résultats d'hier s'il en a, puis
 * les coupons du jour (ou pourquoi un produit manque). Null s'il n'y a rien
 * à dire. Même ton que le résumé : une perte s'écrit comme un gain, aucun
 * appel à jouer.
 */
export function composeMorningBrief(input: {
  results: readonly SlipMoney[];
  currency: string | null;
  follows: readonly FollowedResult[];
  coupons: readonly MorningCoupon[];
  abstentions: readonly MorningAbstention[];
}): SlipDigestMessage | null {
  const digest = composeSlipDigest(
    input.results,
    input.currency,
    input.follows,
  );
  const sentences: string[] = digest ? [digest.body] : [];
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
  return {
    title: 'Ta matinée EVCore',
    body: sentences.join(' '),
    settled: digest?.settled ?? 0,
    net: digest?.net ?? '0.00',
  };
}

/** Bilan d'un produit public sur la semaine (findClassTrackRecord). */
export type WeeklyProduct = {
  couponClass: string;
  won: number;
  settled: number;
};

/**
 * Le relevé du lundi (2026-10-29) : la semaine passée du joueur (coupons
 * déclarés, coupons suivis) et celle de nos produits, jours gagnés sur jours
 * joués. Une semaine en perte reçoit une phrase de jeu responsable, jamais
 * un appel à se refaire. Null s'il n'y a rien à dire.
 */
export function composeWeeklyStatement(input: {
  results: readonly SlipMoney[];
  currency: string | null;
  follows: readonly FollowedResult[];
  products: readonly WeeklyProduct[];
}): SlipDigestMessage | null {
  const { currency } = input;
  const totals = sumSlipMoney(input.results);
  const sentences: string[] = [];
  if (totals.settledSlips > 0) {
    const won = input.results.filter((r) => r.status === 'WON').length;
    sentences.push(
      `Tes coupons : ${plural(won, 'gagné', 'gagnés')} sur ${plural(totals.settledSlips, 'réglé', 'réglés')}. Misé ${formatMoney(totals.settledStake.toString(), { currency })}, rendu ${formatMoney(totals.returned.toString(), { currency })} : ${formatMoney(totals.net.toString(), { currency, signed: true })}.`,
    );
  }
  // Réglé après l'envoi : le coupon arrive dans une matinée suivante, et le
  // relevé le dit plutôt que de l'omettre des totaux sans un mot.
  if (totals.pendingSlips > 0) {
    sentences.push(
      `${plural(totals.pendingSlips, 'coupon de la semaine encore en attente', 'coupons de la semaine encore en attente')} : le résultat arrivera dans ta matinée.`,
    );
  }
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
  if (totals.net.isNegative()) {
    sentences.push(
      'Semaine en perte : garde tes mises dans ce que tu avais prévu. Une pause est possible depuis Compte, si tu en as besoin.',
    );
  }
  return {
    title: 'Ta semaine EVCore',
    body: sentences.join(' '),
    settled: totals.settledSlips,
    net: totals.net.toFixed(2),
  };
}
