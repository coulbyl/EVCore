"use client";

import Link from "next/link";
import {
  TrendingUp,
  Shield,
  BarChart2,
  ChevronRight,
  ArrowRight,
  Layers,
  Clock,
} from "lucide-react";

const STATS = [
  { label: "Taux de réussite", value: "59.2%", sub: "résultat validé" },
  { label: "ROI simulé", value: "+2.28%", sub: "sur 3 saisons" },
  { label: "Edge moyen", value: "2.5%", sub: "par position" },
  { label: "Positions analysées", value: "760", sub: "données vérifiées" },
];

const CHANNELS = [
  {
    tag: "SAFE",
    title: "Safe Value",
    body: "Haute confiance et avantage réel sur la cote. Le canal le plus sélectif — peu de positions, mais chaque entrée est justifiée.",
    color: "#10b981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.2)",
  },
  {
    tag: "CONF",
    title: "Confiance",
    body: "Issue dominante au-dessus du seuil de la compétition. Une prise de position claire sur l'issue la plus probable.",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.2)",
  },
  {
    tag: "BB",
    title: "Both Teams Score",
    body: "Les deux équipes marquent. Statistique pure, sans biais sur le vainqueur. Canal stable sur les ligues à forte densité offensive.",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.2)",
  },
];

const FEATURES = [
  {
    icon: Layers,
    title: "Une mise par position",
    body: "Chaque pick reçoit une mise unitaire définie. Pas de jackpot, pas de coup de chance — une allocation disciplinée, répétée.",
  },
  {
    icon: BarChart2,
    title: "Trois canaux indépendants",
    body: "SAFE, CONF et BB fonctionnent séparément. Chaque canal a ses propres critères et son propre suivi de performance.",
  },
  {
    icon: Shield,
    title: "Contrôle du drawdown",
    body: "Quand un canal sous-performe, le système ralentit automatiquement. La protection du capital prime sur le volume.",
  },
  {
    icon: TrendingUp,
    title: "ROI traçable sur la durée",
    body: "Chaque position est enregistrée. Vous voyez exactement ce que chaque canal rapporte, mois après mois.",
  },
  {
    icon: Clock,
    title: "Décisions lisibles",
    body: "Chaque entrée est justifiée par des données. Vous comprenez pourquoi une position a été prise — ou refusée.",
  },
  {
    icon: ChevronRight,
    title: "Accès sur invitation",
    body: "EVCore n'est pas ouvert au grand public. Chaque membre est sélectionné pour maintenir la qualité du suivi.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Le moteur identifie les positions à valeur",
    body: "Pour chaque match analysé, le système calcule l'avantage réel sur la cote proposée. Seules les positions avec un edge positif remontent.",
  },
  {
    n: "02",
    title: "Le canal alloue une mise unitaire",
    body: "SAFE, CONF ou BB — chaque canal attribue automatiquement une mise calibrée. Pas de décision subjective sur le montant.",
  },
  {
    n: "03",
    title: "Votre portefeuille se construit dans le temps",
    body: "Les résultats s'accumulent position par position. Vous suivez le ROI par canal, par période, avec un historique complet.",
  },
];

export default function LandingPage() {
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
          className="text-sm font-bold uppercase tracking-widest"
          style={{ color: "#0f766e", letterSpacing: "0.2em" }}
        >
          EVCore
        </span>
        <Link
          href="/auth/login"
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ background: "#0f766e", color: "#fff" }}
        >
          Accéder <ChevronRight size={14} />
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center px-6 pb-20 pt-24 text-center sm:px-10">
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
            Stratégie d&apos;investissement sportif
          </span>

          <h1
            className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl"
            style={{
              color: "#f8fafc",
              textShadow: "0 2px 40px rgba(15,118,110,0.15)",
            }}
          >
            Arrêtez de parier.
            <br />
            <span style={{ color: "#2dd4bf" }}>Commencez à investir.</span>
          </h1>

          <p
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed sm:text-lg"
            style={{ color: "#94a3b8" }}
          >
            Investissez un montant fixe sur chaque sélection du système.
            Pas d&apos;impulsion, pas d&apos;improvisation — une stratégie
            répétée match après match.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/register"
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold transition-opacity hover:opacity-90 sm:w-auto"
              style={{ background: "#0f766e", color: "#fff" }}
            >
              Rejoindre <ArrowRight size={15} />
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

      {/* ── Channels ── */}
      <section className="px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-4xl">
          <p
            className="text-center text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "#0f766e" }}
          >
            Canaux d&apos;investissement
          </p>
          <h2
            className="mt-3 text-center text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ color: "#f1f5f9" }}
          >
            Trois segments. Trois edges prouvés.
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed"
            style={{ color: "#64748b" }}
          >
            Chaque canal opère selon ses propres critères et son propre bilan.
            Vous investissez sur les canaux en performance, pas sur tous à la
            fois.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {CHANNELS.map((c) => (
              <div
                key={c.tag}
                className="flex flex-col gap-3 rounded-2xl p-5"
                style={{ background: c.bg, border: `1px solid ${c.border}` }}
              >
                <span
                  className="w-fit rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-widest"
                  style={{ background: c.border, color: c.color }}
                >
                  {c.tag}
                </span>
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "#f1f5f9" }}
                >
                  {c.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
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
            Comment ça fonctionne
          </p>
          <h2
            className="mt-3 text-center text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ color: "#f1f5f9" }}
          >
            Une position. Une mise. Un suivi.
          </h2>

          <div className="mt-12 flex flex-col gap-8 sm:gap-0">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative flex gap-6 sm:gap-10">
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
      <section className="px-6 py-20 sm:px-10">
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
            Conçu pour l&apos;investisseur, pas pour le parieur
          </h2>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      <section
        className="px-6 py-24 text-center sm:px-10"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.015)",
        }}
      >
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
            Une mise. Un edge. Une durée.
            <br />
            <span style={{ color: "#2dd4bf" }}>C&apos;est ça, investir.</span>
          </h2>
          <p
            className="mx-auto mt-4 max-w-md text-sm leading-relaxed"
            style={{ color: "#64748b" }}
          >
            Accès sur invitation. L&apos;objectif n&apos;est pas de multiplier
            les paris, mais de construire un portefeuille avec méthode.
          </p>
          <Link
            href="/auth/register"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: "#0f766e", color: "#fff" }}
          >
            Rejoindre la stratégie <ArrowRight size={15} />
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
        © {new Date().getFullYear()} EVCore — Investir sur la valeur, pas sur
        l&apos;émotion
      </footer>
    </main>
  );
}
