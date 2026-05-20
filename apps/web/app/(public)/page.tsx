"use client";

import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Shield,
  Layers,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  daysUntilWC2026,
  isWC2026Active,
  isWC2026Countdown,
} from "@/lib/events/world-cup-2026";

/* ─── Data ─────────────────────────────────────────────────── */

const CHANNELS = [
  {
    tag: "SV",
    label: "Safe Value",
    headline: "Le canal le plus sélectif.",
    body: "Haute confiance et avantage réel sur la cote. Chaque position est justifiée par les données — pas par l'intuition.",
    metric: "74.3%",
    bets: 191,
    criteria: ["Edge ≥ 8%", "Confiance modèle > 70%", "Cote confirmée"],
    colorCls: "text-emerald-400",
    bgCls: "bg-emerald-500/[0.07] border-emerald-500/20",
    tagCls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    dotCls: "bg-emerald-400",
    glowCls: "bg-emerald-500/10",
  },
  {
    tag: "CONF",
    label: "Confiance",
    headline: "L'issue dominante, prouvée.",
    body: "Issue argmax au-dessus du seuil de la compétition. Une lecture claire de la probabilité la plus probable, sans compromis.",
    metric: "60.7%",
    bets: 122,
    criteria: ["Issue dominante claire", "Seuil de ligue validé", "Modèle calibré"],
    colorCls: "text-blue-400",
    bgCls: "bg-blue-500/[0.07] border-blue-500/20",
    tagCls: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    dotCls: "bg-blue-400",
    glowCls: "bg-blue-500/10",
  },
  {
    tag: "BB",
    label: "Les deux équipes marquent",
    headline: "Statistique pure. Pas de biais.",
    body: "Les deux équipes marquent. Canal stable sur les ligues à forte densité offensive, indépendant du résultat final.",
    metric: "64.0%",
    bets: 100,
    criteria: ["Densité offensive élevée", "Historique BTTS > 55%", "Cote validée"],
    colorCls: "text-amber-400",
    bgCls: "bg-amber-500/[0.07] border-amber-500/20",
    tagCls: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    dotCls: "bg-amber-400",
    glowCls: "bg-amber-500/10",
  },
];


const STEPS = [
  {
    n: "01",
    title: "Identification de la valeur",
    body: "Pour chaque match analysé, le moteur calcule l'avantage réel sur la cote. Seules les positions à edge positif remontent.",
  },
  {
    n: "02",
    title: "Allocation de la mise",
    body: "Le canal attribue automatiquement une mise calibrée. Pas de décision subjective, pas de sur-exposition.",
  },
  {
    n: "03",
    title: "Construction du portefeuille",
    body: "Les résultats s'accumulent. Vous suivez le ROI par canal, par période, avec un historique complet et auditable.",
  },
];

/* ─── Dashboard preview (hero) ──────────────────────────────── */

