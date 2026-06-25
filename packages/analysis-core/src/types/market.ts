// Betting markets supported by the engine.
//
// SOURCE OF TRUTH for the `Market` domain enum. The Prisma schema declares an
// enum with identical string values; a compile-time + runtime conformance test
// (apps/backend `domain-enums.conformance.spec.ts`) fails the build if the two
// ever diverge. analysis-core must never import this enum from Prisma — the
// domain owns it, the database persists it.
export const Market = {
  ONE_X_TWO: 'ONE_X_TWO',
  OVER_UNDER: 'OVER_UNDER',
  BTTS: 'BTTS',
  DOUBLE_CHANCE: 'DOUBLE_CHANCE',
  HALF_TIME_FULL_TIME: 'HALF_TIME_FULL_TIME',
  OVER_UNDER_HT: 'OVER_UNDER_HT',
  FIRST_HALF_WINNER: 'FIRST_HALF_WINNER',
} as const;

export type Market = (typeof Market)[keyof typeof Market];
