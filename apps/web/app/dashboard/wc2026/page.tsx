import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageContent } from "@evcore/ui";
import {
  daysUntilWC2026,
  isWC2026Active,
  isWC2026Countdown,
  WC2026,
} from "@/lib/events/world-cup-2026";
import { WC2026Groups } from "@/components/events/wc2026/wc2026-groups";

export const metadata: Metadata = {
  title: "Coupe du Monde 2026 — EVCore",
};

export default function WC2026Page() {
  const now = new Date();
  const active = isWC2026Active(now);
  const countdown = isWC2026Countdown(now);

  if (!active && !countdown) {
    return (
      <Page className="flex h-full flex-col">
        <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <span className="inline-flex size-16 items-center justify-center rounded-[1.4rem] border border-[#c9a84c]/30 bg-[#c9a84c]/10 text-3xl">
              🏆
            </span>
            <div>
              <p className="text-lg font-semibold text-foreground">
                Coupe du Monde 2026
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                La compétition débute le{" "}
                {WC2026.start.toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                .
              </p>
            </div>
            <Link
              href="/dashboard"
              className="mt-1 text-sm text-accent hover:underline underline-offset-2"
            >
              ← Retour au dashboard
            </Link>
          </div>
        </PageContent>
      </Page>
    );
  }

  const days = countdown ? daysUntilWC2026(now) : 0;

  return (
    <Page className="flex h-full flex-col">
      <div className="sticky top-0 z-20 mb-3 shrink-0 backdrop-blur supports-backdrop-filter:bg-panel-strong/95 sm:mb-4">
        <div className="rounded-[1.8rem] border border-[#c9a84c]/30 bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.10)_0%,transparent_70%)] px-4 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)] sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[#c9a84c]">🏆</span>
                <h1 className="text-base font-bold text-[#c9a84c] sm:text-lg">
                  Coupe du Monde 2026
                </h1>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                11 juin – 19 juillet 2026 · USA 🇺🇸 Canada 🇨🇦 Mexique 🇲🇽
              </p>
            </div>
            {countdown ? (
              <div className="shrink-0 rounded-[1rem] border border-[#c9a84c]/30 bg-[#c9a84c]/10 px-4 py-2 text-right">
                <p className="text-2xl font-bold tabular-nums text-[#c9a84c] sm:text-3xl">
                  {days}
                </p>
                <p className="text-[0.62rem] font-medium uppercase tracking-[0.18em] text-[#c9a84c]/70">
                  {days === 1 ? "jour" : "jours"}
                </p>
              </div>
            ) : (
              <span className="shrink-0 rounded-full border border-[#c9a84c]/40 bg-[#c9a84c]/10 px-3 py-1 text-xs font-semibold text-[#c9a84c]">
                En cours
              </span>
            )}
          </div>
        </div>
      </div>

      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5 pb-6">
          {/* Quick links during tournament */}
          {active ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/dashboard/picks?competition=WC26"
                className="bento-cell-interactive flex flex-col gap-2 p-4"
              >
                <span className="inline-flex size-9 items-center justify-center rounded-xl border border-[#c9a84c]/30 bg-[#c9a84c]/10 text-lg">
                  🎯
                </span>
                <p className="text-sm font-semibold text-foreground">
                  Picks WC26
                </p>
                <p className="text-xs text-muted-foreground">
                  Analyses du modèle pour les matchs en cours
                </p>
              </Link>
              <Link
                href="/dashboard/coupons"
                className="bento-cell-interactive flex flex-col gap-2 p-4"
              >
                <span className="inline-flex size-9 items-center justify-center rounded-xl border border-[#c9a84c]/30 bg-[#c9a84c]/10 text-lg">
                  📋
                </span>
                <p className="text-sm font-semibold text-foreground">
                  Coupons générés
                </p>
                <p className="text-xs text-muted-foreground">
                  Coupons IA incluant des legs WC26
                </p>
              </Link>
            </div>
          ) : null}

          {/* Groups grid */}
          <section className="rounded-[1.6rem] border border-border bg-panel-strong p-4 shadow-[0_16px_44px_rgba(15,23,42,0.08)] sm:p-5">
            <p className="mb-4 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Classements de groupe
            </p>
            <WC2026Groups />
          </section>
        </div>
      </PageContent>
    </Page>
  );
}
