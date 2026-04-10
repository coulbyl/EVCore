"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { PageShell } from "@evcore/ui";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = useMemo(
    () => [
      {
        label: "Tableau de bord",
        mobileLabel: "Accueil",
        href: "/",
        active: pathname === "/",
      },
      {
        label: "Coupons",
        href: "/coupons",
        active: pathname === "/coupons",
      },
      {
        label: "Audit",
        href: "/audit",
        active: pathname === "/audit",
      },
      {
        label: "Glossaire",
        href: "/glossaire",
        active: pathname === "/glossaire",
      },
    ],
    [pathname],
  );

  return <PageShell navItems={navItems}>{children}</PageShell>;
}