function HeroPreview() {
  const channels = [
    { tag: "SV", metric: "74.3%", bets: 191, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/15" },
    { tag: "CONF", metric: "60.7%", bets: 122, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/15" },
    { tag: "BB", metric: "64.0%", bets: 100, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/15" },
  ];

  return (
    <div className="relative w-full max-w-sm">
      {/* Glow */}
      <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(15,118,110,0.18),transparent_70%)]" />

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_32px_80px_rgba(0,0,0,0.4)] backdrop-blur-sm">
        {/* Header */}
        <div className="border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.28em] text-accent">
                Portefeuille · 30 jours
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                +18.6%
              </p>
              <p className="text-xs text-muted-foreground">ROI global simulé</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[0.65rem] font-semibold text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              Actif
            </div>
          </div>
        </div>

        {/* Channels */}
        <div className="flex flex-col gap-2 p-4">
          {channels.map((c) => (
            <div
              key={c.tag}
              className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${c.bg}`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`text-[0.6rem] font-black uppercase tracking-wider ${c.color}`}>
                  {c.tag}
                </span>
                <span className="text-[0.72rem] text-muted-foreground">
                  {c.bets} paris
                </span>
              </div>
              <span className={`text-sm font-bold tabular-nums ${c.color}`}>
                {c.metric}
              </span>
            </div>
          ))}
        </div>

        {/* Win bar */}
        <div className="px-4 pb-4">
          <div className="mb-1.5 flex justify-between text-[0.65rem] text-muted-foreground">
            <span>280 gagnés</span>
            <span className="text-rose-400/70">133 perdus</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: "67.8%" }}
            />
          </div>
          <p className="mt-2 text-right text-[0.65rem] text-muted-foreground/60">
            67.8% réussite · 413 paris réglés
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */

export default function LandingPage() {
  const now = new Date();
  const wc2026Active = isWC2026Active(now);
  const wc2026Countdown = isWC2026Countdown(now);
  const showWC2026 = wc2026Active || wc2026Countdown;
  const daysLeft = wc2026Countdown ? daysUntilWC2026(now) : 0;

  return (
    <div className="dark">
      <main className="min-h-dvh overflow-x-hidden bg-background text-foreground">

        {/* ── Fixed header (strip + nav stacked) ── */}
        <header className="fixed left-0 right-0 top-0 z-40 bg-background">
          {showWC2026 && (
            <div className="flex items-center justify-center gap-3 border-b border-warning/15 bg-warning/[0.06] px-4 py-2 text-xs font-semibold text-warning">
              <span>🏆</span>
              <span>Coupe du Monde 2026</span>
              <span className="opacity-40">·</span>
              <span className="font-normal text-warning/70">
                {wc2026Countdown ? `J-${daysLeft} avant le tournoi` : "Tournoi en cours"}
              </span>
              <Link
                href="/dashboard/wc2026"
                className="ml-1 flex items-center gap-1 underline underline-offset-2 opacity-80 hover:opacity-100"
              >
                Voir l&apos;espace dédié <ChevronRight size={11} />
              </Link>
            </div>
          )}
          <nav className="flex items-center justify-between border-b border-white/[0.06] bg-background/85 px-6 py-4 backdrop-blur-md sm:px-10">
            <span className="text-sm font-black uppercase tracking-[0.24em] text-accent">
              EVCore
            </span>
            <div className="flex items-center gap-3">
              <Link
                href="/auth/login"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Connexion
              </Link>
              <Link
                href="/auth/register"
                className="flex items-center gap-1.5 rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85"
              >
                Rejoindre <ChevronRight size={13} />
              </Link>
            </div>
          </nav>
        </header>

        {/* ── Hero ── */}
        <section
          className={`relative flex min-h-dvh flex-col items-center justify-center px-6 pb-16 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:pb-0 ${showWC2026 ? "pt-36 lg:pt-32" : "pt-28 lg:pt-24"} mx-auto max-w-6xl`}
        >
          {/* Decorative */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_30%_40%,rgba(15,118,110,0.14)_0%,transparent_65%)]" />
          <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.022)_1px,transparent_1px)] [background-size:30px_30px]" />

          {/* Left: copy */}
          <div className="relative z-10 w-full max-w-xl text-center lg:text-left">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#0f766e]/35 bg-[#0f766e]/8 px-3.5 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-accent">
              Stratégie d&apos;investissement sportif
            </span>

            <h1 className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.2rem]">
              Arrêtez de parier.
              <br />
              <span className="text-accent">Commencez à investir.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-muted-foreground lg:mx-0 lg:text-[1.05rem]">
              EVCore applique une mise unitaire fixe sur chaque sélection à valeur positive.
              Pas d&apos;improvisation — une méthode reproductible, match après match.
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground/60 lg:justify-start">
              {["67.8% de réussite (SV+CONF+BB)", "5 578 picks · 105 saisons", "Accès sur invitation"].map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-accent/60" />
                  {s}
                </span>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/auth/register"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f766e] px-7 py-3.5 text-sm font-bold text-white shadow-[0_8px_32px_rgba(15,118,110,0.35)] transition-all hover:opacity-90 hover:shadow-[0_12px_40px_rgba(15,118,110,0.4)] sm:w-auto"
              >
                Rejoindre la stratégie <ArrowRight size={15} />
              </Link>
              <Link
                href="/auth/login"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 px-7 py-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground sm:w-auto"
              >
                Se connecter
              </Link>
            </div>
          </div>

          {/* Right: dashboard preview */}
          <div className="relative z-10 mt-14 flex w-full justify-center lg:mt-0 lg:w-auto lg:justify-end">
            <HeroPreview />
          </div>
        </section>

        {/* ── Channels ── */}
        <section className="border-t border-white/[0.06] bg-white/[0.015] px-6 py-24 sm:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-accent">
                Canaux d&apos;investissement
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Trois segments. Trois edges.
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Chaque canal opère selon ses propres critères. Vous investissez sur les canaux en
                performance — pas sur tous à la fois.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {CHANNELS.map((c) => (
                <div
                  key={c.tag}
                  className={`relative flex flex-col gap-5 overflow-hidden rounded-2xl border p-6 ${c.bgCls}`}
                >
                  {/* Subtle glow top-right */}
                  <div className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl ${c.glowCls}`} />

                  <div className="flex items-start justify-between">
                    <span className={`rounded-lg border px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-widest ${c.tagCls}`}>
                      {c.tag}
                    </span>
                    <span className={`flex items-center gap-1 text-[0.65rem] font-semibold ${c.colorCls}`}>
                      <span className={`size-1.5 rounded-full ${c.dotCls}`} />
                      Actif
                    </span>
                  </div>

                  <div>
                    <p className={`text-2xl font-black tabular-nums ${c.colorCls}`}>
                      {c.metric}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.bets} paris · réussite
                    </p>
                  </div>

                  <div>
                    <p className="text-[0.82rem] font-semibold text-foreground">{c.headline}</p>
                    <p className="mt-1.5 text-[0.8rem] leading-6 text-muted-foreground">{c.body}</p>
                  </div>

                  <ul className="mt-auto flex flex-col gap-1.5">
                    {c.criteria.map((cr) => (
                      <li key={cr} className="flex items-center gap-2 text-[0.75rem] text-muted-foreground">
                        <CheckCircle2 size={11} className={c.colorCls} />
                        {cr}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features bento ── */}
        <section className="px-6 py-24 sm:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-accent">
                Fonctionnalités
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Conçu pour l&apos;investisseur.
              </h2>
            </div>

            {/* Bento grid — 12 cols */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-12 lg:gap-4">

              {/* Large cell — col 1-7 */}
              <div className="col-span-2 flex flex-col justify-between rounded-2xl border border-[#0f766e]/20 bg-[#0f766e]/[0.07] p-6 lg:col-span-7 lg:p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f766e]/20 text-accent">
                  <Layers size={18} />
                </div>
                <div className="mt-8 lg:mt-12">
                  <p className="text-[0.6rem] font-bold uppercase tracking-widest text-accent/70">
                    Discipline
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">
                    Une mise. Répétée.
                  </h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Pas de jackpot, pas d&apos;improvisation. Chaque position reçoit une
                    mise unitaire fixe. La régularité est la stratégie — pas l&apos;exception.
                  </p>
                </div>
                {/* Visual bar */}
                <div className="mt-6 grid grid-cols-5 gap-1.5">
                  {[80, 80, 80, 80, 80].map((_, i) => (
                    <div
                      key={i}
                      className="h-1.5 rounded-full bg-accent/30"
                      style={{ opacity: 0.4 + i * 0.12 }}
                    />
                  ))}
                </div>
              </div>

              {/* Small cell — col 8-12 */}
              <div className="col-span-2 flex flex-col justify-between rounded-2xl border border-white/8 bg-white/[0.03] p-6 sm:col-span-1 lg:col-span-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-muted-foreground">
                  <Shield size={18} />
                </div>
                <div className="mt-6">
                  <p className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground/50">
                    Risque
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-foreground">
                    Drawdown contrôlé
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Quand un canal sous-performe, le système ralentit automatiquement.
                    La protection du capital prime toujours.
                  </p>
                </div>
              </div>

              {/* Small cell — col 1-5 */}
              <div className="col-span-2 flex flex-col justify-between rounded-2xl border border-white/8 bg-white/[0.03] p-6 sm:col-span-1 lg:col-span-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-muted-foreground">
                  <Clock size={18} />
                </div>
                <div className="mt-6">
                  <p className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground/50">
                    Transparence
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-foreground">
                    Décisions lisibles
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Vous comprenez pourquoi chaque position a été prise ou refusée.
                    Pas de boîte noire.
                  </p>
                </div>
              </div>

              {/* Large cell — col 6-12 */}
              <div className="col-span-2 flex flex-col justify-between rounded-2xl border border-white/8 bg-white/[0.04] p-6 lg:col-span-7 lg:p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-muted-foreground">
                  <TrendingUp size={18} />
                </div>
                <div className="mt-8 lg:mt-10">
                  <p className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground/50">
                    Philosophie
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">
                    Investir, pas parier.
                  </h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    EVCore traite chaque position comme une décision d&apos;allocation de capital —
                    avec une logique reproductible, des critères fixes, et un suivi complet.
                  </p>
                </div>
                {/* Stats row */}
                <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-5">
                  {[
                    { v: "59.2%", l: "Réussite" },
                    { v: "+2.28%", l: "ROI simulé" },
                    { v: "760", l: "Positions" },
                  ].map((s) => (
                    <div key={s.l}>
                      <p className="text-lg font-black tabular-nums text-foreground">{s.v}</p>
                      <p className="text-[0.65rem] text-muted-foreground/60">{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="border-t border-white/[0.06] bg-white/[0.015] px-6 py-24 sm:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-accent">
                Comment ça fonctionne
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Une position. Une mise. Un suivi.
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <div
                  key={step.n}
                  className="relative flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-6"
                >
                  {/* Connector line */}
                  {i < STEPS.length - 1 && (
                    <div className="absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-gradient-to-r from-white/20 to-transparent sm:block" />
                  )}
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#0f766e]/25 bg-[#0f766e]/10 text-xl font-black text-accent">
                    {step.n}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="border-t border-white/[0.06] px-6 py-28 text-center sm:px-10">
          <div className="relative mx-auto max-w-2xl">
            <div className="pointer-events-none absolute -inset-12 -z-10 bg-[radial-gradient(ellipse_80%_70%_at_50%_50%,rgba(15,118,110,0.14),transparent_70%)]" />

            <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-accent">
              Prêt à investir ?
            </p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              Une mise. Un edge.
              <br />
              <span className="text-accent">C&apos;est ça, investir.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
              {showWC2026
                ? "La Coupe du monde 2026 se prépare avec une lecture claire des matchs et des coupons IA. L'objectif reste le même : investir avec méthode."
                : "Accès sur invitation. L'objectif n'est pas de multiplier les paris — c'est de construire un portefeuille avec méthode."}
            </p>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/auth/register"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f766e] px-8 py-4 text-sm font-bold text-white shadow-[0_8px_40px_rgba(15,118,110,0.3)] transition-all hover:opacity-90 hover:shadow-[0_12px_48px_rgba(15,118,110,0.4)] sm:w-auto"
              >
                Rejoindre la stratégie <ArrowRight size={15} />
              </Link>
              <Link
                href="/auth/login"
                className="flex w-full items-center justify-center rounded-2xl border border-white/12 px-8 py-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground sm:w-auto"
              >
                Déjà membre
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/[0.06] px-6 py-8 sm:px-10">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <span className="text-xs font-black uppercase tracking-[0.22em] text-accent/60">
              EVCore
            </span>
            <p className="text-xs text-muted-foreground/35">
              © {new Date().getFullYear()} — Investir sur la valeur, pas sur l&apos;émotion
            </p>
          </div>
        </footer>

      </main>
    </div>
  );
}
