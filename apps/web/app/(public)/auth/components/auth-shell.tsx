import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, TrendingUp, Target } from "lucide-react";

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Sélection quotidienne",
    body: "Le moteur analyse les matchs et identifie les picks à valeur positive, canal par canal.",
  },
  {
    icon: BarChart3,
    title: "Indice de paris",
    body: "Taux de réussite et ROI par marché et tranche de cote — pour arbitrer entre vos sélections.",
  },
  {
    icon: Target,
    title: "Suivi de résultats",
    body: "Historique complet par canal avec performance réelle, consultable à tout moment.",
  },
];

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
    <main className="relative flex min-h-dvh items-start justify-center bg-background px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:items-center lg:py-12">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,hsl(var(--accent)/0.14)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(hsl(var(--foreground)/0.03)_1px,transparent_1px)] [background-size:28px_28px]" />

      <div className="relative w-full max-w-[900px]">
        {/* Card container — visible at md+ */}
        <div className="md:grid md:min-h-[640px] md:grid-cols-2 md:overflow-hidden md:rounded-[1.6rem] md:border md:border-border md:bg-panel-strong md:shadow-[0_24px_72px_rgba(2,8,23,0.16)]">
          {/* ── Aside (left) ── tablet+ */}
          <section className="hidden flex-col justify-between bg-sidebar px-8 py-10 text-sidebar-foreground md:flex lg:px-10 lg:py-12">
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.34em] text-accent">
                EVCore
              </p>
              <h1 className="mt-5 text-xl font-semibold leading-snug tracking-tight text-sidebar-foreground lg:text-[1.35rem]">
                {asideTitle}
              </h1>
              <p className="mt-3 max-w-xs text-sm leading-7 text-sidebar-foreground/60">
                {asideText}
              </p>
            </div>

            <div className="mt-10 grid gap-2.5">
              {FEATURES.map(({ icon: Icon, title: featureTitle, body }) => (
                <div
                  key={featureTitle}
                  className="flex items-start gap-3 rounded-xl border border-sidebar-border/40 bg-sidebar-foreground/[0.04] px-4 py-3"
                >
                  <Icon className="mt-0.5 size-[15px] shrink-0 text-accent" />
                  <div>
                    <p className="text-[0.8rem] font-semibold leading-snug text-sidebar-foreground">
                      {featureTitle}
                    </p>
                    <p className="mt-0.5 text-[0.75rem] leading-5 text-sidebar-foreground/55">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-8 border-t border-sidebar-border/30 pt-5 text-[0.7rem] leading-relaxed text-sidebar-foreground/35">
              Accès sécurisé · Données chiffrées
            </p>
          </section>

          {/* ── Form area (right) ── */}
          <section className="flex flex-col justify-center md:px-8 md:py-10 lg:px-10">
            <div className="mx-auto w-full max-w-sm">
              {/* Mobile-only branding */}
              <div className="mb-7 md:hidden">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.32em] text-muted-foreground/60">
                  EVCore
                </p>
              </div>

              <h2 className="text-[1.45rem] font-semibold tracking-tight text-foreground">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {subtitle}
              </p>

              <div className="mt-8">{children}</div>

              <p className="mt-10 text-center text-xs text-muted-foreground/40">
                <Link
                  href="/"
                  className="transition-colors hover:text-muted-foreground/70"
                >
                  ← Retour à l&apos;accueil
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
