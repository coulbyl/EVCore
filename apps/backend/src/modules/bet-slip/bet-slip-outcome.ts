import Decimal from 'decimal.js';
import type { BetStatus } from '@evcore/db';

/**
 * Résultat à mise fixe des paris joués par un utilisateur.
 *
 * L'unité est le pari tel que le joueur l'a placé : chaque jambe d'un coupon
 * SIMPLE est un pari, un coupon COMBO entier est un seul pari à la cote
 * produit de ses jambes. Mise d'une unité par pari, quelle que soit la mise
 * déclarée : c'est ce qui répond à « suis-je en gain ou en perte ? » sans
 * qu'un gros ticket isolé décide du signe.
 *
 * Règles d'un combiné : perdu dès qu'une jambe est perdue ; en attente tant
 * qu'une jambe l'est encore et qu'aucune n'est perdue ; une jambe remboursée
 * compte pour une cote de 1 ; remboursé si toutes le sont.
 */
export type PlayedSlip = {
  type: 'SIMPLE' | 'COMBO';
  items: readonly { status: BetStatus; odds: Decimal | null }[];
};

export type FixedStakeOutcome = {
  wonPlays: number;
  lostPlays: number;
  voidPlays: number;
  pendingPlays: number;
  /** Paris gagnés ou perdus (les remboursés ne comptent pas). */
  settledPlays: number;
  /** Gain net en unités sur les paris réglés. */
  profitUnits: Decimal;
  /** Gain net / paris réglés ; null sans pari réglé. */
  returnRate: Decimal | null;
};

type Play = { status: BetStatus; odds: Decimal | null };

function combine(items: PlayedSlip['items']): Play {
  if (items.some((i) => i.status === 'LOST')) {
    return { status: 'LOST', odds: null };
  }
  if (items.some((i) => i.status === 'PENDING')) {
    return { status: 'PENDING', odds: null };
  }
  const played = items.filter((i) => i.status === 'WON');
  if (played.length === 0) return { status: 'VOID', odds: null };
  if (played.some((i) => i.odds === null)) {
    return { status: 'WON', odds: null };
  }
  const odds = played.reduce(
    (acc, i) => acc.times(i.odds as Decimal),
    new Decimal(1),
  );
  return { status: 'WON', odds };
}

export function fixedStakeOutcome(
  slips: readonly PlayedSlip[],
): FixedStakeOutcome {
  const plays: Play[] = slips.flatMap((slip) =>
    slip.type === 'COMBO' && slip.items.length >= 2
      ? [combine(slip.items)]
      : slip.items.map((i) => ({ status: i.status, odds: i.odds })),
  );

  let wonPlays = 0;
  let lostPlays = 0;
  let voidPlays = 0;
  let pendingPlays = 0;
  let profit = new Decimal(0);
  let settledWithOdds = 0;

  for (const play of plays) {
    if (play.status === 'WON') {
      wonPlays += 1;
      // Un gain sans cote connue ne peut pas être chiffré : compté comme
      // gagné, exclu du résultat à mise fixe plutôt qu'inventé.
      if (play.odds !== null) {
        profit = profit.plus(play.odds.minus(1));
        settledWithOdds += 1;
      }
    } else if (play.status === 'LOST') {
      lostPlays += 1;
      profit = profit.minus(1);
      settledWithOdds += 1;
    } else if (play.status === 'VOID') {
      voidPlays += 1;
    } else {
      pendingPlays += 1;
    }
  }

  return {
    wonPlays,
    lostPlays,
    voidPlays,
    pendingPlays,
    settledPlays: wonPlays + lostPlays,
    profitUnits: profit,
    returnRate: settledWithOdds > 0 ? profit.dividedBy(settledWithOdds) : null,
  };
}
