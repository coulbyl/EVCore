export type ProbabilityBucket =
  | "veryLikely"
  | "solid"
  | "moderate"
  | "speculative";

export type InvestmentMode =
  | "probability"
  | "value"
  | "safe"
  | "dominant"
  | "btts"
  | "goals"
  | "draw";

export type InvestmentPick = {
  fixtureId: string;
  fixture: string;
  competition: string | null;
  country: string | null;
  kickoff: string;
  scheduledAt: string;
  homeLogo: string | null;
  awayLogo: string | null;
  channel: "VALUE" | "SAFE" | "DOMINANT" | "BTTS" | "DRAW" | "GOALS";
  market: string;
  pick: string;
  comboMarket: string | null;
  comboPick: string | null;
  // Calibrated (bias-corrected) probability — drives probabilityBucket and
  // the ranking. modelProbability is the raw, uncorrected model output.
  probability: number;
  modelProbability: number;
  probabilityBucket: ProbabilityBucket;
  odds: number;
  ev: number | null;
  qualityScore: number | null;
  // Set once the fixture is finished — lets a past date act as a review of
  // what was recommended vs what actually hit.
  score: string | null;
  htScore: string | null;
  result: "WON" | "LOST" | "VOID" | null;
  evSign: "positive" | "negative" | null;
  shortOdds: boolean;
  channelRoiFlag: boolean;
};
