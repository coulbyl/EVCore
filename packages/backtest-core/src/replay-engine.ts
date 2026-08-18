import type { FullOddsSnapshot } from "@evcore/analysis-core";
import {
  PointInTimeLoader,
  type ListFixturesOptions,
  type PointInTimeContext,
  type ReplayFixture,
} from "./point-in-time-loader";

// The chronological event loop from docs/backtest-harness-architecture.md
// §4: fixtures are events, walked strictly in kickoff order, each one
// resolved through PointInTimeLoader — never a shortcut, never Prisma
// touched directly here (architecture.guard.spec.ts enforces that). This is
// deliberately a synchronous-feeling sequential walk, not a message queue:
// the correctness guarantee (no fixture N+1's data can leak into fixture
// N's decision) comes from the walk order, not from any queueing infra.
//
// Scope today: odds only. A full replay (rebuilding the exact
// deterministic score the live engine would have produced) also needs
// point-in-time team stats, H2H, congestion, Elo — each one a future
// addition to PointInTimeLoader, plugged into ReplayStep the same way odds
// is. Callers that only need "what did the market look like when this
// fixture kicked off" (calibration audits comparing model probability to
// closing odds, e.g.) are already fully served.

export type ReplayStep = {
  fixture: ReplayFixture;
  context: PointInTimeContext;
  odds: FullOddsSnapshot | null;
};

export class ReplayEngine {
  constructor(private readonly loader: PointInTimeLoader = new PointInTimeLoader()) {}

  // Async generator, not "load everything into an array first": a replay
  // over a full season is thousands of fixtures, and callers (a script
  // computing running metrics) can consume steps one at a time instead of
  // holding the whole run in memory.
  async *replay(options: ListFixturesOptions): AsyncGenerator<ReplayStep> {
    const fixtures = await this.loader.listFixtures(options);
    for (const fixture of fixtures) {
      const context: PointInTimeContext = { asOf: fixture.scheduledAt };
      const odds = await this.loader.loadOdds(fixture.id, context);
      yield { fixture, context, odds };
    }
  }
}
