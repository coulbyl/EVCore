"use client";

import Link from "next/link";
import {
  TrendingUp,
  Target,
  Shield,
  BarChart2,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

const STATS = [
  { label: "Brier Score", value: "0.592", sub: "seuil PASS < 0.65" },
  { label: "ROI simulé", value: "+2.28%", sub: "3 saisons EPL" },
  { label: "Calibration", value: "2.5%", sub: "erreur moyenne" },
  { label: "Fixtures analysées", value: "760", sub: "données vérifiées" },
];

const FEATURES = [
  {
    icon: BarChart2,
    title: "Scoring déterministe 70 %",
    body: "Forme récente, xG, volatilité de ligue, domicile/extérieur. Des données, pas des opinions.",
  },
  {
    icon: Target,
    title: "Expected Value uniquement",
    body: "EV ≥ 0.08 comme seul critère d'entrée. Le système n'ouvre pas une position sans avantage mathématique.",
  },
  {
    icon: Shield,
    title: "Gestion du risque intégrée",
    body: "Suspension automatique à ROI < −15% sur 50 bets. Calibration hebdomadaire des poids par marché.",
  },
  {
    icon: TrendingUp,
    title: "Audit complet",
    body: "Chaque analyse est tracée — score, features, décision. Vous savez exactement pourquoi un bet a été retenu.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Le moteur analyse chaque match",
    body: "Données historiques, xG, forme, cotes — le moteur calcule la probabilité estimée et l'EV pour chaque marché disponible.",
  },
  {
    n: "02",
    title: "Seule la valeur attendue décide",
    body: "Aucun biais humain. Si l'EV est insuffisant, le système dit non. S'il est positif, un bet est proposé avec stake calibré.",
  },
  {
    n: "03",
    title: "Vous suivez, ajustez, capitalisez",
    body: "Vos tickets sont tracés, vos résultats compilés. Le système apprend et s'affine à chaque lot de bets settlés.",
  },
];

export default function LandingPlaceholder() {
  return (
    <main
      className="min-h-dvh overflow-x-hidden"
      style={{ background: "#0b1523", color: "#f1f5f9" }}
    >
      {/* ── Nav ── */}
      <nav
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-4 sm:px-10"
        style={{
          background: "rgba(11,21,35,0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span
          className="text-sm font-bold tracking-widest uppercase"
          style={{ color: "#0f766e", letterSpacing: "0.2em" }}
        >
          EVCore
        </span>
        <Link
          href="/auth/login"
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
          style={{ background: "#0f766e", color: "#fff" }}
        >
          Accéder <ChevronRight size={14} />
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center px-6 pt-24 pb-20 text-center sm:px-10">
        {/* Glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(15,118,110,0.18) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative mx-auto max-w-3xl">
          <span
            className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest"
            style={{
              borderColor: "rgba(15,118,110,0.4)",
              color: "#2dd4bf",
              background: "rgba(15,118,110,0.1)",
            }}
          >
            Système EV — MVP validé
          </span>

          <h1
            className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl"
            style={{
              color: "#f8fafc",
              textShadow: "0 2px 40px rgba(15,118,110,0.15)",
            }}
          >
            Pariez sur la valeur.
            <br />
            <span style={{ color: "#2dd4bf" }}>Pas sur l&apos;émotion.</span>
          </h1>

          <p
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed sm:text-lg"
            style={{ color: "#94a3b8" }}
          >
            EVCore est un moteur de paris autonome piloté par l&apos;Expected
            Value. Il ne donne pas de tips — il calcule, décide et trace chaque
            position avec rigueur mathématique.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/register"
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold transition-opacity hover:opacity-90 sm:w-auto"
              style={{ background: "#0f766e", color: "#fff" }}
            >
              Commencer <ArrowRight size={15} />
            </Link>
            <Link
              href="/auth/login"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border px-7 py-3.5 text-sm font-semibold transition-colors hover:border-white/30 sm:w-auto"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                color: "#cbd5e1",
              }}
            >
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section
        className="px-6 py-16 sm:px-10"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col gap-1 text-center">
              <span
                className="text-3xl font-bold tabular-nums tracking-tight sm:text-4xl"
                style={{ color: "#2dd4bf" }}
              >
                {s.value}
              </span>
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "#94a3b8" }}
              >
                {s.label}
              </span>
              <span className="text-[0.7rem]" style={{ color: "#475569" }}>
                {s.sub}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-4xl">
          <p
            className="text-center text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "#0f766e" }}
          >
            Comment ça fonctionne
          </p>
          <h2
            className="mt-3 text-center text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ color: "#f1f5f9" }}
          >
            Un processus rigoureux, de bout en bout
          </h2>

          <div className="mt-12 flex flex-col gap-8 sm:gap-0">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative flex gap-6 sm:gap-10">
                {/* Line */}
                {i < STEPS.length - 1 && (
                  <div
                    className="absolute left-7 top-14 hidden h-full w-px sm:block"
                    style={{
                      background:
                        "linear-gradient(to bottom, rgba(15,118,110,0.4), transparent)",
                    }}
                  />
                )}
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                  style={{
                    background: "rgba(15,118,110,0.12)",
                    color: "#2dd4bf",
                    border: "1px solid rgba(15,118,110,0.2)",
                  }}
                >
                  {step.n}
                </div>
                <div className="pb-10">
                  <h3
                    className="text-base font-semibold sm:text-lg"
                    style={{ color: "#f1f5f9" }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-relaxed"
                    style={{ color: "#64748b" }}
                  >
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        className="px-6 py-20 sm:px-10"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.015)",
        }}
      >
        <div className="mx-auto max-w-4xl">
          <p
            className="text-center text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "#0f766e" }}
          >
            Fonctionnalités
          </p>
          <h2
            className="mt-3 text-center text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ color: "#f1f5f9" }}
          >
            Conçu pour le long terme
          </h2>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-2xl p-5"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: "rgba(15,118,110,0.15)",
                      color: "#2dd4bf",
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <h3
                    className="mt-3 text-sm font-semibold"
                    style={{ color: "#f1f5f9" }}
                  >
                    {f.title}
                  </h3>
                  <p
                    className="mt-1.5 text-sm leading-relaxed"
                    style={{ color: "#64748b" }}
                  >
                    {f.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="px-6 py-24 text-center sm:px-10">
        <div className="relative mx-auto max-w-2xl">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(15,118,110,0.12), transparent 70%)",
            }}
          />
          <h2
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: "#f8fafc" }}
          >
            Arrêtez de jouer.
            <br />
            <span style={{ color: "#2dd4bf" }}>Commencez à investir.</span>
          </h2>
          <p
            className="mx-auto mt-4 max-w-md text-sm leading-relaxed"
            style={{ color: "#64748b" }}
          >
            Accès sur invitation. Le système n&apos;existe pas pour maximiser le
            volume — il existe pour maximiser la précision.
          </p>
          <Link
            href="/auth/register"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: "#0f766e", color: "#fff" }}
          >
            Demander l&apos;accès <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="px-6 py-8 text-center text-xs sm:px-10"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          color: "#334155",
        }}
      >
        © {new Date().getFullYear()} EVCore — Moteur de paris piloté par
        l&apos;Expected Value
      </footer>
    </main>
  );
}
