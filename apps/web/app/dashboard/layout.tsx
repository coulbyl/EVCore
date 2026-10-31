import { AppShell } from "@/components/app-shell";
import { NetworkStatusBanner } from "@/components/network-status-banner";
import { DashboardPwaInstallBanner } from "@/components/dashboard-pwa-install-banner";
import { BetSlipProvider } from "@/domains/bet-slip/context/bet-slip-provider";
import { BetSlipDrawer } from "@/components/bet-slip-drawer";
import { EvaFab } from "@/components/eva/eva-fab";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { CurrencyProvider } from "@/providers/currency-provider";
import type { AppCurrency } from "@/helpers/number";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { REQUESTED_PATH_HEADER } from "@/domains/auth/routing/auth-routing";
import { retiredRouteTarget } from "@/helpers/retired-routes";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Suspense } from "react";
import { NotificationOpenTracker } from "@/components/notification-open-tracker";
import { DashboardProviders } from "./providers";
import { CurrentUserProvider } from "@/domains/auth/context/current-user-context";
import { ProductTourProvider } from "@/domains/product-tour/context/product-tour-context";
import "../globals.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, locale, messages] = await Promise.all([
    getCurrentSession(),
    getLocale(),
    getMessages(),
  ]);

  if (!session) {
    redirect("/auth/login");
  }

  // The switch (15-todo.md, C19): a player opening an old screen lands on
  // the one that replaces it, /dashboard itself on Aujourd'hui. The admin
  // keeps /dashboard until its own overhaul (12-admin.md).
  const requested = (await headers()).get(REQUESTED_PATH_HEADER);
  const target = requested
    ? retiredRouteTarget(
        new URL(requested, "http://evcore").pathname,
        session.user.role,
      )
    : null;
  if (target) redirect(target);

  const initialCurrency =
    (session.user.currency as AppCurrency | null) ?? "XOF";

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DashboardProviders>
        <CurrencyProvider initialCurrency={initialCurrency}>
          <CurrentUserProvider initialUser={session.user}>
            <BetSlipProvider>
              <ProductTourProvider>
                <AppShell headerNotice={<NetworkStatusBanner />}>
                  {children}
                </AppShell>
                <BetSlipDrawer />
                <EvaFab />
                <DashboardPwaInstallBanner />
                <Suspense fallback={null}>
                  <NotificationOpenTracker />
                </Suspense>
              </ProductTourProvider>
            </BetSlipProvider>
          </CurrentUserProvider>
        </CurrencyProvider>
      </DashboardProviders>
    </NextIntlClientProvider>
  );
}
