"use client";

import Link from "next/link";
import { type CSSProperties, type ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@evcore/ui/cn";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@evcore/ui";
import type { LucideIcon } from "lucide-react";

function SidebarAutoClose() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);
  return null;
}

export type NavItem = {
  label: string;
  mobileLabel?: string;
  href: string;
  active?: boolean;
  icon?: LucideIcon;
  badge?: number;
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

export function PageShell({
  navGroups,
  pinnedNavItems,
  mobileNavItems,
  actions,
  sidebarFooter,
  logoBadge,
  children,
}: {
  navGroups: NavGroup[];
  pinnedNavItems?: NavItem[];
  mobileNavItems?: NavItem[];
  actions?: ReactNode;
  sidebarFooter?: ReactNode;
  logoBadge?: ReactNode;
  pageTitle?: string;
  children: ReactNode;
}) {
  const allNavItems = navGroups.flatMap((g) => g.items);
  const bottomNavItems = mobileNavItems ?? allNavItems;

  return (
    <SidebarProvider
      className="overflow-hidden bg-background text-foreground"
      style={
        {
          "--sidebar-width": "18.5rem",
          "--sidebar-width-icon": "3.25rem",
        } as CSSProperties
      }
    >
      <SidebarAutoClose />
      <Sidebar
        variant="inset"
        collapsible="offcanvas"
        className="border-sidebar-border/70"
      >
        <SidebarHeader className="gap-0 border-b border-sidebar-border/70 px-4 py-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <div className="relative shrink-0">
              <img
                src="/icons/icon.svg"
                alt="EVCore"
                className="size-9 rounded-xl"
              />
              {logoBadge}
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold tracking-tight">EVCore</p>
              <p className="text-xs text-sidebar-foreground/60">
                Console de pilotage
              </p>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent className="overflow-x-hidden px-3 py-4">
          {navGroups.flatMap((group, i) => [
            i > 0 ? (
              <SidebarSeparator key={`sep-${i}`} className="my-1" />
            ) : null,
            <SidebarGroup key={i} className="p-0">
              {group.label && (
                <SidebarGroupLabel className="px-3.5 pb-1 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/40">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.active}
                        tooltip={item.label}
                        className="h-9 rounded-lg px-3"
                      >
                        <Link href={item.href}>
                          {item.icon && (
                            <item.icon
                              size={16}
                              className="shrink-0 text-accent"
                            />
                          )}
                          <span className="flex-1">{item.label}</span>
                          {item.badge != null && item.badge > 0 && (
                            <span className="ml-auto inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-bold tabular-nums text-destructive-foreground">
                              {item.badge > 99 ? "99+" : item.badge}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>,
          ])}
        </SidebarContent>

        {pinnedNavItems?.length || sidebarFooter ? (
          <>
            <SidebarSeparator />
            <SidebarFooter className="gap-0 px-3 pt-3 pb-4">
              {pinnedNavItems?.length ? (
                <>
                  <SidebarMenu className="mb-2">
                    {pinnedNavItems.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.active}
                          tooltip={item.label}
                          className="h-9 rounded-lg px-3"
                        >
                          <Link href={item.href}>
                            {item.icon && (
                              <item.icon
                                size={16}
                                className="shrink-0 text-accent"
                              />
                            )}
                            <span className="flex-1">{item.label}</span>
                            {item.badge != null && item.badge > 0 && (
                              <span className="ml-auto inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-bold tabular-nums text-destructive-foreground">
                                {item.badge > 99 ? "99+" : item.badge}
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                  {sidebarFooter && <SidebarSeparator className="mb-3" />}
                </>
              ) : null}
              {sidebarFooter}
            </SidebarFooter>
          </>
        ) : null}
      </Sidebar>

      <SidebarInset className="h-dvh overflow-hidden bg-transparent">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-panel-strong/90 backdrop-blur supports-backdrop-filter:bg-panel-strong/75">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="lg:hidden size-9 rounded-xl border border-border bg-panel-strong text-muted-foreground hover:bg-secondary hover:text-foreground" />
              <Link
                href="/dashboard"
                className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 lg:hidden"
              >
                <div className="relative shrink-0">
                  <img
                    src="/icons/icon.svg"
                    alt="EVCore"
                    className="size-7 rounded-lg"
                  />
                  {logoBadge}
                </div>
              </Link>
            </div>
            {actions ? (
              <div className="flex items-center gap-2">{actions}</div>
            ) : null}
          </div>
        </header>

        <main className="ev-grid-glow min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pt-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-4 md:pb-4 lg:px-5 lg:pt-5 lg:pb-5">
          <div className="mx-auto h-full w-full 2xl:max-w-[1800px]">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-panel-strong/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur supports-backdrop-filter:bg-panel-strong/88 md:hidden">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${bottomNavItems.length}, minmax(0, 1fr))`,
            }}
          >
            {bottomNavItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-15 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 text-center transition-all duration-150",
                  item.active
                    ? "border border-border bg-secondary text-foreground"
                    : "border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <span className="relative">
                  {item.icon ? (
                    <item.icon size={18} className="text-accent" />
                  ) : (
                    <span
                      className={cn(
                        "h-1.5 w-6 rounded-full",
                        item.active ? "bg-accent" : "bg-border",
                      )}
                    />
                  )}
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[0.55rem] font-bold tabular-nums text-destructive-foreground">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full text-[0.63rem] font-semibold leading-tight whitespace-nowrap">
                  {item.mobileLabel ?? item.label}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      </SidebarInset>
    </SidebarProvider>
  );
}
