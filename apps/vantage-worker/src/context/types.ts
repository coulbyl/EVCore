import type { StrategyChannel, Market } from "@evcore/analysis-core";

/** A channel's own near-threshold read, surfaced even when it abstained —
 * see docs/context-expansion-proposal.md ("C"). Raw values only, no
 * interpretation baked in: VANTAGE forms its own read from the numbers,
 * same discipline as everywhere else in this prompt. `null` when the
 * channel's rejection payload couldn't be mapped (see
 * near-miss.ts:NEAR_MISS_SPECS — only 11/19 channels are covered; the
 * other 8 either gate on a deliberate quality flag (market_suspended,
 * never surfaced — see architecture note in near-miss.ts) or simply log no
 * structured payload on rejection). */
export type NearMissReading = {
  values: readonly { label: string; probability: number }[];
  threshold: number | null;
};

/** One other channel's read on this match — VANTAGE's own decision is never
 * included here (see build-match-context.ts). */
export type ChannelReading = {
  channel: StrategyChannel;
  status: "SELECTED" | "REJECTED" | "OTHER";
  reasonCode: string | null;
  market: Market | null;
  pick: string | null;
  probability: number | null;
  odds: number | null;
  ev: number | null;
  /** Only ever set when `status !== "SELECTED"` — see NearMissReading. */
  nearMiss?: NearMissReading | null;
};

/** How reliable a channel has actually been on this exact competition —
 * ratio réel/annoncé, never ROI or the channel's own claimed edge (see
 * feedback_admission_par_calibration in project memory: admission is judged
 * on calibration, never on ROI or self-reported confidence — ROI's variance
 * is dominated by the odds of the few winning bets, so it stays noisy well
 * past n=200 for a channel playing heterogeneous odds; see incident
 * 2026-08-28, where VANTAGE built its "tension" reasoning on exactly that
 * noise). */
export type ChannelCalibration = {
  channel: StrategyChannel;
  sampleSize: number;
  hitRate: number | null;
  /** hitRate ÷ average announced probability. 1.0 = perfectly calibrated,
   * <1 = overconfident (wins less often than it claimed), >1 =
   * underconfident. Self-interpreting regardless of the market's baseline
   * win rate — unlike a bare hit rate, which reads very differently for
   * DOUBLE_CHANCE (high baseline) than for CORRECT_SCORE (low baseline). */
  calibrationRatio: number | null;
};

/** Raw features for one team, straight from `team_stats` — the same table
 * the deterministic engine itself reads (`betting-engine.service.ts`'s
 * `teamStats.findFirst`). Gives VANTAGE a basis to form a view independent
 * of what any channel already computed — see docs/context-expansion-
 * proposal.md ("A"). `null` when no `team_stats` row exists before this
 * fixture (known gap on a handful of leagues at season start — see project
 * memory project_season_rollover_teamstats_gap). */
export type TeamSignal = {
  recentForm: number;
  xgFor: number;
  xgAgainst: number;
  homeWinRate: number;
  awayWinRate: number;
  drawRate: number;
  leagueVolatility: number;
} | null;

/** Set only when the team's current coach has been in charge for fewer than
 * NEW_COACH_WINDOW_MATCHES finished matches — mirrors the same "new coach"
 * window backend/channel-decision.repository.ts already reports elsewhere,
 * computed independently here (vantage-worker never imports apps/backend).
 * `null` otherwise — this is a fact worth mentioning only when it's live,
 * not a number to report every time. */
export type CoachSignal = { matchesInCharge: number } | null;

/** Decay-weighted most frequent head-to-head scoreline, oriented to this
 * fixture's home/away sides (`computeH2HScorelineSignalFromLegs`, same
 * function CORRECT_SCORE's own shadow signal uses). The only H2H signal
 * VANTAGE doesn't already see indirectly — the 6 per-market H2H signals are
 * already folded into every channel's own probability upstream (H2H_MARKET_
 * SIGNALS, active since 2026-07-28) before VANTAGE ever reads it, so
 * re-exposing them here would be redundant. `null` below H2H_MIN_SAMPLE
 * legs. */
export type H2HSignal = {
  scoreline: string;
  confidence: number;
  sampleSize: number;
} | null;

/** API-Football's own `/predictions` endpoint, ingested as a genuinely
 * independent second forecaster (`ModelRun.features.shadow_predictions`,
 * `FEATURE_FLAGS.SCORING.SHADOW_PREDICTIONS`) — not derived from this
 * system's λ/team_stats at all, unlike every channel VANTAGE otherwise
 * compares against each other. `conflict` is already precomputed upstream:
 * does this external pick disagree directionally with our λ. `null` when
 * absent on this ModelRun (~1% of runs, or the flag was off at analysis
 * time). */
export type ShadowPrediction = {
  homePercent: number;
  drawPercent: number;
  awayPercent: number;
  poissonHome: number;
  poissonAway: number;
  winnerName: string | null;
  conflict: boolean;
} | null;

/** The book's raw price for a market no channel selected on this fixture —
 * "what the market prices," never framed as edge/EV (CLAUDE.md: claimed
 * edge is anti-predictive, MAX_LEG_EDGE is a ceiling never a selection
 * signal — that rule applies to VANTAGE's own reasoning exactly as much as
 * to any channel's). Capped to a handful of key markets by the caller, not
 * every market in `odds_snapshot`. */
export type MarketOddsSnapshot = {
  market: Market;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
};

export type MatchContext = {
  fixtureId: string;
  modelRunId: string;
  homeTeam: string;
  awayTeam: string;
  competitionCode: string | null;
  competitionName: string | null;
  kickoff: string;
  readings: ChannelReading[];
  calibration: ChannelCalibration[];
  /** All fields below are additive context (2026-08-30, docs/context-
   * expansion-proposal.md) — optional so a caller/test building a minimal
   * MatchContext still typechecks without them. `buildMatchContext` always
   * populates them; only tests may omit them. */
  homeTeamStats?: TeamSignal;
  awayTeamStats?: TeamSignal;
  homeCoach?: CoachSignal;
  awayCoach?: CoachSignal;
  h2h?: H2HSignal;
  shadowPrediction?: ShadowPrediction;
  uncoveredMarketOdds?: readonly MarketOddsSnapshot[];
};
