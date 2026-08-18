// @evcore/backtest-core — shared replay/point-in-time harness for backtests.
//
// HARD BOUNDARY: only point-in-time-loader.ts may import @evcore/db. Every
// other file gets its data through PointInTimeLoader, so "read a value from
// the future" is a compile-time-impossible mistake, not a review discipline.
// Enforced by architecture.guard.spec.ts.
export * from "./point-in-time-loader";
export * from "./replay-engine";
