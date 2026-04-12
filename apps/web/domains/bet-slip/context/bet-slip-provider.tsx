"use client";

import { useState } from "react";
import { useBetSlipDraft } from "../use-cases/use-bet-slip-draft";
import { BetSlipContext } from "./bet-slip-context";

export function BetSlipProvider({ children }: { children: React.ReactNode }) {
  const draft = useBetSlipDraft();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <BetSlipContext.Provider
      value={{
        ...draft,
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
      }}
    >
      {children}
    </BetSlipContext.Provider>
  );
}
