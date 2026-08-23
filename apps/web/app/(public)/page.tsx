"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Moon,
  Sun,
  TrendingUp,
  Shield,
  Layers,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { PwaInstallBanner } from "@/components/pwa-install-banner";

/* ─── Data ─────────────────────────────────────────────────── */

// ─────────────────────────────────────────────────────────────
// RÈGLE DE MAINTENANCE DE CETTE PAGE
//
// Cette landing n'affiche que des grandeurs MONOTONES, écrites en plancher.
// Un nombre qui ne peut que croître, affiché « 50 000+ », ne peut jamais
// devenir faux — il devient seulement modeste.
//
// Ce n'est pas de la prudence rédactionnelle, c'est ce qui a cassé la version
// précédente : elle affichait des taux de réussite par canal (59.0% sur 268
// paris, 45.5% sur 815) et une énumération nominative de six canaux. Les taux
// oscillent à chaque semaine de résultats et les volumes avaient triplé ; le
// moteur est passé à 19 canaux qui émettent. Chaque chiffre de la page était
// faux d'un facteur 2 à 3 au 2026-08-22, sans que personne l'ait remarqué.
//
// Deux interdits qui découlent de là :
//
//   1. AUCUN taux de réussite ni ROI. Pas par pudeur — parce qu'ils n'ont
//      aucune puissance statistique à nos volumes (SE de 13 à 18 points pour
//      des écarts affichés de 10 ; voir docs/audit-canaux-investir-2026-08-22
//      .md §6). Afficher un ROI en argument de vente, c'est vendre du bruit.
//   2. AUCUNE énumération nominative de canaux. On parle FAMILLES
//      (docs/prediction-engine-families.md) : une taxonomie conçue pour ne
//      pas être redécoupée à chaque nouveau marché. On peut ajouter dix
//      canaux sans toucher cette page.
//   3. AUCUNE formulation qui laisse croire qu'EVCore engage de l'argent
//      pour le compte de quelqu'un. Le produit ANALYSE et PROPOSE ; la
//      décision et le pari appartiennent à l'utilisateur. Les lignes `bet`
//      que le moteur écrit portent `userId: null` — c'est le track record du
//      système, pas des positions prises pour un tiers, et la mise unitaire
//      fixe est la convention de ce suivi, pas un ordre passé. Proscrire
//      « misé en votre nom », « le moteur applique une mise », « chaque
//      position reçoit une mise » : préférer « le moteur raisonne à », « il
//      vous propose », « la décision reste la vôtre ».
//   4. NE JAMAIS nier une fonctionnalité réelle pour faire une formule.
//      « Vous ne recevez pas des pronostics » sonnait bien et était faux : le
//      produit livre des pronostics ET des coupons. De même, « presque rien
//      n'est recommandé » décrivait la vue « Ce qu'on assume », pas le
//      produit — le pool de coupon puise dans presque tous les canaux
//      (POOL_EXCLUDED_CHANNELS ne retire que les métas et les deux filtres).
//      Ce qui distingue EVCore n'est pas de s'abstenir, c'est de livrer le
//      raisonnement avec le pronostic, refus compris.
//
// Relevé du 2026-08-22 : 52 926 matchs analysés, 302 763 sélections réglées,
// 68 championnats, historique depuis 2019-06-11. Réviser les planchers quand
// ils deviennent ridicules, pas avant.
// ─────────────────────────────────────────────────────────────
const SCALE = [
  { v: "50 000+", l: "matchs analysés" },
  { v: "300 000+", l: "prédictions confrontées au résultat" },
  { v: "68", l: "championnats couverts" },
  { v: "7", l: "saisons d'historique" },
];

