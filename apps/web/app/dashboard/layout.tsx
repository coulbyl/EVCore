import { AppShell } from "@/components/app-shell";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { BetSlipProvider } from "@/domains/bet-slip/context/bet-slip-provider";
import { BetSlipDrawer } from "@/components/bet-slip-drawer";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { CurrencyProvider } from "@/providers/currency-provider";
import type { AppCurrency } from "@/helpers/number";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login");
  }

  const initialCurrency =
    (session.user.currency as AppCurrency | null) ?? "XOF";

  return (
    <CurrencyProvider initialCurrency={initialCurrency}>
      <BetSlipProvider>
        <AppShell currentUser={session.user}>{children}</AppShell>
        <BetSlipDrawer />
        <PwaInstallBanner />
      </BetSlipProvider>
    </CurrencyProvider>
  );
}
