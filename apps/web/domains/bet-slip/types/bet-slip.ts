// ---------------------------------------------------------------------------
// Plafonds — miroir de SLIP_LIMITS dans bankroll.constants.ts (backend)
// ---------------------------------------------------------------------------

export const SLIP_LIMITS = {
  MAX_UNIT_STAKE: 500_000,
  MAX_ITEMS: 10,
  MAX_POTENTIAL_RETURN: 5_000_000,
} as const;

// ---------------------------------------------------------------------------
// Draft — vit uniquement en localStorage, jamais persisté backend
// ---------------------------------------------------------------------------

export type BetSlipDraftItem = {
  modelRunId?: string;
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  scheduledAt?: string;
  market: string;
  pick: string;
  odds: string | null;
  ev: string | null;
  canal?: string;
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
 * - Picks USER  → clé composite fixtureId|market|pick
 *
 * Cette fonction accepte un sous-ensemble des champs de BetSlipDraftItem
 * pour pouvoir être appelée depuis les composants sans construire l'item entier.
 */
export function draftItemKey(item: {
  fixtureId: string;
  market: string;
  pick: string;
}): string {
  return `${item.fixtureId}|${item.market}|${item.pick}`;
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
  canal: "VALUE" | "SAFE";
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