// Les familles de moteurs, pas les canaux. Un canal est une déclinaison de
// marché ; une famille est un processus générateur. Les canaux changent, les
// familles non.
const FAMILIES = [
  {
    tag: "Poisson plein-match",
    headline: "Une distribution de buts, pas un pronostic.",
    body: "Le moteur estime combien de buts chaque équipe est susceptible de marquer, puis en dérive tous les marchés du match complet — issue, total de buts, les deux équipes marquent, double chance, buts par équipe. Un seul modèle, lu sous plusieurs angles.",
    markets: [
      "Issue 1X2",
      "Plus / moins de buts",
      "Double chance",
      "Buts par équipe",
    ],
    colorCls: "text-emerald-600 dark:text-emerald-400",
    bgCls: "bg-emerald-500/[0.07] border-emerald-500/20",
    tagCls:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    glowCls: "bg-emerald-500/10",
  },
  {
    tag: "Distribution mi-temps",
    headline: "La première période a son propre rythme.",
    body: "Les marchés de mi-temps ne se déduisent pas d'une fraction du match complet — une équipe qui marque tard n'est pas une équipe qui marque peu. Cette famille estime la première période pour elle-même.",
    markets: [
      "Plus / moins mi-temps",
      "Vainqueur 1ʳᵉ mi-temps",
      "Mi-temps / fin de match",
    ],
    colorCls: "text-cyan-600 dark:text-cyan-400",
    bgCls: "bg-cyan-500/[0.07] border-cyan-500/20",
    tagCls:
      "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    glowCls: "bg-cyan-500/10",
  },
  {
    tag: "Implicite marché",
    headline: "Parfois, la cote sait mieux que le modèle.",
    body: "Sur certains marchés — le match nul en particulier — la probabilité que le bookmaker inscrit dans sa cote bat n'importe quelle estimation qu'on pourrait produire. Le moteur la lit directement plutôt que d'inventer une opinion.",
    markets: ["Match nul", "Recoupement modèle ↔ marché"],
    colorCls: "text-violet-600 dark:text-violet-400",
    bgCls: "bg-violet-500/[0.07] border-violet-500/20",
    tagCls:
      "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20",
    glowCls: "bg-violet-500/10",
  },
];

// Ce que le système refuse — l'argument central de la page, et le seul qui ne
// se périme pas : il décrit une discipline, pas un résultat.
const DISCIPLINE = [
  {
    stat: "19 → 2",
    title: "Rien n'est mis sur le même plan.",
    body: "Le moteur fait tourner dix-neuf canaux de prédiction. Deux seulement sont présentés comme assumés à ce jour — ceux dont l'avantage résiste au bruit d'échantillonnage. Les autres restent consultables, et chaque pronostic affiche le résultat mesuré de son canal, y compris quand il est mauvais. EVCore analyse et propose ; la décision et le pari vous appartiennent.",
  },
  {
    stat: "Nommée",
    title: "Chaque pronostic écarté l'est pour une raison lisible.",
    body: "Cote trop courte, divergence modèle-marché implausible, pronostic qui contredit le modèle qui l'a produit. Rien n'est écarté en silence : la raison est affichée à côté, et vous pouvez la contester.",
  },
  {
    stat: "AVOID",
    title: "Un canal dont le seul rôle est de dire non.",
    body: "AVOID n'émet jamais de pronostic. Il compare la probabilité du modèle à celle du marché et, quand l'écart devient invraisemblable, il retire le match entier de la publication. C'est le seul signal de sélection du système qui ait tenu sur trois saisons.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Estimation, puis filtre",
    body: "Chaque match passe par les familles de moteurs. Seules remontent les positions que le modèle sait réellement estimer — pas celles où il annonce le plus gros avantage.",
  },
  {
    n: "02",
    title: "Une unité de mise, la même partout",
    body: "Le moteur raisonne à mise unitaire fixe, jamais dimensionnée à sa propre confiance : miser plus quand le modèle est sûr de lui, c'est amplifier ses erreurs les plus coûteuses. C'est la convention de son suivi — et celle qu'il vous recommande.",
  },
  {
    n: "03",
    title: "Tout est réglé, tout est visible",
    body: "Les positions retenues comme celles écartées sont confrontées au résultat réel, qu'elles aient été jouées ou non. Vous suivez la performance par canal, par période, avec un historique complet et auditable.",
  },
];

