import Decimal from 'decimal.js';
import { Market } from '../types';

export type ComboPick = {
  market1: Market;
  pick1: string;
  market2: Market;
  pick2: string;
};

// Conditions mapping pick names → score predicates.
// Used by computeJointProbability and the settlement resolvers.
export const PICK_CONDITIONS: Record<
  string,
  (h: number, a: number) => boolean
> = {
  HOME: (h, a) => h > a,
  DRAW: (h, a) => h === a,
  AWAY: (h, a) => h < a,
  OVER_0_5: (h, a) => h + a > 0,
  UNDER_0_5: (h, a) => h + a === 0,
  OVER_1_5: (h, a) => h + a > 1,
  UNDER_1_5: (h, a) => h + a <= 1,
  OVER: (h, a) => h + a > 2,
  UNDER: (h, a) => h + a <= 2,
  OVER_3_5: (h, a) => h + a > 3,
  UNDER_3_5: (h, a) => h + a <= 3,
  OVER_4_5: (h, a) => h + a > 4,
  UNDER_4_5: (h, a) => h + a <= 4,
  YES: (h, a) => h >= 1 && a >= 1, // BTTS YES
  NO: (h, a) => h === 0 || a === 0, // BTTS NO
  '1X': (h, a) => h >= a,
  X2: (h, a) => a >= h,
  '12': (h, a) => h !== a,
};

// Joint probability over all goal-score combinations (h, a) satisfying both pick conditions.
// Assumes goal independence between home and away (standard Poisson model).
export function computeJointProbability(
  combo: ComboPick,
  distHome: number[],
  distAway: number[],
): Decimal {
  let joint = 0;
  const cond1 = PICK_CONDITIONS[combo.pick1];
  const cond2 = PICK_CONDITIONS[combo.pick2];
  for (let h = 0; h < distHome.length; h++) {
    for (let a = 0; a < distAway.length; a++) {
      if (cond1?.(h, a) && cond2?.(h, a)) {
        joint += (distHome[h] ?? 0) * (distAway[a] ?? 0);
      }
    }
  }
  return new Decimal(joint);
}
