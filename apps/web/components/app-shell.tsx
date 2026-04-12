"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { PageShell } from "@evcore/ui";
import { BetSlipButton } from "./bet-slip-button";
import { LogoutButton } from "@/app/(public)/auth/components/logout-button";
import type { AuthSessionUser } from "@/domains/auth/types/auth";

export function AppShell({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser: AuthSessionUser;
}) {
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
    <PageShell
      navItems={navItems}
      actions={
        <div className="flex items-center gap-2">
          <BetSlipButton />
          <LogoutButton tone="ghost" className="rounded-lg px-3 py-2" />
        </div>
      }
      sidebarFooter={
        <div className="rounded-lg border border-white/10 bg-white/6 px-4 py-3">
          <p className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-400">
            Session
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {currentUser.fullName}
          </p>
          <p className="mt-0.5 text-xs text-slate-300">
            @{currentUser.username}
          </p>
        </div>
      }
    >
      {children}
    </PageShell>
  );
}
