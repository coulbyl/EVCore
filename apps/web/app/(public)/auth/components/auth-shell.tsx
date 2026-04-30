import type { ReactNode } from "react";
import { BarChart3, ReceiptText, Wallet } from "lucide-react";

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
    <main className="relative min-h-dvh overflow-hidden bg-background px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-12%,hsl(var(--accent)/0.16)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(hsl(var(--foreground)/0.035)_1px,transparent_1px)] [background-size:28px_28px]" />

      <div className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-[1.6rem] border border-border bg-panel-strong/90 shadow-[0_24px_80px_rgba(2,8,23,0.22)] backdrop-blur lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,1.1fr)_420px]">
        <section className="hidden flex-col justify-between bg-[linear-gradient(180deg,hsl(var(--sidebar))_0%,hsl(var(--panel-strong))_100%)] px-8 py-10 text-sidebar-foreground lg:flex">
          <div className="max-w-xl">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-accent">
              EVCore
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-sidebar-foreground">
              {asideTitle}
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-7 text-sidebar-foreground/75">
              {asideText}
            </p>
          </div>

          <div className="mt-8 grid gap-2">
            <div className="flex items-start gap-3 rounded-2xl border border-sidebar-border/80 bg-sidebar-foreground/6 px-4 py-3">
              <ReceiptText className="mt-0.5 size-4 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-semibold text-sidebar-foreground">
                  Coupons au même endroit
                </p>
                <p className="mt-0.5 text-sm leading-6 text-sidebar-foreground/70">
                  Retrouvez rapidement vos sélections et leur statut.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-sidebar-border/80 bg-sidebar-foreground/6 px-4 py-3">
              <Wallet className="mt-0.5 size-4 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-semibold text-sidebar-foreground">
                  Portefeuille clair
                </p>
                <p className="mt-0.5 text-sm leading-6 text-sidebar-foreground/70">
                  Suivez vos dépôts et mouvements simplement.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-sidebar-border/80 bg-sidebar-foreground/6 px-4 py-3">
              <BarChart3 className="mt-0.5 size-4 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-semibold text-sidebar-foreground">
                  Indicateurs lisibles
                </p>
                <p className="mt-0.5 text-sm leading-6 text-sidebar-foreground/70">
                  Des chiffres utiles, sans jargon.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-8 border-t border-sidebar-border pt-6 text-sm leading-7 text-sidebar-foreground/65">
            Connectez-vous ou créez un compte en moins d’une minute.
          </p>
        </section>

        <section className="flex flex-col justify-center bg-[linear-gradient(180deg,hsl(var(--panel))_0%,hsl(var(--background))_100%)] px-5 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-sm">
            <div className="lg:hidden">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                EVCore
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Accès à votre compte
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {subtitle}
            </p>
            <div className="mt-8 rounded-[1.1rem] border border-border bg-panel px-4 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:px-5">
              {children}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