/* ─── Aperçu produit (hero) ─────────────────────────────────── */

// Aperçu de la LECTURE d'un match, pas d'un palmarès. C'est ce que le
// sous-titre du hero promet : la distribution de buts, chaque marché avec sa
// probabilité calibrée, et le motif derrière ce qui est écarté.
//
// Illustratif, et volontairement anonyme : aucune équipe nommée, aucun
// résultat passé, rien qui puisse se lire comme l'archive d'une prédiction
// réellement émise. La cote y est TOUJOURS accompagnée de sa fréquence
// attendue — la règle que l'app applique partout, la vitrine ne fait pas
// exception.
const PREVIEW_READING = [
  { market: "Double chance", pick: "1X", odds: "1.38", rate: "74%" },
  { market: "Plus / moins de buts", pick: "+2.5", odds: "2.05", rate: "49%" },
  {
    market: "Les deux équipes marquent",
    pick: "Oui",
    odds: "1.85",
    rate: "54%",
  },
];

function HeroPreview() {
  return (
    <div className="relative w-full max-w-sm">
      {/* Glow */}
      <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(15,118,110,0.18),transparent_70%)]" />

      <div className="relative overflow-hidden rounded-2xl border border-border bg-panel shadow-[0_32px_80px_rgba(0,0,0,0.25)] backdrop-blur-sm">
        {/* En-tête : la distribution de buts, d'où tout le reste dérive */}
        <div className="border-b border-border px-5 py-4">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.28em] text-accent">
            Lecture du match
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              1.62
            </span>
            <span className="text-sm text-muted-foreground">—</span>
            <span className="text-2xl font-bold tabular-nums text-foreground">
              1.14
            </span>
            <span className="ml-1 text-[0.68rem] text-muted-foreground">
              buts attendus
            </span>
          </div>
        </div>

        {/* Chaque marché, avec sa probabilité calibrée */}
        <div className="flex flex-col gap-2 p-4">
          {PREVIEW_READING.map((p) => (
            <div
              key={p.market}
              className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-foreground">
                  {p.pick}
                </p>
                <p className="truncate text-[0.65rem] text-muted-foreground">
                  {p.market}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums text-foreground">
                  {p.odds}
                </p>
                {/* La fréquence attendue, jamais la cote toute seule. */}
                <p className="text-[0.65rem] font-semibold tabular-nums text-accent">
                  {p.rate} attendus
                </p>
              </div>
            </div>
          ))}

          {/* Ce qui est écarté fait partie de la lecture, avec son motif */}
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border px-3 py-2.5 opacity-55">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-foreground line-through decoration-1">
                2-1
              </p>
              <p className="truncate text-[0.65rem] text-muted-foreground">
                Score exact
              </p>
            </div>
            <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[0.6rem] text-muted-foreground">
              Écarté — edge trop élevé
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */

