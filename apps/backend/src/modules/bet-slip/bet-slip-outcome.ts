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

export type Play = { status: BetStatus; odds: Decimal | null };

/**
 * Issue d'un combiné, selon les règles ci-dessus. Une seule règle pour
 * l'écran, le résultat à mise fixe et le crédit du solde : avant le
 * 2026-10-27, le règlement ne créditait que les combinés entièrement
 * gagnés, et une jambe remboursée faisait perdre la mise.
 */
export function combineLegs(items: PlayedSlip['items']): Play {
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
      ? [combineLegs(slip.items)]
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

/**
 * Résultat en francs d'un coupon joué, avec les mises déclarées : la même
 * règle que le crédit du solde au règlement (`combineLegs`), pour que la
 * carte, le détail et le solde disent la même chose.
 *
 * Un pari remboursé rend sa mise : il est réglé, à résultat nul. Un gain
 * sans cote connue ne peut pas être chiffré : compté comme gagné, mais sa
 * mise reste hors des montants réglés plutôt que d'afficher une perte
 * (même règle que `fixedStakeOutcome`).
 */
export type MoneySlip = {
  type: 'SIMPLE' | 'COMBO';
  unitStake: Decimal;
  items: readonly { status: BetStatus; odds: Decimal | null; stake: Decimal }[];
};

export type SlipMoney = {
  status: 'WON' | 'LOST' | 'VOID' | 'PENDING';
  staked: Decimal;
  /** Mises des paris réglés, remboursés compris. */
  settledStake: Decimal;
  /** Montant rendu par les paris réglés, mise comprise. */
  returned: Decimal;
  /** Rendu − mises réglées. */
  net: Decimal;
  /** Mises encore en jeu. */
  pendingStake: Decimal;
  /** Montant rendu si tout ce qui est en jeu passe, mise comprise. */
  potentialReturn: Decimal;
};

const ZERO = new Decimal(0);

function comboMoney(slip: MoneySlip): SlipMoney {
  const stake = slip.unitStake;
  const combo = combineLegs(slip.items);
  const base = {
    staked: stake,
    settledStake: ZERO,
    returned: ZERO,
    net: ZERO,
    pendingStake: ZERO,
    potentialReturn: ZERO,
  };
  if (combo.status === 'PENDING') {
    // Ce que rendrait le combiné si les jambes en attente passent : les
    // jambes remboursées comptent pour 1, celles déjà gagnées gardent leur cote.
    const odds = slip.items.reduce(
      (acc, item) =>
        item.status === 'VOID' || item.odds === null
          ? acc
          : acc.times(item.odds),
      new Decimal(1),
    );
    return {
      ...base,
      status: 'PENDING',
      pendingStake: stake,
      potentialReturn: stake.times(odds),
    };
  }
  if (combo.status === 'WON' && combo.odds === null) {
    return { ...base, status: 'WON' };
  }
  const returned =
    combo.status === 'WON' && combo.odds !== null
      ? stake.times(combo.odds)
      : combo.status === 'VOID'
        ? stake
        : ZERO;
  return {
    ...base,
    status: combo.status,
    settledStake: stake,
    returned,
    net: returned.minus(stake),
  };
}

function simplesMoney(slip: MoneySlip): SlipMoney {
  let staked = ZERO;
  let settledStake = ZERO;
  let returned = ZERO;
  let pendingStake = ZERO;
  let potentialReturn = ZERO;
  let lost = 0;
  let won = 0;
  for (const item of slip.items) {
    staked = staked.plus(item.stake);
    if (item.status === 'PENDING') {
      pendingStake = pendingStake.plus(item.stake);
      if (item.odds !== null) {
        potentialReturn = potentialReturn.plus(item.stake.times(item.odds));
      }
      continue;
    }
    if (item.status === 'WON') {
      won += 1;
      if (item.odds === null) continue;
      returned = returned.plus(item.stake.times(item.odds));
    } else if (item.status === 'VOID') {
      returned = returned.plus(item.stake);
    } else if (item.status === 'LOST') {
      lost += 1;
    }
    settledStake = settledStake.plus(item.stake);
  }
  const net = returned.minus(settledStake);
  const status: SlipMoney['status'] = pendingStake.greaterThan(0)
    ? 'PENDING'
    : won === 0 && lost === 0
      ? 'VOID'
      : lost === 0
        ? 'WON'
        : won === 0
          ? 'LOST'
          : net.greaterThan(0)
            ? 'WON'
            : 'LOST';
  return {
    status,
    staked,
    settledStake,
    returned,
    net,
    pendingStake,
    potentialReturn,
  };
}

export function slipMoney(slip: MoneySlip): SlipMoney {
  return slip.type === 'COMBO' && slip.items.length >= 2
    ? comboMoney(slip)
    : simplesMoney(slip);
}

export type SlipMoneyTotals = {
  settledSlips: number;
  pendingSlips: number;
  /** Mises des coupons entièrement réglés. */
  settledStake: Decimal;
  returned: Decimal;
  net: Decimal;
  /** Mises entières des coupons encore en attente. */
  pendingStake: Decimal;
};

/**
 * Totaux d'une liste de coupons : les montants réglés ne viennent que des
 * coupons entièrement réglés, pour que « N coupons réglés, misé X, rendu Y »
 * parle des mêmes coupons. La jambe déjà perdue d'un coupon simple encore en
 * attente y entre quand le coupon est réglé ; le solde, lui, la compte déjà.
 */
export function sumSlipMoney(results: readonly SlipMoney[]): SlipMoneyTotals {
  return results.reduce<SlipMoneyTotals>(
    (acc, result) => {
      if (result.status === 'PENDING') {
        return {
          ...acc,
          pendingSlips: acc.pendingSlips + 1,
          pendingStake: acc.pendingStake.plus(result.staked),
        };
      }
      return {
        ...acc,
        settledSlips: acc.settledSlips + 1,
        settledStake: acc.settledStake.plus(result.settledStake),
        returned: acc.returned.plus(result.returned),
        net: acc.net.plus(result.net),
      };
    },
    {
      settledSlips: 0,
      pendingSlips: 0,
      settledStake: ZERO,
      returned: ZERO,
      net: ZERO,
      pendingStake: ZERO,
    },
  );
}
