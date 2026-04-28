"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  type AppCurrency,
  formatCurrency,
  formatSignedCurrency,
} from "@/helpers/number";

type CurrencyContextValue = {
  currency: AppCurrency;
  setCurrency: (c: AppCurrency) => void;
  formatAmount: (value: string | number, compact?: boolean) => string;
  formatSigned: (value: string | number, compact?: boolean) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  children,
  initialCurrency,
}: {
  children: React.ReactNode;
  initialCurrency: AppCurrency;
}) {
  const [currency, setCurrency] = useState<AppCurrency>(initialCurrency);

  const formatAmount = useCallback(
    (value: string | number, compact = false) =>
      formatCurrency(value, compact, currency),
    [currency],
  );

  const formatSigned = useCallback(
    (value: string | number, compact = false) =>
      formatSignedCurrency(value, compact, currency),
    [currency],
  );

  const value = useMemo(
    () => ({ currency, setCurrency, formatAmount, formatSigned }),
    [currency, formatAmount, formatSigned],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrencyFormat() {
  const ctx = useContext(CurrencyContext);
  if (!ctx)
    throw new Error("useCurrencyFormat must be used within CurrencyProvider");
  return ctx;
}
