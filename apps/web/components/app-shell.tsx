"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { isWC2026Active } from "@/lib/events/world-cup-2026";
import { useTranslations } from "next-intl";
import { Badge, Tooltip, TooltipContent, TooltipTrigger } from "@evcore/ui";
import {
  Bell,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  ClipboardCheck,
  Cpu,
  FlaskConical,
  GraduationCap,
  History,
  Layers,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Receipt,
  Settings,
  Ticket,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { PageShell, type NavGroup } from "./page-shell";
import { BetSlipButton } from "./bet-slip-button";
import { AccountButton } from "./account-button";
import { BankrollWidget } from "./bankroll-widget";
import { NotificationBell } from "./notification-bell";
import { UserAvatar } from "./user-avatar";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import { useLeaderboard } from "@/domains/dashboard/use-cases/get-leaderboard";
import { useMyBadges } from "@/domains/gamification/use-cases/get-my-badges";
import { useUnreadCount } from "@/domains/notification/use-cases/use-notifications";
import { useUnreadSupportCount } from "@/domains/support/use-cases/use-support-chat";
import { useAdminUnreadSupportCount } from "@/domains/support/use-cases/use-admin-support";

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

export function AppShell({
  children,
  topBanner,
  headerNotice,
}: {
  children: React.ReactNode;
  topBanner?: React.ReactNode;
  headerNotice?: React.ReactNode;
}) {
  const currentUser = useCurrentUser();
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const isAdmin = currentUser.role === "ADMIN";
  const { data: leaderboard } = useLeaderboard();
  const { data: badges } = useMyBadges();
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.count ?? 0;
  const { data: operatorInboxUnread } = useUnreadSupportCount(!isAdmin);
  const { data: adminInboxUnread } = useAdminUnreadSupportCount(isAdmin);
  const inboxUnreadCount = isAdmin
    ? (adminInboxUnread?.count ?? 0)
    : (operatorInboxUnread?.count ?? 0);

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

  const navGroups = useMemo((): NavGroup[] => {
    const adminItems = isAdmin
      ? [
          {
            label: tNav("audit"),
            href: "/dashboard/audit",
            active: pathname === "/dashboard/audit",
            icon: ClipboardCheck,
          },
          {
            label: tNav("users"),
            href: "/dashboard/users",
            active: pathname.startsWith("/dashboard/users"),
            icon: Users,
          },
          {
            label: tNav("announcements"),
            href: "/dashboard/announcements",
            active: pathname.startsWith("/dashboard/announcements"),
            icon: Megaphone,
          },
          {
            label: tNav("ml"),
            href: "/dashboard/ml",
            active: pathname.startsWith("/dashboard/ml"),
            icon: BrainCircuit,
          },
          {
            label: tNav("reports"),
            href: "/dashboard/reports",
            active: pathname.startsWith("/dashboard/reports"),
            icon: FlaskConical,
          },
          {
            label: tNav("engine"),
            href: "/dashboard/engine",
            active: pathname.startsWith("/dashboard/engine"),
            icon: Cpu,
          },
          {
            label: tNav("glossary"),
            href: "/dashboard/glossaire",
            active: pathname === "/dashboard/glossaire",
            icon: BookOpen,
          },
        ]
      : [];

    return [
      {
        items: [
          {
            label: tNav("dashboard"),
            mobileLabel: tNav("dashboard"),
            href: "/dashboard",
            active: pathname === "/dashboard",
            icon: LayoutDashboard,
          },
        ],
      },
      {
        label: tNav("navGroupToday"),
        items: [
          {
            label: tNav("decisions"),
            mobileLabel: tNav("decisionsShort"),
            href: "/dashboard/decisions",
            active: pathname.startsWith("/dashboard/decisions"),
            icon: Layers,
          },
          {
            label: tNav("investment"),
            href: "/dashboard/investment",
            active: pathname.startsWith("/dashboard/investment"),
            icon: TrendingUp,
            featured: true,
          },
          {
            label: tNav("coupons"),
            href: "/dashboard/coupons",
            active: pathname.startsWith("/dashboard/coupons"),
            icon: Ticket,
          },
          {
            label: tNav("fixtures"),
            href: "/dashboard/fixtures",
            active: pathname.startsWith("/dashboard/fixtures"),
            icon: CalendarDays,
          },
        ],
      },
      {
        label: tNav("navGroupTracking"),
        items: [
          {
            label: tNav("betSlips"),
            href: "/dashboard/bet-slips",
            active: pathname.startsWith("/dashboard/bet-slips"),
            icon: Receipt,
          },
          {
            label: tNav("inbox"),
            href: "/dashboard/inbox",
            active: pathname.startsWith("/dashboard/inbox"),
            icon: MessageCircle,
            badge: inboxUnreadCount,
          },
        ],
      },
      {
        label: tNav("navGroupAnalysis"),
        items: [
          {
            label: tNav("formation"),
            href: "/dashboard/formation",
            active: pathname.startsWith("/dashboard/formation"),
            icon: GraduationCap,
          },
          {
            label: tNav("trackRecord"),
            href: "/dashboard/track-record",
            active: pathname.startsWith("/dashboard/track-record"),
            icon: History,
          },
        ],
      },
      ...(adminItems.length > 0
        ? [{ label: tNav("navGroupAdmin"), items: adminItems }]
        : []),
    ];
  }, [isAdmin, pathname, tNav, inboxUnreadCount]);

  const pinnedNavItems = useMemo(
    () => [
      {
        label: tNav("notifications"),
        href: "/dashboard/notifications",
        active: pathname.startsWith("/dashboard/notifications"),
        icon: Bell,
        badge: unreadCount,
      },
    ],
    [pathname, tNav, unreadCount],
  );

  const pageTitle = useMemo(
    () => navGroups.flatMap((g) => g.items).find((item) => item.active)?.label,
    [navGroups],
  );

  const MOBILE_NAV_ORDER = [
    "/dashboard",
    "/dashboard/decisions",
    "/dashboard/investment",
    "/dashboard/coupons",
    "/dashboard/formation",
  ];

  const allNavItems = useMemo(
    () => navGroups.flatMap((g) => g.items),
    [navGroups],
  );

  const mobileNavItems = MOBILE_NAV_ORDER.map((href) =>
    allNavItems.find((item) => item.href === href),
  ).filter((item): item is NonNullable<typeof item> => item !== undefined);

  const wc2026Active = isWC2026Active();

  return (
    <PageShell
      navGroups={navGroups}
      pinnedNavItems={pinnedNavItems}
      mobileNavItems={mobileNavItems}
      pageTitle={pageTitle}
      topBanner={topBanner}
      headerNotice={headerNotice}
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
        <div className="flex flex-col gap-2">
          {/* User identity row */}
          <div className="flex items-center gap-3 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/50 px-3 py-2.5">
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
                  variant="neutral"
                  className="shrink-0 text-[0.62rem] text-sidebar-foreground/80"
                >
                  {ROLE_LABEL[currentUser.role] ?? currentUser.role}
                </Badge>
              </div>
              <p className="truncate text-xs text-sidebar-foreground/60">
                @{currentUser.username}
              </p>
            </div>
            <Link
              href="/dashboard/params/account"
              title="Paramètres du compte"
              className="shrink-0 rounded-lg p-1.5 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Settings size={15} />
            </Link>
          </div>

          {/* Stats row: rank + badges */}
          {(myLeaderboardEntry || highlightedBadges.length > 0) && (
            <div className="flex items-center gap-3 px-1">
              {myLeaderboardEntry && (
                <div className="flex items-center gap-1.5 text-xs text-sidebar-foreground/65">
                  <Trophy size={12} className="shrink-0 text-warning" />
                  <span className="font-semibold tabular-nums">
                    #{myLeaderboardEntry.rank}
                  </span>
                  <span className="text-sidebar-foreground/35">·</span>
                  <span>{myLeaderboardEntry.roi}</span>
                </div>
              )}
              {highlightedBadges.length > 0 && (
                <div className="ml-auto flex items-center gap-1">
                  {highlightedBadges.map((badge) => (
                    <Tooltip key={badge.code}>
                      <TooltipTrigger asChild>
                        <span className="cursor-default text-sm">
                          {BADGE_EMOJI[badge.code] ?? "🏆"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {badge.name}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      }
    >
      {children}
    </PageShell>
  );
}
