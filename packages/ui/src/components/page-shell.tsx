import { type CSSProperties, type ReactNode } from "react";
import { cn } from "../utils/cn";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "./sidebar";

type NavItem = {
  label: string;
  mobileLabel?: string;
  href: string;
  active?: boolean;
};

export function PageShell({
  navItems,
  mobileNavItems,
  actions,
  sidebarFooter,
  children,
}: {
  navItems: NavItem[];
  mobileNavItems?: NavItem[];
  actions?: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
}) {
  const bottomNavItems = mobileNavItems ?? navItems;
  return (
    <SidebarProvider
      className="min-h-screen bg-background text-foreground lg:h-screen lg:overflow-hidden"
      style={
        {
          "--sidebar-width": "18.5rem",
          "--sidebar-width-icon": "3.25rem",
        } as CSSProperties
      }
    >
      <Sidebar
        variant="inset"
        collapsible="offcanvas"
        className="border-sidebar-border/70"
      >
        <SidebarHeader className="gap-0 border-b border-sidebar-border/70 px-4 py-5">
          <a
            href="/dashboard"
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <img
              src="/icons/icon.svg"
              alt="EVCore"
              className="size-9 rounded-xl"
            />
            <div className="min-w-0">
              <p className="text-base font-bold tracking-tight">EVCore</p>
              <p className="text-xs text-sidebar-foreground/60">
                Console de pilotage
              </p>
            </div>
          </a>
        </SidebarHeader>

        <SidebarContent className="px-3 py-4">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      isActive={item.active}
                      tooltip={item.label}
                      className="h-11 rounded-xl px-3.5"
                    >
                      <a href={item.href}>
                        <span
                          className={cn(
                            "size-2 rounded-full transition-colors",
                            item.active
                              ? "bg-sidebar-primary"
                              : "bg-sidebar-foreground/25",
                          )}
                        />
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {sidebarFooter ? (
          <>
            <SidebarSeparator />
            <SidebarFooter className="p-4">{sidebarFooter}</SidebarFooter>
          </>
        ) : null}
      </Sidebar>

      <SidebarInset className="h-dvh overflow-hidden bg-transparent">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-panel-strong/90 backdrop-blur supports-backdrop-filter:bg-panel-strong/75">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <a
                href="/dashboard"
                className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 md:hidden"
              >
                <img
                  src="/icons/icon.svg"
                  alt="EVCore"
                  className="size-7 rounded-lg"
                />
                <p className="hidden truncate text-sm font-bold tracking-tight text-foreground sm:block">
                  EVCore
                </p>
              </a>
            </div>
            {actions ? (
              <div className="flex items-center gap-2">{actions}</div>
            ) : null}
          </div>
        </header>

        <main className="ev-grid-glow min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-4 lg:p-5 lg:pb-5">
          <div className="h-full w-full">{children}</div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-panel-strong/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur supports-backdrop-filter:bg-panel-strong/88 md:hidden">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${bottomNavItems.length}, minmax(0, 1fr))`,
            }}
          >
            {bottomNavItems.map((item) => (
              <a
                key={item.label}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "flex min-h-15 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 text-center transition-all duration-150",
                  item.active
                    ? "border border-border bg-secondary text-foreground"
                    : "border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
                href={item.href}
              >
                <span
                  className={cn(
                    "h-1.5 w-6 rounded-full",
                    item.active ? "bg-accent" : "bg-border",
                  )}
                />
                <span className="max-w-full text-[0.63rem] font-semibold leading-tight whitespace-nowrap">
                  {item.mobileLabel ?? item.label}
                </span>
              </a>
            ))}
          </div>
        </nav>
      </SidebarInset>
    </SidebarProvider>
  );
}
