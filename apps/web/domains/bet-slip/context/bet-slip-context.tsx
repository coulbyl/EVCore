"use client";

import { createContext, useContext } from "react";
import { useBetSlipDraft } from "../use-cases/use-bet-slip-draft";

type BetSlipContextValue = ReturnType<typeof useBetSlipDraft> & {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

export function useBetSlip(): BetSlipContextValue {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used within BetSlipProvider");
  return ctx;
}

export { BetSlipContext };
