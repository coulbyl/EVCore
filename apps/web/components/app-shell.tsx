"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { PageShell } from "@evcore/ui";
import { BetSlipButton } from "./bet-slip-button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = useMemo(
    () => [
      {
        label: "Tableau de bord",
        mobileLabel: "Accueil",
        href: "/dashboard",
        active: pathname === "/dashboard",
      },
      {
        label: "Fixtures",
        href: "/dashboard/fixtures",
        active: pathname.startsWith("/dashboard/fixtures"),
      },
      {
        label: "Mes slips",
        href: "/dashboard/bet-slips",
        active: pathname.startsWith("/dashboard/bet-slips"),
      },
      {
        label: "Audit",
        href: "/dashboard/audit",
        active: pathname === "/dashboard/audit",
      },
      {
        label: "Glossaire",
        href: "/dashboard/glossaire",
        active: pathname === "/dashboard/glossaire",
      },
    ],
    [pathname],
  );

  return (
    <PageShell navItems={navItems} actions={<BetSlipButton />}>
      {children}
    </PageShell>
  );
}
