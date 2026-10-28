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
