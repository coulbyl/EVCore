// @evcore/analysis-core — pure deterministic betting analysis core.
//
// HARD BOUNDARY: this package must never import infrastructure (no DB, no HTTP,
// no Redis, no NestJS, no BullMQ, no environment access). Inputs are plain
// objects, outputs are plain objects, same input → same output. The boundary is
// enforced automatically by `architecture.guard.spec.ts`.
export * from "./types";
export * from "./ev";
