"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, Badge, PageShell } from "@evcore/ui";
import { Settings, Wallet } from "lucide-react";
import { BetSlipButton } from "./bet-slip-button";
import { AccountButton } from "./account-button";
import { BankrollWidget } from "./bankroll-widget";
import type { AuthSessionUser } from "@/domains/auth/types/auth";

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? "?").toUpperCase();
  return (
    (parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")
  ).toUpperCase();
}

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
          label: "Mes coupons",
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
        <div className="relative flex items-center gap-2">
          <BankrollWidget />
          <BetSlipButton />
          <AccountButton currentUser={currentUser} />
        </div>
      }
      sidebarFooter={
        <div className="rounded-2xl border border-sidebar-border/80 bg-sidebar-accent/70 p-3">
          <div className="flex items-center gap-3">
            <Avatar className="ring-1 ring-sidebar-border">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-[0.72rem] font-bold">
                {getInitials(currentUser.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                  {currentUser.fullName}
                </p>
                <Badge
                  variant="outline"
                  className="border-sidebar-border bg-sidebar/40 text-[0.62rem] text-sidebar-foreground"
                >
                  {currentUser.role === "ADMIN" ? "Admin" : "Membre"}
                </Badge>
              </div>
              <p className="truncate text-xs text-sidebar-foreground/65">
                @{currentUser.username}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href="/dashboard/bankroll"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-sidebar-border/70 bg-sidebar/40 px-3 py-2 text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar/70"
            >
              <Wallet size={14} />
              Portefeuille
            </Link>
            <Link
              href="/dashboard/params/account"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-sidebar-border/70 bg-sidebar/40 px-3 py-2 text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar/70"
            >
              <Settings size={14} />
              Compte
            </Link>
          </div>
        </div>
      }
    >
      {children}
    </PageShell>
  );
}
