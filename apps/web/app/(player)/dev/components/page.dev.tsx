import type { Metadata } from "next";
import Link from "next/link";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";
import { ScreenSkeleton } from "@/components/scoreboard/states/screen-skeleton";
import { PauseNotice } from "@/components/scoreboard/states/pause-notice";
import {
  StateLine,
  stateActionClass,
} from "@/components/scoreboard/states/state-line";
import { ChanceFigure } from "@/components/scoreboard/ui/chance-figure";
import { ChanceLeds } from "@/components/scoreboard/ui/chance-leds";
import { ChipGroup } from "@/components/scoreboard/ui/chip-group";
import { FormStrip } from "@/components/scoreboard/ui/form-strip";
import type { Outcome } from "@/components/scoreboard/ui/outcome";
import { ResultMark } from "@/components/scoreboard/ui/result-mark";
import { Row, RowList } from "@/components/scoreboard/ui/row-list";
import { ScoreLine } from "@/components/scoreboard/ui/score-line";
import { assertDevOnly, devOnlyMetadata } from "../dev-only";
import { ShowcaseErrorStates } from "./showcase-error-states";
import { ShowcaseThemeToggle } from "./showcase-theme-toggle";

export const metadata: Metadata = {
  title: "Vitrine — EVCore",
  ...devOnlyMetadata,
};

/**
 * La vitrine du tableau d'affichage (15-todo.md, A9) : chaque composant de
 * `components/scoreboard` dans tous ses états, en clair et en sombre. Elle
 * sert à la revue de finition et de banc aux tests e2e ; elle n'existe pas
 * en production. Référence : apps/web/DESIGN.md.
 */

const SWATCHES = [
  { name: "band (encre)", className: "bg-band" },
  { name: "led-on (ambre)", className: "bg-led-on" },
  { name: "background (sol)", className: "bg-background border border-border" },
  { name: "card", className: "bg-card border border-border" },
  { name: "muted (fond discret)", className: "bg-muted" },
  { name: "border (filet)", className: "bg-border" },
  { name: "icon-subtle", className: "bg-icon-subtle" },
  { name: "muted-foreground", className: "bg-muted-foreground" },
  { name: "foreground", className: "bg-foreground" },
  { name: "win", className: "bg-win" },
  { name: "loss", className: "bg-loss" },
  { name: "warning", className: "bg-warning" },
] as const;

const TYPE_ROLES = [
  {
    name: "figure · 28 · Condensed 700",
    className: "score text-figure font-bold",
    sample: "8 sur 10 · 1,28",
  },
  {
    name: "title · 22 · Condensed 600",
    className: "score text-title font-semibold",
    sample: "Favori du jour",
  },
  {
    name: "bet · 17 · Barlow 500",
    className: "text-bet font-medium",
    sample: "Victoire du PSG",
  },
  {
    name: "body · 15 · Barlow 400",
    className: "text-body",
    sample: "Le PSG a gagné ses 9 derniers matchs à domicile",
  },
  {
    name: "meta · 13 · Barlow 400",
    className: "text-meta text-muted-foreground",
    sample: "19:00 · Ligue 1",
  },
  {
    name: "legal · 11 · Barlow 400",
    className: "text-legal text-muted-foreground",
    sample: "18+ · Parier comporte des risques de perte",
  },
] as const;

const FORM: Outcome[] = [
  "won",
  "won",
  "lost",
  "won",
  "won",
  "won",
  "won",
  "lost",
  "won",
  "won",
  "won",
  "won",
  "won",
  "lost",
  "won",
  "void",
  "won",
  "won",
  "won",
  "none",
  "won",
  "won",
  "won",
  "pending",
];

const GRID: Outcome[] = [
  ...Array<Outcome>(60).fill("none"),
  ...FORM,
  "won",
  "won",
  "lost",
  "won",
  "won",
  "won",
];

