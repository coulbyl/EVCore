"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { PageShell } from "@evcore/ui";
import { BetSlipButton } from "./bet-slip-button";
import { AccountButton } from "./account-button";
import type { AuthSessionUser } from "@/domains/auth/types/auth";

export function AppShell({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser: AuthSessionUser;
}) {
  const pathname = usePathname();
  const isAdmin = currentUser.role === "ADMIN";

  const navItems = useMemo(
    () =>
      [
        {
          label: "Tableau de bord",
          mobileLabel: "Accueil",
          href: "/dashboard",
          active: pathname === "/dashboard",
        },
        {
          label: "Matchs",
          href: "/dashboard/fixtures",
          active: pathname.startsWith("/dashboard/fixtures"),
        },
        {
          label: "Mes tickets",
          href: "/dashboard/bet-slips",
          active: pathname.startsWith("/dashboard/bet-slips"),
        },
        isAdmin
          ? {
              label: "Audit",
              href: "/dashboard/audit",
              active: pathname === "/dashboard/audit",
            }
          : null,
        isAdmin
          ? {
              label: "Glossaire",
              href: "/dashboard/glossaire",
              active: pathname === "/dashboard/glossaire",
            }
          : null,
      ].filter((item): item is NonNullable<typeof item> => item !== null),
    [isAdmin, pathname],
  );

  return (
    <PageShell
      navItems={navItems}
      actions={
        <div className="flex items-center gap-2 relative">
          <BetSlipButton />
          <AccountButton currentUser={currentUser} />
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
