import { type ReactNode } from "react";
import { cn } from "../utils/cn";

type NavItem = {
  label: string;
  mobileLabel?: string;
  href: string;
  active?: boolean;
};

export function PageShell({
  navItems,
  actions,
  sidebarFooter,
  children,
}: {
  navItems: NavItem[];
  actions?: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:h-screen lg:flex-row lg:overflow-hidden">
      <aside className="hidden h-full w-[296px] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[linear-gradient(180deg,#1b2432_0%,#202c3d_100%)] text-sidebar-foreground lg:flex">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon.svg"
              alt="EVCore"
              className="size-9 rounded-xl"
            />
            <p className="text-base font-bold tracking-tight text-white">
              EVCore
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
          {navItems.map((item) => (
            <a
              key={item.label}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-150",
                item.active
                  ? "bg-sidebar-muted text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                  : "text-slate-300 hover:bg-white/6 hover:text-white",
              )}
              href={item.href}
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  item.active ? "bg-cyan-300" : "bg-white/20",
                )}
              />
              {item.label}
            </a>
          ))}
        </nav>
        {sidebarFooter ? (
          <div className="border-t border-white/10 px-6 py-5">
            {sidebarFooter}
          </div>
        ) : null}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-100">
        <div className="sticky top-0 z-30 border-b border-white/70 bg-white/90 backdrop-blur supports-backdrop-filter:bg-white/75">
          <div className="hidden items-center justify-end px-5 py-3 lg:flex">
            {actions}
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <img
                src="/icons/icon.svg"
                alt="EVCore"
                className="size-7 rounded-lg"
              />
              <p className="text-sm font-bold tracking-tight text-slate-900">
                EVCore
              </p>
            </div>
            {actions}
          </div>
        </div>

        <main className="ev-grid-glow min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-4 lg:overflow-hidden lg:p-5 lg:pb-5">
          <div className="h-full w-full">{children}</div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur supports-backdrop-filter:bg-white/88 lg:hidden">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))`,
            }}
          >
            {navItems.map((item) => (
              <a
                key={item.label}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "flex min-h-15 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 text-center transition-all duration-150",
                  item.active
                    ? "bg-[linear-gradient(180deg,#1b2432_0%,#24344d_100%)] text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)]"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                )}
                href={item.href}
              >
                <span
                  className={cn(
                    "h-1.5 w-6 rounded-full",
                    item.active ? "bg-cyan-300" : "bg-slate-300",
                  )}
                />
                <span
                  className={cn(
                    "max-w-full text-[0.63rem] font-semibold leading-tight whitespace-nowrap",
                    item.active ? "text-white" : "text-slate-500",
                  )}
                >
                  {item.mobileLabel ?? item.label}
                </span>
              </a>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
