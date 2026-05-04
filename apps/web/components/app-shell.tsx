"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, PageShell } from "@evcore/ui";
import { GraduationCap, Settings, Wallet } from "lucide-react";
import { BetSlipButton } from "./bet-slip-button";
import { AccountButton } from "./account-button";
import { BankrollWidget } from "./bankroll-widget";
import { NotificationBell } from "./notification-bell";
import { UserAvatar } from "./user-avatar";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const currentUser = useCurrentUser();
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const isAdmin = currentUser.role === "ADMIN";

  const navItems = useMemo(
    () =>
      [
        {
          label: tNav("dashboard"),
          mobileLabel: tNav("dashboard"),
          href: "/dashboard",
          active: pathname === "/dashboard",
        },
        {
          label: tNav("fixtures"),
          href: "/dashboard/fixtures",
          active: pathname.startsWith("/dashboard/fixtures"),
        },
        {
          label: tNav("picks"),
          mobileLabel: tNav("picks"),
          href: "/dashboard/picks",
          active: pathname.startsWith("/dashboard/picks"),
        },
        {
          label: tNav("summary"),
          href: "/dashboard/summary",
          active: pathname.startsWith("/dashboard/summary"),
        },
        {
          label: tNav("formation"),
          href: "/dashboard/formation",
          active: pathname.startsWith("/dashboard/formation"),
          icon: GraduationCap,
        },
        {
          label: tNav("betSlips"),
          href: "/dashboard/bet-slips",
          active: pathname.startsWith("/dashboard/bet-slips"),
        },
        isAdmin
          ? {
              label: tNav("audit"),
              href: "/dashboard/audit",
              active: pathname === "/dashboard/audit",
            }
          : null,
        isAdmin
          ? {
              label: tNav("users"),
              href: "/dashboard/users",
              active: pathname.startsWith("/dashboard/users"),
            }
          : null,
        isAdmin
          ? {
              label: tNav("glossary"),
              href: "/dashboard/glossaire",
              active: pathname === "/dashboard/glossaire",
            }
          : null,
      ].filter((item): item is NonNullable<typeof item> => item !== null),
    [isAdmin, pathname, tNav],
  );

  const mobileNavItems = navItems.filter((item) =>
    [
      "/dashboard",
      "/dashboard/picks",
      "/dashboard/fixtures",
      "/dashboard/bet-slips",
    ].includes(item.href),
  );

  return (
    <PageShell
      navItems={navItems}
      mobileNavItems={mobileNavItems}
      actions={
        <div className="relative flex items-center gap-2">
          <BankrollWidget />
          <NotificationBell />
          <BetSlipButton />
          <AccountButton currentUser={currentUser} />
        </div>
      }
      sidebarFooter={
        <div className="rounded-2xl border border-sidebar-border/80 bg-sidebar-accent/70 p-3">
          <div className="flex items-center gap-3">
            <UserAvatar
              avatarUrl={currentUser.avatarUrl}
              username={currentUser.fullName}
              size={32}
              className="ring-1 ring-sidebar-border"
            />
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
