"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet } from "lucide-react";
import { cn } from "@evcore/ui/cn";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import { useBankrollBalance } from "@/domains/bankroll/use-cases/get-bankroll-balance";
import { useCurrencyFormat } from "@/providers/currency-provider";

export function BankrollWidget() {
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const { data, isLoading } = useBankrollBalance(currentUser.id);
  const { formatAmount } = useCurrencyFormat();
  const isActive = pathname.startsWith("/dashboard/bankroll");

  return (
    <Link
      href="/dashboard/bankroll"
      title="Portefeuille"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
        isActive
          ? "border-accent bg-accent/8 text-accent"
          : "border-border bg-panel-strong text-foreground hover:bg-secondary",
      )}
    >
      <Wallet size={16} />
      <span className="tabular-nums">
        {isLoading ? "…" : formatAmount(data?.balance ?? "0")}
      </span>
    </Link>
  );
}
