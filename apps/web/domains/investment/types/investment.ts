// Les trois vues d'Investir (backend : investment.constants.ts). Investir
// n'est plus une surface de revue exhaustive à 18 onglets mais un point de
// filtre unique — voir docs/audit-canaux-investir-2026-08-22.md §5.
export type InvestmentView = "assumed" | "watch" | "excluded";

export const INVESTMENT_VIEWS: InvestmentView[] = [
  "assumed",
  "watch",
  "excluded",
];

export type ExclusionReason =
  | "AVOID"
  | "CALIBRATION_ALERT"
  | "LAMBDA_INCOHERENT"
  | "EDGE_TOO_HIGH"
  | "ODDS_TOO_SHORT";

export type InvestmentChannel =
  | "VALUE"
  | "SAFE"
  | "DOMINANT"
  | "BTTS"
  | "DRAW"
  | "GOALS"
  | "TEAM_TOTAL"
  | "CLEAN_SHEET"
  | "WIN_EITHER_HALF"
  | "FIRST_HALF"
  | "DOUBLE_CHANCE"
  | "RESULT_TOTAL_GOALS"
  | "OVER_UNDER_HT"
  | "RESULT_BTTS"
  | "DRAW_NO_BET"
  | "WIN_TO_NIL"
  | "HALF_TIME_FULL_TIME";

export type FixtureStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED";

export type InvestmentPick = {
  fixtureId: string;
  fixtureStatus: FixtureStatus;
  fixture: string;
  competition: string | null;
  competitionCode: string;
  country: string | null;
  kickoff: string;
  scheduledAt: string;
  homeLogo: string | null;
  awayLogo: string | null;
  // Informational only — never affects scoring/EV. True when that team has
  // played fewer than 5 finished matches under its current coach.
  homeNewCoach: boolean;
  awayNewCoach: boolean;
  channel: InvestmentChannel;
  market: string;
  pick: string;
  // Probabilité calibrée par la courbe de fiabilité du canal : la fréquence
  // de réussite attendue, et le seul critère de tri de la page.
  probability: number;
  modelProbability: number;
  odds: number;
  ev: number | null;
  qualityScore: number | null;
  // Set once the fixture is finished — lets a past date act as a review of
  // what was recommended vs what actually hit.
  score: string | null;
  htScore: string | null;
  result: "WON" | "LOST" | "VOID" | null;
  // ROI shrinké du canal et le volume réglé qui le soutient.
  channelRoiShrunk: number;
  channelRoiSampleSize: number;
  channelHitRate: number;
  // Renseigné uniquement dans la vue « Écarté ».
  exclusionReason: ExclusionReason | null;
};
