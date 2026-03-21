import { type ReactNode } from "react";
import { cn } from "../utils/cn";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
};

export function PageShell({
  navItems,
  children,
}: {
  navItems: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex h-full w-[296px] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[linear-gradient(180deg,#1b2432_0%,#202c3d_100%)] text-sidebar-foreground">
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
            Operator workspace for coupons, fixture audit, and pipeline control.
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
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
        <main className="ev-grid-glow flex-1 overflow-hidden p-5">
          <div className="h-full w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
