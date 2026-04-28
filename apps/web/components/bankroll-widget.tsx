"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet } from "lucide-react";
import { useBankrollBalance } from "@/domains/bankroll/use-cases/get-bankroll-balance";
import { useCurrencyFormat } from "@/providers/currency-provider";

export function BankrollWidget() {
  const pathname = usePathname();
  const { data, isLoading } = useBankrollBalance();
  const { formatAmount } = useCurrencyFormat();
  const isActive = pathname.startsWith("/dashboard/bankroll");

  return (
    <Link
      href="/dashboard/bankroll"
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${
        isActive
          ? "border-accent bg-accent/8 text-accent"
          : "border-border bg-panel-strong text-foreground hover:bg-secondary"
      }`}
      title="Portefeuille"
    >
      <Wallet size={16} />
      <span className="tabular-nums">
        {isLoading ? "..." : formatAmount(data?.balance ?? "0", true)}
      </span>
    </Link>
  );
}
