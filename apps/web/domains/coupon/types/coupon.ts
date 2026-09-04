export type CouponClassName = "SAFE" | "BALANCED" | "BOLD";

export type CouponLegDto = {
  id: string;
  fixtureId: string;
  homeTeam: string;
  homeLogo: string | null;
  awayTeam: string;
  awayLogo: string | null;
  competition: string;
  competitionName: string;
  country: string;
  scheduledAt: string;
  score: string | null;
  htScore: string | null;
  canal: "VALUE" | "SAFE" | "BTTS" | "DRAW" | "DOMINANT";
  market: string;
  pick: string;
  probability: number;
  oddsSnapshot: number | null;
  signalScore: number;
  isCorrect: boolean | null;
  /** Fixture's latest ModelRun id — lets "Jouer ce coupon" submit this leg to
   * POST /bet-slips as a USER pick (modelRunId + market + pick). `null` on
   * the rare fixture with no ModelRun at all. */
  modelRunId: string | null;
};

export type CouponStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
export type CouponResult = "WON" | "LOST" | "PARTIAL" | "VOID";

export type CouponProposalDto = {
  id: string;
  forDate: string;
  rank: number;
  signalWindowDays: number;
  targetOddsMin: number;
  targetOddsMax: number;
  /**
   * Classe du coupon. Les trois se différencient par la bande de cote de leurs
   * jambes, donc par un profil gain/fréquence réellement distinct — voir
   * COUPON_CLASS_META pour les taux mesurés. `null` pour les propositions
   * générées avant les classes.
   */
  couponClass: CouponClassName | null;
  /**
   * Batch qui a produit/mis à jour cette proposition — "evening" (défaut) ou
   * "intraday" (régénération horaire proche du coup d'envoi). Les deux
   * peuvent coexister le même jour pour la même classe.
   */
  batch: "evening" | "intraday";
  combinedOdds: number;
  jointProbability: number;
  signalScore: number;
  status: CouponStatus;
  /** Engagement réel, jamais fabriqué (CLAUDE.md §4 point 6) — viewerCount :
   * utilisateurs distincts ayant vu ce coupon ; playerCount : utilisateurs
   * distincts l'ayant réellement joué (bet slip soumis) ; playedByMe :
   * l'utilisateur courant en fait partie (gèle "Jouer ce coupon"). */
  viewerCount: number;
  playerCount: number;
  playedByMe: boolean;
  result: CouponResult | null;
  /**
   * Écrit par apps/vantage-worker (persist-coupon-proposal.ts) — un blob
   * JSON dont `llmReasonDetails` est le texte de justification du LLM pour
   * le coupon entier (distinct du raisonnement par jambe, `legs[].llmReasoning`,
   * jamais exposé séparément côté API). Reste `Record<string, unknown>` pour
   * le reste : ce blob n'a pas de contrat versionné, seul le champ qu'on
   * affiche est typé explicitement.
   */
  reasoning: ({ llmReasonDetails?: unknown } & Record<string, unknown>) | null;
  lastFixtureScheduledAt: string;
  generatedAt: string;
  legs: CouponLegDto[];
};
