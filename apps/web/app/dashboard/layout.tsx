import { AppShell } from "@/components/app-shell";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { BetSlipProvider } from "@/domains/bet-slip/context/bet-slip-provider";
import { BetSlipDrawer } from "@/components/bet-slip-drawer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BetSlipProvider>
      <AppShell>{children}</AppShell>
      <BetSlipDrawer />
      <PwaInstallBanner />
    </BetSlipProvider>
  );
}
