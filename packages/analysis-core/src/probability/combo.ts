// Conditions mapping pick names → score predicates. Shared by the settlement
// resolvers (resolvePickBetStatus, resolveFirstHalfBetStatus) to check a
// single-market pick against a final/half-time score.
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
  "1X": (h, a) => h >= a,
  X2: (h, a) => a >= h,
  "12": (h, a) => h !== a,
};
