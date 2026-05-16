import type { Metadata } from "next";
import Link from "next/link";
import {
  daysUntilWC2026,
  isWC2026Active,
  isWC2026Countdown,
  WC2026,
} from "@/lib/events/world-cup-2026";

export const metadata: Metadata = {
  title: "Coupe du Monde 2026 — EVCore",
};

const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const STATS = [
  { label: "Équipes", value: "48" },
  { label: "Groupes", value: "12" },
  { label: "Matchs", value: "104" },
  { label: "Pays hôtes", value: "3" },
];

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

  if (countdown) {
    const days = daysUntilWC2026(now);
    return (
      <div className="mx-auto max-w-2xl space-y-10 py-12">
        {/* Countdown hero */}
        <div className="rounded-2xl border border-[#c9a84c]/30 bg-[#0a0f1e]/60 p-8 text-center">
          <p
            className="text-6xl"
            style={{ animation: "wc2026-trophy-glow 2.4s ease-in-out infinite" }}
          >
            🏆
          </p>
          <h1 className="mt-4 text-2xl font-bold text-[#c9a84c]">
            Coupe du Monde 2026
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            11 juin – 19 juillet 2026 · USA 🇺🇸 Canada 🇨🇦 Mexique 🇲🇽
          </p>

          <div className="mt-8 inline-flex flex-col items-center rounded-2xl border border-[#c9a84c]/40 bg-[#c9a84c]/10 px-10 py-6">
            <span className="text-6xl font-bold tabular-nums text-[#c9a84c]">
              {days}
            </span>
            <span className="mt-1 text-sm font-medium text-[#c9a84c]/80">
              {days === 1 ? "jour" : "jours"} avant le coup d&apos;envoi
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-panel p-4 text-center"
            >
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Groupes */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            12 groupes
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
            {GROUPS.map((g) => (
              <div
                key={g}
                className="flex h-10 items-center justify-center rounded-lg border border-border bg-panel text-sm font-semibold text-foreground"
              >
                {g}
              </div>
            ))}
          </div>
        </div>

        {/* Activation reminder */}
        <div className="rounded-xl border border-border bg-panel p-4 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Activation</span>{" "}
            — La compétition sera activée 7 jours avant le coup d&apos;envoi.
            EVCore commencera à générer des picks WC26 à partir du{" "}
            <span className="font-medium text-foreground">4 juin 2026</span>.
          </p>
        </div>
      </div>
    );
  }

  // Tournament active — show links to filtered picks and coupons
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-10">
      <div className="rounded-2xl border border-[#c9a84c]/30 bg-[#0a0f1e]/60 p-6 text-center">
        <p className="text-5xl">🏆</p>
        <h1 className="mt-4 text-2xl font-bold text-[#c9a84c]">
          Coupe du Monde 2026
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tournoi en cours · picks EVCore actifs
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/dashboard/picks?competition=WC26"
          className="flex flex-col gap-1 rounded-xl border border-border bg-panel p-5 transition-colors hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5"
        >
          <span className="text-xl">🎯</span>
          <span className="font-semibold">Picks WC26</span>
          <span className="text-sm text-muted-foreground">
            Toutes les analyses du modèle pour les matchs en cours
          </span>
        </Link>

        <Link
          href="/dashboard/coupons"
          className="flex flex-col gap-1 rounded-xl border border-border bg-panel p-5 transition-colors hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5"
        >
          <span className="text-xl">📋</span>
          <span className="font-semibold">Coupons générés</span>
          <span className="text-sm text-muted-foreground">
            Coupons du moteur IA incluant des legs WC26
          </span>
        </Link>
      </div>
    </div>
  );
}
