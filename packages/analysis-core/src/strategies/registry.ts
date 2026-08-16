import type { ChannelStrategy } from "./types";
import { ChannelStrategyOrchestrator } from "./orchestrator";
import { ValueStrategy } from "./value.strategy";
import { SafeStrategy } from "./safe.strategy";
import { DominantStrategy } from "./dominant.strategy";
import { BttsStrategy } from "./btts.strategy";
import { DrawStrategy } from "./draw.strategy";
import { GoalsStrategy } from "./goals.strategy";
import { CleanSheetStrategy } from "./clean-sheet.strategy";
import { TeamTotalStrategy } from "./team-total.strategy";
import { WinEitherHalfStrategy } from "./win-either-half.strategy";
import { ConsensusStrategy } from "./consensus.strategy";
import { AvoidStrategy } from "./avoid.strategy";
import { CorrectScoreStrategy } from "./correct-score.strategy";
import { ResultTotalGoalsStrategy } from "./result-total-goals.strategy";
import { OverUnderHtStrategy } from "./over-under-ht.strategy";
import { ResultBttsStrategy } from "./result-btts.strategy";
import { DrawNoBetStrategy } from "./draw-no-bet.strategy";
import { WinToNilStrategy } from "./win-to-nil.strategy";

export const V1_STRATEGIES: readonly ChannelStrategy[] = [
  new ValueStrategy(),
  new SafeStrategy(),
  new DominantStrategy(),
  new BttsStrategy(),
  new DrawStrategy(),
  new GoalsStrategy(),
  new CleanSheetStrategy(),
  new TeamTotalStrategy(),
  new WinEitherHalfStrategy(),
  new CorrectScoreStrategy(),
  new ResultTotalGoalsStrategy(),
  new OverUnderHtStrategy(),
  new ResultBttsStrategy(),
  new DrawNoBetStrategy(),
  new WinToNilStrategy(),
  new ConsensusStrategy(),
  new AvoidStrategy(),
];

export function createChannelStrategyOrchestrator(): ChannelStrategyOrchestrator {
  return new ChannelStrategyOrchestrator(V1_STRATEGIES);
}
