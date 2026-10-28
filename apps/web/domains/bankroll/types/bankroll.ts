export type BankrollTransactionType =
  | "DEPOSIT"
  | "BET_PLACED"
  | "BET_WON"
  | "BET_VOID"
  | "SLIP_CANCELLED"
  | "WITHDRAWAL";

export type BankrollBalance = {
  balance: string;
};

/** Solde et dépôts déclarés, sur tout l'historique (pas 200 mouvements). */
export type BankrollSummary = {
  balance: string;
  deposited: string;
  withdrawn: string;
};

export type BankrollTransaction = {
  id: string;
  type: BankrollTransactionType;
  amount: string;
  betId: string | null;
  note: string | null;
  createdAt: string;
  fixture: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  pick: string | null;
  /** Nombre de sélections quand le mouvement porte sur un combiné. */
  comboLegs: number | null;
  market: string | null;
};
