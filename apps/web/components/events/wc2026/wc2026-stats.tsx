"use client";

import { useState } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@evcore/ui";

type StatKey = "equipes" | "groupes" | "matchs" | "hotes";

const CONFEDERATIONS = [
  {
    name: "UEFA",
    flag: "🇪🇺",
    count: 16,
    teams: [
      "Allemagne",
      "France",
      "Espagne",
      "Angleterre",
      "Portugal",
      "Pays-Bas",
      "Belgique",
      "Italie",
      "Croatie",
      "Suisse",
      "Autriche",
      "Turquie",
      "Écosse",
      "Hongrie",
      "Slovaquie",
      "Serbie",
    ],
  },
  {
    name: "CONMEBOL",
    flag: "🌎",
    count: 6,
    teams: [
      "Argentine",
      "Brésil",
      "Uruguay",
      "Colombie",
      "Équateur",
      "Venezuela",
    ],
  },
  {
    name: "CONCACAF",
    flag: "🌍",
    count: 6,
    teams: [
      "États-Unis",
      "Canada",
      "Mexique",
      "Panama",
      "Jamaïque",
      "Costa Rica",
    ],
  },
  {
    name: "CAF",
    flag: "🌍",
    count: 9,
    teams: [
      "Maroc",
      "Sénégal",
      "Cameroun",
      "Nigeria",
      "Côte d'Ivoire",
      "Égypte",
      "Afrique du Sud",
      "Mali",
      "Tunisie",
    ],
  },
  {
    name: "AFC",
    flag: "🌏",
    count: 8,
    teams: [
      "Japon",
      "Corée du Sud",
      "Australie",
      "Iran",
      "Arabie Saoudite",
      "Qatar",
      "Ouzbékistan",
      "Jordanie",
    ],
  },
  {
    name: "OFC",
    flag: "🌏",
    count: 1,
    teams: ["Nouvelle-Zélande"],
  },
  {
    name: "Barrages inter-zones",
    flag: "🔀",
    count: 2,
    teams: ["À déterminer", "À déterminer"],
  },
];

const PHASES = [
  { phase: "Phase de groupes", matches: 72, note: "12 groupes × 6 matchs" },
  { phase: "Barrages (32→16)", matches: 16, note: "8 double confrontations" },
  { phase: "Huitièmes de finale", matches: 8, note: "" },
  { phase: "Quarts de finale", matches: 4, note: "" },
  { phase: "Demi-finales", matches: 2, note: "" },
  { phase: "Match pour la 3e place", matches: 1, note: "" },
  { phase: "Finale", matches: 1, note: "" },
];

const HOST_COUNTRIES = [
  {
    name: "États-Unis",
    flag: "🇺🇸",
    cities: [
      "New York/New Jersey",
      "Los Angeles",
      "Dallas",
      "San Francisco",
      "Miami",
      "Seattle",
      "Boston",
      "Atlanta",
      "Kansas City",
      "Philadelphia",
      "Houston",
    ],
  },
  {
    name: "Canada",
    flag: "🇨🇦",
    cities: ["Toronto", "Vancouver"],
  },
  {
    name: "Mexique",
    flag: "🇲🇽",
    cities: ["Mexico City", "Guadalajara", "Monterrey"],
  },
];

const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const DETAIL: Record<StatKey, { title: string; content: React.ReactNode }> = {
  equipes: {
    title: "48 équipes qualifiées",
    content: (
      <div className="space-y-4">
        {CONFEDERATIONS.map((conf) => (
          <div key={conf.name}>
            <p className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
              {conf.flag} {conf.name} — {conf.count} équipe
              {conf.count > 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {conf.teams.map((team, i) => (
                <span
                  key={`${team}-${i}`}
                  className="rounded-md border border-border bg-panel px-2 py-0.5 text-xs text-foreground"
                >
                  {team}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  groupes: {
    title: "12 groupes",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          4 équipes par groupe · Top 2 qualifiés + 8 meilleurs 3es
        </p>
        <div className="grid grid-cols-3 gap-2">
          {GROUPS.map((g) => (
            <div
              key={g}
              className="flex h-14 flex-col items-center justify-center rounded-xl border border-border bg-panel"
            >
              <span className="text-lg font-bold text-foreground">
                Groupe {g}
              </span>
              <span className="text-[0.65rem] text-muted-foreground">
                4 équipes
              </span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-panel p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Qualification</p>
          <p className="mt-1">
            Les 2 premiers de chaque groupe se qualifient directement. Les 8
            meilleurs 3es (sur 12) complètent le tableau des huitièmes.
          </p>
        </div>
      </div>
    ),
  },
  matchs: {
    title: "104 matchs",
    content: (
      <div className="space-y-2">
        {PHASES.map(({ phase, matches, note }) => (
          <div
            key={phase}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{phase}</p>
              {note ? (
                <p className="text-xs text-muted-foreground">{note}</p>
              ) : null}
            </div>
            <span className="shrink-0 text-lg font-bold tabular-nums text-foreground">
              {matches}
            </span>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between rounded-xl border border-[#c9a84c]/30 bg-[#c9a84c]/10 px-4 py-3">
          <span className="text-sm font-bold text-[#c9a84c]">Total</span>
          <span className="text-lg font-bold tabular-nums text-[#c9a84c]">
            104
          </span>
        </div>
      </div>
    ),
  },
  hotes: {
    title: "3 pays hôtes",
    content: (
      <div className="space-y-4">
        {HOST_COUNTRIES.map(({ name, flag, cities }) => (
          <div
            key={name}
            className="rounded-xl border border-border bg-panel p-4"
          >
            <p className="mb-2 text-base font-bold text-foreground">
              {flag} {name}
            </p>
            <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
              {cities.length} ville{cities.length > 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cities.map((city) => (
                <span
                  key={city}
                  className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                >
                  {city}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  },
};

const STATS: { label: string; value: string; key: StatKey }[] = [
  { label: "Équipes", value: "48", key: "equipes" },
  { label: "Groupes", value: "12", key: "groupes" },
  { label: "Matchs", value: "104", key: "matchs" },
  { label: "Pays hôtes", value: "3", key: "hotes" },
];

export function WC2026Stats() {
  const [open, setOpen] = useState<StatKey | null>(null);
  const detail = open ? DETAIL[open] : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map(({ label, value, key }) => (
          <button
            key={key}
            onClick={() => setOpen(key)}
            className="rounded-xl border border-border bg-panel p-4 text-center transition-colors hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5 active:scale-95"
          >
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-[0.6rem] font-medium text-[#c9a84c]/70">
              Voir détails →
            </p>
          </button>
        ))}
      </div>

      <Drawer open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DrawerContent className="z-50 flex max-h-[92dvh] flex-col rounded-t-[1.6rem] border-t border-border bg-panel-strong focus:outline-none">
          <DrawerTitle className="sr-only">{detail?.title}</DrawerTitle>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-10 sm:p-5">
            {detail ? (
              <div className="space-y-4">
                <p className="text-base font-bold text-foreground">
                  {detail.title}
                </p>
                {detail.content}
              </div>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
