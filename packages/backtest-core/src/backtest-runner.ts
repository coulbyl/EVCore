import type { TeamStatsInput } from "@evcore/analysis-core";
import { PointInTimeLoader } from "./point-in-time-loader";
import { ReplayEngine, type ReplayStep } from "./replay-engine";
import type { ListFixturesOptions } from "./point-in-time-loader";

// The facade a CLI script actually calls: walks fixtures chronologically
// (ReplayEngine) and, for each one, gathers every point-in-time input
// PointInTimeLoader currently exposes — odds, both teams' rolling stats
// (cross-comp fallback applied), H2H, congestion — into a single step.
//
// Scope today: this assembles INPUTS, not the final probability. Turning
// these into the same λ/probability the live engine would have produced
// needs deriveLambdas + the favourite-side determination that decides
// which team H2H is scored against (BettingEngineService.analyzeFixture,
// not yet extracted) — a further composition step on top of this, not done
// here. Callers that need "what did the model's inputs look like" (feature
// audits, calibration groundwork) are already fully served; callers that
// need "what would the model have predicted" need that next step first.

export type EnrichedReplayStep = ReplayStep & {
  homeTeamStats: TeamStatsInput | null;
  awayTeamStats: TeamStatsInput | null;
  // Decay-weighted H2H score with the home team as the reference side (1 =
  // home has won every recent leg, 0 = away has). Not necessarily "the
  // odds favourite" — see the scope note above.
  h2hScoreHomeReference: number | null;
  congestionScore: number;
};

export class BacktestRunner {
  private readonly loader: PointInTimeLoader;
  private readonly replayEngine: ReplayEngine;

  constructor(loader: PointInTimeLoader = new PointInTimeLoader()) {
    this.loader = loader;
    this.replayEngine = new ReplayEngine(loader);
  }

  async *run(options: ListFixturesOptions): AsyncGenerator<EnrichedReplayStep> {
    for await (const step of this.replayEngine.replay(options)) {
      const { fixture, context } = step;

      const [homeTeamStats, awayTeamStats, h2hScoreHomeReference, congestionScore] =
        await Promise.all([
          this.loader.loadTeamStats({
            teamId: fixture.homeTeamId,
            seasonId: fixture.seasonId,
            competitionCode: fixture.competitionCode,
            asOf: context.asOf,
          }),
          this.loader.loadTeamStats({
            teamId: fixture.awayTeamId,
            seasonId: fixture.seasonId,
            competitionCode: fixture.competitionCode,
            asOf: context.asOf,
          }),
          this.loader.loadH2HScore({
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            favoriteTeamId: fixture.homeTeamId,
            asOf: context.asOf,
          }),
          this.loader.loadCongestionScore({
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            asOf: context.asOf,
          }),
        ]);

      yield {
        ...step,
        homeTeamStats,
        awayTeamStats,
        h2hScoreHomeReference,
        congestionScore,
      };
    }
  }
}
