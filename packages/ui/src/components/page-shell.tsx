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
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]" />
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-300">
              EVCore
            </p>
          </div>
          <h1 className="mt-3 text-[2rem] font-semibold tracking-tight text-white">
            Console
          </h1>
          <p className="mt-2 max-w-[18rem] text-sm leading-6 text-slate-300">
            Operator workspace for fixtures, bet slips, audit, and pipeline
            control.
          </p>
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
        <div className="border-t border-white/10 px-6 py-5">
          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-slate-400">
            Visibility
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Public V1 without auth. All data will come from backend APIs.
          </p>
          {sidebarFooter ? <div className="mt-4">{sidebarFooter}</div> : null}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-100">
        <div className="sticky top-0 z-30 border-b border-white/70 bg-white/90 backdrop-blur supports-backdrop-filter:bg-white/75">
          <div className="hidden items-center justify-end px-5 py-3 lg:flex">
            {actions}
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-500 shadow-[0_0_18px_rgba(6,182,212,0.35)]" />
              <div className="min-w-0">
                <p className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  EVCore
                </p>
                <p className="truncate text-sm font-semibold text-slate-900">
                  Console mobile
                </p>
              </div>
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