export default function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Pre-mount: assume dark (matches ThemeProvider defaultTheme="dark")
  const isDark = !mounted || resolvedTheme === "dark";

  return (
    <main className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      {/* ── Fixed header (strip + nav stacked) ── */}
      <header className="fixed left-0 right-0 top-0 z-40 bg-background pt-[env(safe-area-inset-top)]">
        <nav className="flex items-center justify-between border-b border-border bg-background/85 px-6 py-4 backdrop-blur-md sm:px-10">
          <span className="flex items-center gap-1">
            <Image
              src="/icons/icon.svg"
              alt="EVCore"
              width={28}
              height={28}
              className="size-7 rounded-lg"
            />
            <span className="text-sm font-black text-accent">Core</span>
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label={isDark ? "Mode clair" : "Mode sombre"}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-panel text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <Link
              href="/auth/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Connexion
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center px-6 pb-16 pt-28 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:pb-0 lg:pt-24">
        {/* Decorative */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_30%_40%,rgba(15,118,110,0.14)_0%,transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(100,116,139,0.07)_1px,transparent_1px)] [background-size:30px_30px]" />

        {/* Left: copy */}
        <div className="relative z-10 w-full max-w-xl text-center lg:text-left">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/8 px-3.5 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-accent">
            Stratégie d&apos;investissement sportif
          </span>

          <h1 className="text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Un avis sur chaque match.
            <br />
            <span className="text-accent">
              Une conviction sur presque aucun.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-muted-foreground lg:mx-0 lg:text-[1.05rem]">
            Sur chaque match, le moteur pose une lecture complète : combien de
            buts attendus et pour qui, quelle probabilité calibrée sur chaque
            marché, et pourquoi il retient ou écarte. Vous recevez des
            pronostics et des coupons — et, avec eux, tout le raisonnement qui
            les a produits.
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground/60 lg:justify-start">
            {[
              "50 000+ matchs analysés",
              "68 championnats · 7 saisons",
              "Accès sur invitation",
            ].map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-accent/60" />
                {s}
              </span>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              href="/auth/register"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-7 py-3.5 text-sm font-bold text-accent-foreground shadow-[0_8px_32px_rgba(15,118,110,0.35)] transition-all hover:opacity-90 hover:shadow-[0_12px_40px_rgba(15,118,110,0.4)] sm:w-auto"
            >
              Rejoindre la stratégie <ArrowRight size={15} />
            </Link>
            <Link
              href="/auth/login"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-7 py-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:w-auto"
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

      {/* ── Familles de moteurs ── */}
      <section className="border-t border-border bg-panel/50 px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-accent">
              Le moteur
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Trois familles. Pas trente pronostics.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              EVCore n&apos;empile pas un modèle par marché. Il porte trois
              façons d&apos;estimer un match, et en dérive tous les marchés
              qu&apos;elles savent produire — ce qui rend chaque prédiction
              cohérente avec les autres sur le même match.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {FAMILIES.map((f) => (
              <div
                key={f.tag}
                className={`relative flex flex-col gap-5 overflow-hidden rounded-2xl border p-6 ${f.bgCls}`}
              >
                <div
                  className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl ${f.glowCls}`}
                />

                <span
                  className={`w-fit rounded-lg border px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-widest ${f.tagCls}`}
                >
                  {f.tag}
                </span>

                <div>
                  <p className="text-[0.9rem] font-semibold text-foreground">
                    {f.headline}
                  </p>
                  <p className="mt-2 text-[0.8rem] leading-6 text-muted-foreground">
                    {f.body}
                  </p>
                </div>

                <ul className="mt-auto flex flex-col gap-1.5 border-t border-border/50 pt-4">
                  {f.markets.map((m) => (
                    <li
                      key={m}
                      className="flex items-center gap-2 text-[0.75rem] text-muted-foreground"
                    >
                      <CheckCircle2 size={11} className={f.colorCls} />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Échelle — uniquement des grandeurs monotones (voir SCALE) */}
          <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-panel p-6 sm:grid-cols-4">
            {SCALE.map((s) => (
              <div key={s.l}>
                <p className="text-2xl font-black tabular-nums text-foreground">
                  {s.v}
                </p>
                <p className="mt-0.5 text-[0.7rem] leading-snug text-muted-foreground">
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Discipline : ce que le système refuse ── */}
      <section className="px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-accent">
              La discipline
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Ce qu&apos;on refuse de vous proposer.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Un moteur de prédiction se juge à ce qu&apos;il écarte, pas à ce
              qu&apos;il met en avant. C&apos;est la partie du produit
              qu&apos;on montre en entier.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {DISCIPLINE.map((d) => (
              <div
                key={d.title}
                className="flex flex-col gap-4 rounded-2xl border border-warning/25 bg-warning/[0.05] p-6"
              >
                <span className="w-fit rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1 text-[0.7rem] font-black uppercase tracking-widest tabular-nums text-warning">
                  {d.stat}
                </span>
                <p className="text-[0.9rem] font-semibold text-foreground">
                  {d.title}
                </p>
                <p className="text-[0.8rem] leading-6 text-muted-foreground">
                  {d.body}
                </p>
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
            <div className="col-span-2 flex flex-col justify-between rounded-2xl border border-accent/20 bg-accent/[0.07] p-6 lg:col-span-7 lg:p-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
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
                  Pas de jackpot, pas d&apos;improvisation. Le moteur raisonne à
                  mise unitaire fixe et vous propose de faire pareil. La
                  régularité est la stratégie — pas l&apos;exception.
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
            <div className="col-span-2 flex flex-col justify-between rounded-2xl border border-border bg-panel p-6 sm:col-span-1 lg:col-span-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
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
                  Mise unitaire fixe, jamais dimensionnée à la confiance du
                  modèle. Un marché qui décroche durablement est suspendu par le
                  moteur, pas par une décision au cas par cas.
                </p>
              </div>
            </div>

            {/* Small cell — col 1-5 */}
            <div className="col-span-2 flex flex-col justify-between rounded-2xl border border-border bg-panel p-6 sm:col-span-1 lg:col-span-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
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
                  Vous comprenez pourquoi chaque position a été prise ou
                  refusée. Pas de boîte noire.
                </p>
              </div>
            </div>

            {/* Large cell — col 6-12 */}
            <div className="col-span-2 flex flex-col justify-between rounded-2xl border border-border bg-panel p-6 lg:col-span-7 lg:p-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
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
                  EVCore présente chaque position comme une décision
                  d&apos;allocation de capital — logique reproductible, critères
                  fixes, suivi complet. C&apos;est vous qui décidez de la
                  prendre.
                </p>
              </div>
              {/* Pas de taux de réussite ici : voir la règle de maintenance en
                  tête de fichier. Ce qui tient, c'est la méthode, pas le
                  chiffre du trimestre. */}
              <div className="mt-6 border-t border-border pt-5">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Aucun taux de réussite n&apos;est affiché ici. À nos volumes,
                  l&apos;écart entre un bon et un mauvais trimestre reste sous
                  le seuil de ce qu&apos;on peut distinguer du hasard — le
                  brandir serait vendre du bruit. Les résultats complets, eux,
                  sont dans l&apos;app, canal par canal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-border bg-panel/50 px-6 py-24 sm:px-10">
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
                className="relative flex flex-col gap-4 rounded-2xl border border-border bg-panel p-6"
              >
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-gradient-to-r from-border/40 to-transparent sm:block" />
                )}
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-xl font-black text-accent">
                  {step.n}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="border-t border-border px-6 py-28 text-center sm:px-10">
        <div className="relative mx-auto max-w-2xl">
          <div className="pointer-events-none absolute -inset-12 -z-10 bg-[radial-gradient(ellipse_80%_70%_at_50%_50%,rgba(15,118,110,0.14),transparent_70%)]" />

          <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-accent">
            Prêt à investir ?
          </p>
          <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Notre analyse. Votre décision.
            <br />
            <span className="text-accent">C&apos;est ça, investir.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
            Accès sur invitation. L&apos;objectif n&apos;est pas de multiplier
            les paris — c&apos;est de construire un portefeuille avec méthode.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/register"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-8 py-4 text-sm font-bold text-accent-foreground shadow-[0_8px_40px_rgba(15,118,110,0.3)] transition-all hover:opacity-90 hover:shadow-[0_12px_48px_rgba(15,118,110,0.4)] sm:w-auto"
            >
              Rejoindre la stratégie <ArrowRight size={15} />
            </Link>
            <Link
              href="/auth/login"
              className="flex w-full items-center justify-center rounded-2xl border border-border px-8 py-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:w-auto"
            >
              Déjà membre
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <span className="flex items-center gap-1">
            <Image
              src="/icons/icon.svg"
              alt="EVCore"
              width={20}
              height={20}
              className="size-5 rounded-md"
            />
            <span className="text-xs font-black text-accent">Core</span>
          </span>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} — Investir sur la valeur, pas sur
            l&apos;émotion
          </p>
        </div>
      </footer>

      <PwaInstallBanner />
    </main>
  );
}
