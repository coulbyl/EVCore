export type BankrollTransactionType =
  | "DEPOSIT"
  | "BET_PLACED"
  | "BET_WON"
  | "BET_VOID";

export type BankrollBalance = {
  balance: string;
};

export type BankrollTransaction = {
  id: string;
  type: BankrollTransactionType;
  amount: string;
  betId: string | null;
  note: string | null;
  createdAt: string;
};
