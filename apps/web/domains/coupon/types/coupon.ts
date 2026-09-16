export type CouponClassName = "SAFE" | "BALANCED" | "BOLD" | "UNIQUE";

export type CouponSource = "LLM" | "PRICE_COMPOSER";

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
  /**
   * Code canal renvoyé par l'API — toujours passer par `channelLabel()` pour
   * l'afficher. Volontairement `string` : l'union ne listait que cinq canaux
   * alors que l'API en sert plus de vingt, et la moindre valeur non listée
   * (VANTAGE, PRICE…) rendait le typage faux sans que rien ne le signale.
   */
  canal: string;
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
  /**
   * Générateur à l'origine de la proposition.
   *
   * `LLM` — sélection par le LLM (apps/vantage-worker).
   * `PRICE_COMPOSER` — compositeur déterministe classant sur le coût mesuré du
   * marché, sans aucune probabilité du moteur.
   *
   * Les deux tournent en parallèle sur la même cible de cote : l'affichage doit
   * les distinguer, sinon l'utilisateur compare deux produits en croyant n'en
   * voir qu'un.
   */
  source: CouponSource;
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
