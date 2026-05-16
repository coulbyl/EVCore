import type { Metadata } from "next";
import Link from "next/link";
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
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-4xl">🏆</p>
        <p className="text-lg font-semibold">Coupe du Monde 2026</p>
        <p className="text-sm text-muted-foreground">
          La compétition débute le{" "}
          {WC2026.start.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          .
        </p>
        <Link
          href="/dashboard"
          className="mt-2 text-sm text-accent underline underline-offset-2"
        >
          ← Retour au dashboard
        </Link>
      </div>
    );
  }

  const days = countdown ? daysUntilWC2026(now) : 0;

  return (
    <div className="space-y-6 pb-28 pt-4">
      {/* Hero compact */}
      <div className="rounded-2xl border border-[#c9a84c]/30 bg-[#0a0f1e]/60 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[#c9a84c]">
              🏆 Coupe du Monde 2026
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              11 juin – 19 juillet 2026 · USA 🇺🇸 Canada 🇨🇦 Mexique 🇲🇽
            </p>
          </div>
          {countdown ? (
            <div className="shrink-0 text-right">
              <p className="text-3xl font-bold tabular-nums text-[#c9a84c]">
                {days}
              </p>
              <p className="text-[0.6rem] font-medium text-[#c9a84c]/70">
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

      {/* Live standings — client component fetches from /standings */}
      <WC2026Groups />

      {/* Links (visible during tournament) */}
      {active ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/dashboard/picks?competition=WC26"
            className="flex flex-col gap-1 rounded-xl border border-border bg-panel p-4 transition-colors hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5"
          >
            <span className="text-lg">🎯</span>
            <span className="text-sm font-semibold">Picks WC26</span>
            <span className="text-xs text-muted-foreground">
              Analyses du modèle pour les matchs en cours
            </span>
          </Link>
          <Link
            href="/dashboard/coupons"
            className="flex flex-col gap-1 rounded-xl border border-border bg-panel p-4 transition-colors hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5"
          >
            <span className="text-lg">📋</span>
            <span className="text-sm font-semibold">Coupons générés</span>
            <span className="text-xs text-muted-foreground">
              Coupons IA incluant des legs WC26
            </span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
