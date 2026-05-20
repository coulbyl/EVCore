"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { isWC2026Active } from "@/lib/events/world-cup-2026";
import { useTranslations } from "next-intl";
import {
  Badge,
  PageShell,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@evcore/ui";
import {
  GraduationCap,
  Settings,
  Trophy,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { BetSlipButton } from "./bet-slip-button";
import { AccountButton } from "./account-button";
import { BankrollWidget } from "./bankroll-widget";
import { NotificationBell } from "./notification-bell";
import { UserAvatar } from "./user-avatar";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import { useLeaderboard } from "@/domains/dashboard/use-cases/get-leaderboard";
import { useMyBadges } from "@/domains/gamification/use-cases/get-my-badges";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  OPERATOR: "Membre",
};

const BADGE_EMOJI: Record<string, string> = {
  vol_50: "🏅",
  vol_150: "🥈",
  vol_300: "🥇",
  streak_5: "⚡",
  patience: "🧘",
  calibre: "🎯",
  graduate: "🎓",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const currentUser = useCurrentUser();
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const isAdmin = currentUser.role === "ADMIN";
  const { data: leaderboard } = useLeaderboard();
  const { data: badges } = useMyBadges();

  const myLeaderboardEntry = useMemo(
    () =>
      (leaderboard ?? []).find(
        (entry) =>
          entry.username.toLowerCase() === currentUser.username.toLowerCase(),
      ) ?? null,
    [currentUser.username, leaderboard],
  );

  const unlockedBadges = useMemo(
    () => (badges ?? []).filter((badge) => badge.unlockedAt !== null),
    [badges],
  );

  const highlightedBadges = unlockedBadges.slice(0, 3);

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
          label: tNav("investissement"),
          href: "/dashboard/investment",
          active: pathname.startsWith("/dashboard/investment"),
          icon: TrendingUp,
        },
        {
          label: tNav("coupons"),
          href: "/dashboard/coupons",
          active: pathname.startsWith("/dashboard/coupons"),
        },
        {
          label: tNav("picks"),
          mobileLabel: tNav("picks"),
          href: "/dashboard/picks",
          active: pathname.startsWith("/dashboard/picks"),
        },
        {
          label: tNav("betSlips"),
          href: "/dashboard/bet-slips",
          active: pathname.startsWith("/dashboard/bet-slips"),
        },
        {
          label: tNav("summary"),
          href: "/dashboard/summary",
          active: pathname.startsWith("/dashboard/summary"),
        },
        {
          label: tNav("fixtures"),
          href: "/dashboard/fixtures",
          active: pathname.startsWith("/dashboard/fixtures"),
        },
        {
          label: tNav("wc2026"),
          href: "/dashboard/wc2026",
          active: pathname.startsWith("/dashboard/wc2026"),
        },
        {
          label: tNav("formation"),
          href: "/dashboard/formation",
          active: pathname.startsWith("/dashboard/formation"),
          icon: GraduationCap,
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
              label: tNav("announcements"),
              href: "/dashboard/announcements",
              active: pathname.startsWith("/dashboard/announcements"),
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

  const MOBILE_NAV_ORDER = [
    "/dashboard",
    "/dashboard/investment",
    "/dashboard/picks",
    "/dashboard/bet-slips",
  ];

  const mobileNavItems = MOBILE_NAV_ORDER.map((href) =>
    navItems.find((item) => item.href === href),
  ).filter((item): item is NonNullable<typeof item> => item !== undefined);

  const wc2026Active = isWC2026Active();

  return (
    <PageShell
      navItems={navItems}
      mobileNavItems={mobileNavItems}
      logoBadge={
        wc2026Active ? (
          <span className="absolute -bottom-1 -right-1 animate-pulse text-[10px]">
            🏆
          </span>
        ) : null
      }
      actions={
        <div className="relative flex items-center gap-2">
          <BankrollWidget />
          <NotificationBell />
          <BetSlipButton />
          <AccountButton currentUser={currentUser} />
        </div>
      }
      sidebarFooter={
        <div className="flex flex-col gap-3 rounded-2xl border border-sidebar-border/80 bg-sidebar-accent/70 p-3">
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
                  {ROLE_LABEL[currentUser.role] ?? currentUser.role}
                </Badge>
              </div>
              <p className="truncate text-xs text-sidebar-foreground/65">
                @{currentUser.username}
              </p>
            </div>
          </div>

          {myLeaderboardEntry ? (
            <div className="rounded-xl border border-sidebar-border/70 bg-sidebar/45 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Trophy size={13} className="shrink-0 text-warning" />
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/70">
                  Classement
                </span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-lg font-bold tabular-nums text-sidebar-foreground">
                    #{myLeaderboardEntry.rank}
                  </p>
                  <p className="text-[0.68rem] text-sidebar-foreground/65">
                    {myLeaderboardEntry.settled} coupon
                    {myLeaderboardEntry.settled > 1 ? "s" : ""} joué
                    {myLeaderboardEntry.settled > 1 ? "s" : ""}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-sidebar-border bg-sidebar text-sidebar-foreground"
                >
                  ROI {myLeaderboardEntry.roi}
                </Badge>
              </div>
            </div>
          ) : null}

          {highlightedBadges.length > 0 ? (
            <div className="rounded-xl border border-sidebar-border/70 bg-sidebar/35 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/70">
                  Mérites
                </span>
                <span className="text-[0.68rem] text-sidebar-foreground/65">
                  {unlockedBadges.length} badge
                  {unlockedBadges.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {highlightedBadges.map((badge) => (
                  <Tooltip key={badge.code}>
                    <TooltipTrigger asChild>
                      <div className="flex size-8 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sm text-sidebar-foreground">
                        {BADGE_EMOJI[badge.code] ?? "🏆"}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {badge.name}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
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
