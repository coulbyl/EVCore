// Settlement outcome of a bet.
//
// SOURCE OF TRUTH for the `BetStatus` domain enum. Mirrored by the Prisma enum
// and guarded by the conformance test (see market.ts).
export const BetStatus = {
  PENDING: 'PENDING',
  WON: 'WON',
  LOST: 'LOST',
  VOID: 'VOID',
} as const;

export type BetStatus = (typeof BetStatus)[keyof typeof BetStatus];