const PROBABILITIES = [0.78, 0.5, 0.29, 1 / 9, 1 / 20, 1 / 46, 0.001];

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 py-6">
      <h2 id={id} className="score text-title font-semibold">
        {title}
      </h2>
      {note ? <p className="text-meta text-muted-foreground">{note}</p> : null}
      {children}
    </section>
  );
}

export default function ComponentsShowcase() {
  assertDevOnly();

  return (
    <>
      <PlayerBand>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-meta text-band-muted">Hier</span>
            <ScoreLine
              label="Hier"
              items={[
                { code: "FAV", label: "Favori", outcome: "won", odds: "1,24" },
                { code: "COM", label: "Combiné", outcome: "won", odds: "1,41" },
                { code: "C2", label: "Coupon cote 2", outcome: "lost" },
                { code: "IA", label: "Combiné IA", outcome: "void" },
                {
                  code: "NUL",
                  label: "Chasseur Nul",
                  outcome: "pending",
                  pendingText: "02:30",
                },
              ]}
            />
          </div>
          <ChipGroup
            tone="band"
            label="Jour"
            items={[
              {
                key: "yesterday",
                label: "Hier",
                href: "/dev/components",
                active: false,
              },
              {
                key: "today",
                label: "Aujourd'hui",
                href: "/dev/components",
                active: true,
              },
              {
                key: "tomorrow",
                label: "Demain",
                href: "/dev/components",
                active: false,
              },
            ]}
          />
        </div>
      </PlayerBand>

      <div className="divide-y divide-border px-4 lg:px-6">
        <Section
          id="theme"
          title="Vitrine"
          note="Chaque brique de components/scoreboard, dans ses états. Développement seulement."
        >
          <ShowcaseThemeToggle />
          <nav
            aria-label="Sections"
            className="flex flex-wrap gap-x-4 gap-y-1 text-body"
          >
            {[
              "colors",
              "type",
              "score",
              "chance",
              "form",
              "marks",
              "rows",
              "chips",
              "states",
              "sheet",
            ].map((anchor) => (
              <a key={anchor} href={`#${anchor}`} className={stateActionClass}>
                {anchor}
              </a>
            ))}
          </nav>
        </Section>

        <Section
          id="colors"
          title="Couleurs"
          note="Jetons sous .scoreboard ; contrastes vérifiés par pnpm --filter web check:contrast."
        >
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SWATCHES.map((swatch) => (
              <li key={swatch.name} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={`size-10 shrink-0 rounded-md ${swatch.className}`}
                />
                <span className="text-meta">{swatch.name}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="type"
          title="Type"
          note="Deux voix, deux graisses chacune."
        >
          <ul className="flex flex-col gap-3">
            {TYPE_ROLES.map((role) => (
              <li key={role.name} className="flex flex-col gap-0.5">
                <span className="text-legal text-muted-foreground">
                  {role.name}
                </span>
                <span className={role.className}>{role.sample}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="score"
          title="Ligne de score"
          note="Sur une surface claire (admin) : vert et rouge ; le signe porte l'issue."
        >
          <ScoreLine
            tone="surface"
            label="Aujourd'hui"
            items={[
              { code: "FAV", label: "Favori", outcome: "won", odds: "1,24" },
              { code: "C2", label: "Coupon cote 2", outcome: "lost" },
              { code: "IA", label: "Combiné IA", outcome: "void" },
              {
                code: "COR",
                label: "Chasseur Corners",
                outcome: "pending",
                pendingText: "21:45",
              },
            ]}
          />
        </Section>

        <Section
          id="chance"
          title="Chances"
          note="Écrites, allumées, lues. Pas de diodes au-delà de 20."
        >
          <ul className="flex flex-col gap-3">
            {PROBABILITIES.map((probability) => (
              <li
                key={probability}
                className="flex flex-wrap items-center gap-4"
              >
                <span className="w-14 text-meta text-muted-foreground">
                  {(probability * 100).toFixed(1)} %
                </span>
                <ChanceFigure probability={probability} />
                <ChanceFigure
                  probability={probability}
                  phrasing="about"
                  showLeds={false}
                  size="sm"
                />
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 rounded-[0.875rem] bg-band p-4">
            <ChanceLeds lit={8} label="8 chances sur 10" tone="band" />
            <ChanceLeds
              lit={1}
              total={9}
              label="1 chance sur 9"
              tone="band"
              size="lg"
            />
          </div>
        </Section>

        <Section
          id="form"
          title="Forme"
          note="Gagné plein, perdu barré, remboursé traversé, en attente en contour, aucun coupon en gris."
        >
          <FormStrip outcomes={FORM} label="Forme sur 24 jours" />
          <FormStrip outcomes={FORM} size="sm" label="Forme, petite taille" />
          <FormStrip outcomes={GRID} columns={15} label="Grille des 90 jours" />
        </Section>

        <Section
          id="marks"
          title="Signes"
          note="SVG : Barlow n'a pas ces glyphes."
        >
          <div className="flex flex-wrap items-center gap-5">
            <ResultMark kind="won" label="gagné" />
            <ResultMark kind="lost" label="perdu" />
            <ResultMark kind="void" label="remboursé" />
            <ResultMark kind="diverges" label="l'IA n'est pas d'accord" />
            <ResultMark kind="won" size="sm" label="gagné" />
            <ResultMark kind="lost" size="lg" label="perdu" />
          </div>
        </Section>

        <Section id="rows" title="Lignes filetées">
          <RowList label="Exemples de lignes">
            <Row
              href="/dev/components"
              title="Combiné du jour"
              meta="3 matchs"
              value="1,41"
            />
            <Row
              href="/dev/components"
              title="Chasseur Nul"
              meta="Lazio – Torino, un nom de match très long pour voir le repli sur deux lignes sans troncature"
              value="3,40"
            />
            <Row
              title="Pas de Chasseur Corners aujourd'hui"
              meta="aucun championnat fiable ce soir"
              muted
            />
            <Row
              href="/dev/components"
              title="Favori · hier"
              value="1,24"
              trailing={<ResultMark kind="won" label="gagné" />}
            />
            <Row
              leading={
                <span className="score text-body font-semibold text-muted-foreground">
                  19:00
                </span>
              }
              title="Arsenal – Chelsea"
              meta="Premier League"
              value="7 sur 10"
            />
          </RowList>
        </Section>

        <Section
          id="chips"
          title="Puces"
          note="Des liens : le choix vit dans l'adresse."
        >
          <ChipGroup
            label="Période"
            items={[
              {
                key: "30",
                label: "30 j",
                href: "/dev/components",
                active: false,
              },
              {
                key: "90",
                label: "90 j",
                href: "/dev/components",
                active: true,
              },
              {
                key: "all",
                label: "Tout",
                href: "/dev/components",
                active: false,
              },
            ]}
          />
        </Section>

        <Section
          id="states"
          title="États communs"
          note="Le hors-ligne apparaît en coupant le réseau ; la maintenance a sa page."
        >
          <StateLine
            action={
              <Link href="/today" className={stateActionClass}>
                Aujourd&apos;hui
              </Link>
            }
          >
            Suis ton premier coupon
          </StateLine>
          <ShowcaseErrorStates />
          <PauseNotice until="5/11 à 19:00" />
          <div className="max-h-[28rem] overflow-hidden rounded-[0.875rem] border border-border">
            <ScreenSkeleton />
          </div>
          <Link href="/dev/components/maintenance" className={stateActionClass}>
            Voir la page de maintenance
          </Link>
        </Section>

        <Section
          id="sheet"
          title="Feuille"
          note="Ouverte ici, elle monte du bas ; chargée directement, c'est la page complète."
        >
          <Link
            id="open-sheet"
            href="/dev/components/sheet"
            className={stateActionClass}
          >
            Ouvrir la feuille
          </Link>
        </Section>
      </div>
    </>
  );
}
