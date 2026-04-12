// ---------------------------------------------------------------------------
// Draft — vit uniquement en localStorage, jamais persisté backend
// ---------------------------------------------------------------------------

export type BetSlipDraftItem = {
  betId: string;
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  scheduledAt: string;
  market: string;
  pick: string;
  ev: string | null;
  stakeOverride: number | null;
};

export type BetSlipDraft = {
  items: BetSlipDraftItem[];
  unitStake: number;
};

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
};

export type BetSlipView = {
  id: string;
  userId: string;
  username: string;
  unitStake: string;
  itemCount: number;
  createdAt: string;
  items: BetSlipItemView[];
};
