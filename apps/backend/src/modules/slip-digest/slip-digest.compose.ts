import Decimal from 'decimal.js';
import type { SlipMoney } from '@modules/bet-slip/bet-slip-outcome';

export type SlipDigestMessage = {
  title: string;
  body: string;
  settled: number;
  net: string;
};

const SYMBOL: Record<string, string> = { XOF: 'F', EUR: '€', USD: '$' };

/** Montant au format de l'app : franc CFA sans centimes, signe si demandé. */
export function formatMoney(
  value: Decimal,
  currency: string | null,
  signed = false,
): string {
  const code = currency ?? 'XOF';
  const digits = code === 'XOF' ? 0 : 2;
  const rounded = value.toDecimalPlaces(digits);
  const abs = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(rounded.abs().toNumber());
  const sign =
    rounded.isNegative() && !rounded.isZero()
      ? '-'
      : signed && rounded.greaterThan(0)
        ? '+'
        : '';
  const symbol = SYMBOL[code] ?? code;
  return code === 'USD'
    ? `${sign}${symbol}${abs}`
    : `${sign}${abs}\u00A0${symbol}`;
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
): SlipDigestMessage | null {
  const settled = results.filter((r) => r.status !== 'PENDING');
  if (settled.length === 0) return null;
  const count = (status: SlipMoney['status']) =>
    settled.filter((r) => r.status === status).length;
  const pending = results.length - settled.length;
  const staked = settled.reduce(
    (acc, r) => acc.plus(r.settledStake),
    new Decimal(0),
  );
  const returned = settled.reduce(
    (acc, r) => acc.plus(r.returned),
    new Decimal(0),
  );
  const net = returned.minus(staked);

  const outcomes = [
    plural(count('WON'), 'gagné', 'gagnés'),
    plural(count('LOST'), 'perdu', 'perdus'),
    ...(count('VOID') > 0
      ? [plural(count('VOID'), 'remboursé', 'remboursés')]
      : []),
  ].join(', ');
  const body =
    `${plural(settled.length, 'coupon réglé', 'coupons réglés')} : ${outcomes}. ` +
    `Misé ${formatMoney(staked, currency)}, rendu ${formatMoney(returned, currency)} : ${formatMoney(net, currency, true)}.` +
    (pending > 0
      ? ` ${plural(pending, 'coupon encore en attente', 'coupons encore en attente')}.`
      : '');

  return {
    title: "Tes coupons d'hier",
    body,
    settled: settled.length,
    net: net.toFixed(2),
  };
}
