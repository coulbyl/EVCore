// Sport behind a decision. The probabilistic core is football-specific today;
// adding a sport means writing a second engine behind the same channel/decision
// column, not a config flag (see docs/multi-sport-extension.md).
//
// SOURCE OF TRUTH for the `SportType` domain enum. Mirrored by the Prisma enum
// and guarded by the conformance test (see market.ts).
export const SPORT_TYPE = {
  FOOTBALL: "FOOTBALL",
} as const;

export type SportType = (typeof SPORT_TYPE)[keyof typeof SPORT_TYPE];
