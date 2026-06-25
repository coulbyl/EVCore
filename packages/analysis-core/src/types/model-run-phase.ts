// When in a fixture's lifecycle a model run was produced.
//
// SOURCE OF TRUTH for the `ModelRunPhase` domain enum. Mirrored by the Prisma
// enum and guarded by the conformance test (see market.ts).
export const MODEL_RUN_PHASE = {
  ADVANCE: 'ADVANCE',
  PRE_KICKOFF: 'PRE_KICKOFF',
  LIVE: 'LIVE',
} as const;

export type ModelRunPhase =
  (typeof MODEL_RUN_PHASE)[keyof typeof MODEL_RUN_PHASE];
