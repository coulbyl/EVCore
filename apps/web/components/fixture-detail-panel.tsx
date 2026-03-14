"use client";

import * as HoverCard from "@radix-ui/react-hover-card";
import { Info } from "lucide-react";
import { Badge, Code, SectionHeader } from "@evcore/ui";
import type { FixturePanel } from "../types/dashboard";

const METRIC_HINTS: Record<string, string> = {
  EV: "Expected Value — valeur attendue du pari. Formule : (probabilité modèle × cotes) − 1. Un EV ≥ 0.08 est requis pour déclencher une décision BET dans EVCore.",
  Qualité:
    "Score composite de qualité du run modèle (0–100). Combine fiabilité des données, couverture xG et cohérence des features. Plus il est élevé, plus le modèle est confiant dans son analyse.",
  Déterministe:
    "Score de la partie algorithmique du modèle, représentant 70 % du score final. Calculé à partir des stats historiques sans intervention LLM — stable et reproductible entre runs.",
  Cotes:
    "Cote brute capturée au moment de l'analyse (odds snapshot). Reflète la probabilité implicite du bookmaker. L'écart entre cette cote et la probabilité modèle détermine l'EV.",
};

const toneBar: Record<string, string> = {
  accent: "border-accent",
  success: "border-success",
  warning: "border-warning",
  danger: "border-danger",
  neutral: "border-slate-300",
};

function MetricRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  const hint = METRIC_HINTS[label];
  return (
    <div className="rounded-xl border border-border bg-panel-strong px-3 py-2.5 shadow-sm">
      <div className={`border-b-2 pb-1.5 ${toneBar[tone] ?? toneBar.neutral}`}>
        <div className="flex items-center gap-1.5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {label}
          </p>
          {hint ? (
            <HoverCard.Root openDelay={200} closeDelay={100}>
              <HoverCard.Trigger asChild>
                <button
                  type="button"
                  className="flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={`En savoir plus sur ${label}`}
                >
                  <Info size={11} strokeWidth={2} />
                </button>
              </HoverCard.Trigger>
              <HoverCard.Portal>
                <HoverCard.Content
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="z-50 w-64 rounded-2xl border border-border bg-white p-4 shadow-lg"
                >
                  <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {label}
                  </p>
                  <p className="text-sm leading-6 text-slate-700">{hint}</p>
                  <HoverCard.Arrow className="fill-white" />
                </HoverCard.Content>
              </HoverCard.Portal>
            </HoverCard.Root>
          ) : null}
        </div>
        <p className="mt-1 text-[1.2rem] font-semibold tracking-tight text-slate-950">
          {value}
        </p>
      </div>
    </div>
  );
}

export function FixtureDetailPanel({ fixture }: { fixture: FixturePanel }) {
  const previewNotes = fixture.notes.slice(0, 2);

  return (
    <div className="rounded-[1.7rem] border border-border bg-panel-strong p-6 ev-shell-shadow">
      <SectionHeader title="Match clé" subtitle="Synthèse modèle" />
      <div className="mt-5 space-y-5">
        <div>
          <p className="text-[1.72rem] font-semibold leading-tight text-slate-900">
            {fixture.fixture}
          </p>
          <p className="mt-2 text-sm text-muted">
            {fixture.competition} • Début {fixture.startTime}
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-border bg-[linear-gradient(180deg,#f8fafc_0%,#eef4f8_100%)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">Sélection</Badge>
            <Code className="rounded-md bg-white px-2 py-1 text-xs">
              {fixture.market}
            </Code>
          </div>
          <p className="mt-2.5 text-base font-semibold tracking-tight text-slate-900">
            {fixture.pick}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {fixture.modelConfidence}
          </p>
        </div>
        <div className="grid gap-2">
          {fixture.metrics.map((metric) => (
            <MetricRow
              key={metric.label}
              label={metric.label}
              value={metric.value}
              tone={metric.tone}
            />
          ))}
        </div>
        <div className="space-y-2.5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Notes de décision
          </p>
          {previewNotes.map((note) => (
            <div
              key={note}
              className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm text-slate-600"
            >
              {note}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
