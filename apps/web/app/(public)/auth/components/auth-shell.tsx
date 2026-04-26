import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  asideTitle,
  asideText,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  asideTitle: string;
  asideText: string;
}) {
  return (
    <main className="min-h-dvh overflow-hidden bg-sidebar px-4 py-4 sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,hsl(var(--accent)/0.16)_0%,transparent_72%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(hsl(var(--sidebar-foreground)/0.025)_1px,transparent_1px)] [background-size:30px_30px]" />

      <div className="relative mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl overflow-hidden rounded-[1.4rem] bg-panel/95 shadow-[0_24px_80px_rgba(2,8,23,0.35)] backdrop-blur lg:grid-cols-[minmax(0,1.1fr)_420px]">
        <section className="flex flex-col justify-between bg-[linear-gradient(180deg,hsl(var(--sidebar))_0%,hsl(var(--panel-strong))_100%)] px-6 py-8 text-sidebar-foreground sm:px-8 sm:py-10">
          <div className="max-w-xl">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-accent">
              EVCore
            </p>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-sidebar-foreground sm:text-4xl">
              {asideTitle}
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-sidebar-foreground/75 sm:text-base">
              {asideText}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-2.5">
            {["Coupons suivis", "Matchs du jour"].map((label) => (
              <span
                key={label}
                className="inline-flex min-h-10 items-center rounded-full border border-sidebar-border bg-sidebar-foreground/8 px-4 text-xs font-medium text-sidebar-foreground/85"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="mt-8 hidden border-t border-sidebar-border pt-6 lg:block">
            <p className="max-w-md text-sm leading-7 text-sidebar-foreground/65">
              Un accès simple pour se connecter, retrouver ses coupons et
              reprendre la journée sans détour.
            </p>
          </div>
        </section>

        <section className="flex flex-col justify-center bg-[linear-gradient(180deg,hsl(var(--panel))_0%,hsl(var(--background))_100%)] px-5 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-sm">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Authentification
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {subtitle}
            </p>
            <div className="mt-8 rounded-[1rem] border border-border bg-panel px-4 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:px-5">
              {children}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
