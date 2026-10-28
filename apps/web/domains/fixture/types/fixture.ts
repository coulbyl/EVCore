// ---------------------------------------------------------------------------
// Fixture domain types — indépendants du concept "audit"
// ---------------------------------------------------------------------------

export type FixtureModelFactors = {
  recentForm: number | null;
  xg: number | null;
  performanceDomExt: number | null;
  volatiliteLigue: number | null;
};

// Les champs du pari interne VALUE/SAFE (betId, market, pick, betStatus,
// probEstimated, ev) et safeValueBet sont retirés le 2026-10-27 : la table
// `bet` n'est plus écrite depuis le 04/09, ils étaient toujours nuls.
export type FixtureModelRun = {
  modelRunId: string;
  lambdaHome: string | null;
  lambdaAway: string | null;
  expectedTotalGoals: string | null;
  evaluatedPicks: FixtureEvaluatedPickSnapshot[];
  factors: FixtureModelFactors | null;
};

export type FixturePickSnapshot = {
  market: string;
  pick: string;
  probability: string;
  odds: string;
  ev: string;
  qualityScore: string;
};

export type FixtureEvaluatedPickSnapshot = FixturePickSnapshot & {
  status: "viable" | "rejected";
  rejectionReason?: string;
  /**
   * Fiche de match : fréquence affichée, probabilité du marché marge
   * retirée (2026-10-28). Absente de la vue admin, qui garde le brut.
   */
  marketProbability?: number | null;
};

export type FixtureRow = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  scheduledAt: string;
  status: string;
  score: string | null;
  htScore: string | null;
  modelRun: FixtureModelRun | null;
};

/** Fiche d'un match (GET /fixture/:id/sheet), ouverte depuis Décisions. */
export type FixtureSheet = FixtureRow & {
  homeTeam: string;
  awayTeam: string;
  country: string | null;
};

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export type FixtureFilters = {
  date: string;
};
