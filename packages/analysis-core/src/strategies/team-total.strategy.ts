import type Decimal from "decimal.js";
import { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { priceForSelection } from "../selection";
import {
  getTeamTotalLineConfigs,
  type TeamTotalLine,
  type TeamTotalLineConfig,
  type TeamTotalSide,
  type TeamTotalTeam,
} from "./config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
  StrategySelection,
} from "./types";
import type { MatchProbabilities } from "../selection/types";
import type { TeamTotalProba } from "../probability";

// Maps a (line, side) to the TEAM_TOTAL_* pick string used across odds
// resolution/settlement — same "OVER_X_Y" shape as TeamTotalProba/OddsMap keys.
function teamTotalPick(line: TeamTotalLine, side: TeamTotalSide): string {
  return `${side}_${String(line).replace(".", "_")}`;
}

function teamTotalMarket(team: TeamTotalTeam): Market {
  return team === "HOME" ? Market.TEAM_TOTAL_HOME : Market.TEAM_TOTAL_AWAY;
}

function teamTotalProbability(
  probabilities: MatchProbabilities,
  team: TeamTotalTeam,
  line: TeamTotalLine,
  side: TeamTotalSide,
): Decimal | undefined {
  const map: TeamTotalProba =
    team === "HOME" ? probabilities.teamTotalHome : probabilities.teamTotalAway;
  return map[teamTotalPick(line, side) as keyof TeamTotalProba];
}

type TeamTotalCandidate = {
  config: TeamTotalLineConfig;
  market: Market;
  pick: string;
  probability: Decimal;
  priced: ReturnType<typeof priceForSelection>;
};

// Rank value-first (EV when priced), same tiebreak as GoalsStrategy.
function compareTeamTotalCandidates(
  a: TeamTotalCandidate,
  b: TeamTotalCandidate,
): number {
  const aEv = a.priced.ev ?? null;
  const bEv = b.priced.ev ?? null;
  if (aEv !== null && bEv !== null) return bEv.comparedTo(aEv);
  if (aEv !== null) return -1;
  if (bEv !== null) return 1;
  return b.probability.comparedTo(a.probability);
}

// Pure TEAM_TOTAL decision over an explicit set of (already enabled) line
// configs — mirrors decideGoals, doubled on the team (HOME/AWAY) dimension.
export function decideTeamTotal(
  context: StrategyContext,
  lineConfigs: readonly TeamTotalLineConfig[],
): StrategyDecision {
  const channel = STRATEGY_CHANNEL.TEAM_TOTAL;
  if (lineConfigs.length === 0) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.DISABLED,
      selections: [],
    };
  }

  const candidates: TeamTotalCandidate[] = [];
  let bestBelow: { probability: number; threshold: number } | null = null;
  for (const config of lineConfigs) {
    const probability = teamTotalProbability(
      context.probabilities,
      config.team,
      config.line,
      config.side,
    );
    if (probability === undefined) continue;
    if (probability.lessThan(config.threshold)) {
      const probabilityNum = probability.toNumber();
      if (bestBelow === null || probabilityNum > bestBelow.probability) {
        bestBelow = {
          probability: probabilityNum,
          threshold: config.threshold,
        };
      }
      continue;
    }
    const market = teamTotalMarket(config.team);
    const pick = teamTotalPick(config.line, config.side);
    candidates.push({
      config,
      market,
      pick,
      probability,
      priced: priceForSelection({
        odds: context.odds,
        market,
        pick,
        probability,
      }),
    });
  }

  if (candidates.length === 0) {
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "below_threshold",
      reasonDetails: bestBelow ?? {},
      selections: [],
    };
  }

  candidates.sort(compareTeamTotalCandidates);
  const best = candidates[0];
  if (!best)
    return {
      channel,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      reasonCode: "no_candidates",
      selections: [],
    };
  const selection: StrategySelection = {
    market: best.market,
    pick: best.pick,
    probability: best.probability,
    ...best.priced,
    rank: 1,
  };

  return {
    channel,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    selections: [selection],
  };
}

// TEAM_TOTAL channel — per-team Over/Under goals line. Like GOALS, evaluates
// every enabled (team × line × side) config for the league and emits the
// single best one (by EV). No backtested segments yet — see config.ts header.
export class TeamTotalStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.TEAM_TOTAL;
  readonly allowedMarkets: readonly Market[] = [
    Market.TEAM_TOTAL_HOME,
    Market.TEAM_TOTAL_AWAY,
  ];

  evaluate(context: StrategyContext): StrategyDecision {
    return decideTeamTotal(
      context,
      getTeamTotalLineConfigs(context.competitionCode),
    );
  }
}
