"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@evcore/ui";
import { Bell, LayoutDashboard, MessageCircle, Settings } from "lucide-react";
import { PageShell, type NavGroup } from "./page-shell";
import { AccountButton } from "./account-button";
import { NotificationBell } from "./notification-bell";
import { PageSearchButton } from "./page-search/page-search-fab";
import { UserAvatar } from "./user-avatar";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import { useUnreadCount } from "@/domains/notification/use-cases/use-notifications";
import { useUnreadSupportCount } from "@/domains/support/use-cases/use-support-chat";
import { useAdminUnreadSupportCount } from "@/domains/support/use-cases/use-admin-support";

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
  // Same source as the Profil page's role badge (profile-hero-section.tsx)
  // — was a separate hardcoded { OPERATOR: "Membre" } map here, "Opérateur"
  // there, TODO.md's "badge de rôle incohérent" for the same account.
  const tAccount = useTranslations("account");
  const isAdmin = currentUser.role === "ADMIN";
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.count ?? 0;
  const { data: operatorInboxUnread } = useUnreadSupportCount(!isAdmin);
  const { data: adminInboxUnread } = useAdminUnreadSupportCount(isAdmin);
  const inboxUnreadCount = isAdmin
    ? (adminInboxUnread?.count ?? 0)
    : (operatorInboxUnread?.count ?? 0);

  // What is left of /dashboard after the admin's overhaul (12-admin.md
  // § 0): the support inbox and the diagnostic sheet, reached from the
  // admin's screens; the rest redirects (helpers/retired-routes.ts).
  const navGroups = useMemo(
    (): NavGroup[] => [
      {
        label: tNav("navGroupAdmin"),
        items: [
          {
            label: tNav("admin"),
            mobileLabel: tNav("admin"),
            href: "/admin",
            active: false,
            icon: LayoutDashboard,
          },
          {
            label: tNav("inbox"),
            mobileLabel: tNav("inbox"),
            href: "/dashboard/inbox",
            active: pathname.startsWith("/dashboard/inbox"),
            icon: MessageCircle,
            badge: inboxUnreadCount,
          },
        ],
      },
    ],
    [pathname, tNav, inboxUnreadCount],
  );

  const pinnedNavItems = useMemo(
    () => [
      {
        label: tNav("notifications"),
        href: "/notifications",
        active: false,
        icon: Bell,
        badge: unreadCount,
      },
    ],
    [tNav, unreadCount],
  );

  const pageTitle = useMemo(
    () => navGroups.flatMap((g) => g.items).find((item) => item.active)?.label,
    [navGroups],
  );

  const MOBILE_NAV_ORDER = ["/admin", "/dashboard/inbox"];

  const allNavItems = useMemo(
    () => navGroups.flatMap((g) => g.items),
    [navGroups],
  );

  const mobileNavItems = MOBILE_NAV_ORDER.map((href) =>
    allNavItems.find((item) => item.href === href),
  ).filter((item): item is NonNullable<typeof item> => item !== undefined);

  return (
    <PageShell
      navGroups={navGroups}
      pinnedNavItems={pinnedNavItems}
      mobileNavItems={mobileNavItems}
      pageTitle={pageTitle}
      topBanner={topBanner}
      headerNotice={headerNotice}
      actions={
        <div className="relative flex items-center gap-1.5 sm:gap-2">
          <PageSearchButton />
          <NotificationBell />
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
                {/* Rôle affiché aux seuls admins : « Opérateur » se lit
                    « bookmaker » chez un parieur (revue UX du 2026-10-27). */}
                {isAdmin ? (
                  <Badge
                    variant="neutral"
                    className="shrink-0 text-xs text-sidebar-foreground/80"
                  >
                    {tAccount("roles.ADMIN")}
                  </Badge>
                ) : null}
              </div>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {currentUser.username
                  ? `@${currentUser.username}`
                  : currentUser.email}
              </p>
            </div>
            <Link
              href="/me/account"
              title="Paramètres du compte"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Settings size={15} />
            </Link>
          </div>
        </div>
      }
    >
      {children}
    </PageShell>
  );
}
