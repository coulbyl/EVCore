// Outcome of a channel evaluating a fixture.
//
// SOURCE OF TRUTH for the `ChannelDecisionStatus` domain enum. Mirrored by the
// Prisma enum and guarded by the conformance test (see market.ts).
export const CHANNEL_DECISION_STATUS = {
  SELECTED: 'SELECTED',
  REJECTED: 'REJECTED',
  DISABLED: 'DISABLED',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  MISSING_ODDS: 'MISSING_ODDS',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;

export type ChannelDecisionStatus =
  (typeof CHANNEL_DECISION_STATUS)[keyof typeof CHANNEL_DECISION_STATUS];
