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
  // Un portefeuille à zéro n'a rien à dire : « 0 F » en tête d'écran mobile
  // prenait la place la plus visible pour un montant que l'utilisateur n'a
  // jamais choisi (revue UX du 2026-10-11, P1-10). L'icône reste : c'est
  // l'entrée vers la page Suivi de mise.
  const balance = Number(data?.balance ?? 0);
  const showAmount = !isLoading && Number.isFinite(balance) && balance !== 0;

  return (
    <Link
      href="/dashboard/bankroll"
      title="Suivi de mise"
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
        isActive
          ? "border-accent bg-accent/8 text-accent"
          : "border-border bg-panel-strong text-foreground hover:bg-secondary",
      )}
    >
      <Wallet size={16} />
      {/* Sous 400 px l'en-tête ne peut pas porter un montant à neuf chiffres
          (« 500 760 000 F ») à côté des cinq autres commandes : l'icône
          reste, le montant se lit sur la page Suivi de mise. */}
      {showAmount && (
        <span className="tabular-nums max-[399px]:hidden">
          {formatAmount(data?.balance ?? "0")}
        </span>
      )}
    </Link>
  );
}
