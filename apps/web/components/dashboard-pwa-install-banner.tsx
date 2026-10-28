"use client";

import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import { PwaInstallBanner } from "./pwa-install-banner";

/** Avoids stacking the install prompt over the first-run tour. */
export function DashboardPwaInstallBanner() {
  const currentUser = useCurrentUser();

  if (!currentUser.hasSeenOnboarding) {
    return null;
  }

  return <PwaInstallBanner />;
}
