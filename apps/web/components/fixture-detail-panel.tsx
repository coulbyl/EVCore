"use client";

import { useState } from "react";
import * as HoverCard from "@radix-ui/react-hover-card";
import { Check, Copy, Info } from "lucide-react";

import { SettleFixtureDialog } from "./settle-fixture-dialog";
import { FixtureName, formatPickForDisplay } from "./coupon-detail";
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

function CopyFixtureId({ fixtureId }: { fixtureId: string }) {
  const [copied, setCopied] = useState(false);
  if (!fixtureId) return null;
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(fixtureId).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title={fixtureId}
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.65rem] font-mono text-slate-400 hover:bg-slate-100 hover:text-slate-600"
    >
      <span>{fixtureId.slice(0, 8)}</span>
      {copied ? (
        <Check size={10} className="text-success" />
      ) : (
        <Copy size={10} />
      )}
    </button>
  );
}

export function FixtureDetailPanel({ fixture }: { fixture: FixturePanel }) {
  const cotes = fixture.metrics.find((m) => m.label === "Cotes");
  const coreMetrics = fixture.metrics.filter((m) => m.label !== "Cotes");

  return (
    <div className="rounded-[1.7rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Match clé
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {fixture.competition} • {fixture.startTime}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <CopyFixtureId fixtureId={fixture.fixtureId} />
          {fixture.fixtureId && (
            <SettleFixtureDialog
              fixtureId={fixture.fixtureId}
              fixtureName={fixture.fixture}
            />
          )}
        </div>
      </div>

      {/* Fixture name */}
      <FixtureName
        fixture={fixture.fixture}
        homeLogo={fixture.homeLogo}
        awayLogo={fixture.awayLogo}
        className="mt-4 text-[1.4rem] font-semibold leading-snug text-slate-900"
      />

      {/* Pick + cote */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-stretch">
          <div className="flex-1 px-4 py-4">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Sélection
            </p>
            <p className="mt-1.5 text-[1.05rem] font-bold tracking-tight text-white">
              {formatPickForDisplay(fixture.pick, fixture.market)}
            </p>
          </div>
          {cotes && (
            <div className="flex flex-col items-center justify-center border-l border-slate-800 bg-slate-800/60 px-5">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Cote
              </p>
              <p className="mt-0.5 text-[1.75rem] font-bold tabular-nums leading-none text-white">
                {cotes.value}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {coreMetrics.map((metric) => (
          <MetricRow
            key={metric.label}
            label={metric.label}
            value={metric.value}
            tone={metric.tone}
          />
        ))}
      </div>
    </div>
  );
}
