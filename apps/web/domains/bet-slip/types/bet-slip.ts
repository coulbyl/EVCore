// ---------------------------------------------------------------------------
// Draft — vit uniquement en localStorage, jamais persisté backend
// ---------------------------------------------------------------------------

export type BetSlipDraftItem = {
  /** Pour les bets MODEL : ID du bet existant en base. Non défini pour les picks utilisateur. */
  betId?: string;
  /** Pour les picks USER : ID du ModelRun source. Non défini pour les bets MODEL. */
  modelRunId?: string;
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  scheduledAt: string;
  market: string;
  pick: string;
  odds: string | null;
  /** Marché secondaire pour les picks combo (ex. "OVER_UNDER"). */
  comboMarket?: string;
  /** Pick secondaire pour les picks combo (ex. "OVER"). */
  comboPick?: string;
  ev: string | null;
  stakeOverride: number | null;
};

export type BetSlipDraft = {
  items: BetSlipDraftItem[];
  unitStake: number;
  type: "SIMPLE" | "COMBO";
};

/**
 * Clé stable pour identifier un item dans le brouillon.
 * - Bets MODEL  → betId (déjà unique en base)
 * - Picks USER  → clé composite fixtureId|market|pick|comboMarket|comboPick
 *
 * Cette fonction accepte un sous-ensemble des champs de BetSlipDraftItem
 * pour pouvoir être appelée depuis les composants sans construire l'item entier.
 */
export function draftItemKey(item: {
  betId?: string | null;
  fixtureId: string;
  market: string;
  pick: string;
  comboMarket?: string | null;
  comboPick?: string | null;
}): string {
  if (item.betId) return item.betId;
  return `${item.fixtureId}|${item.market}|${item.pick}|${item.comboMarket ?? "-"}|${item.comboPick ?? "-"}`;
}

// ---------------------------------------------------------------------------
// BetSlip — objet final renvoyé par le backend après soumission
// ---------------------------------------------------------------------------

export type BetSlipItemView = {
  betId: string;
  fixtureId: string;
  fixture: string;
  market: string;
  pick: string;
  comboMarket: string | null;
  comboPick: string | null;
  odds: string | null;
  ev: string;
  stake: string;
  stakeOverride: string | null;
  createdAt: string;
  betStatus: "WON" | "LOST" | "PENDING" | "VOID";
  homeScore: number | null;
  awayScore: number | null;
  /** Gain (>0) ou perte (<0) réels. null si le pari est encore en attente. */
  pnl: string | null;
};

export type BetSlipView = {
  id: string;
  userId: string;
  username: string;
  unitStake: string;
  type: "SIMPLE" | "COMBO";
  itemCount: number;
  createdAt: string;
  items: BetSlipItemView[];
};
