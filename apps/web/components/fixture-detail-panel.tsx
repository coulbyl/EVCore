import { Badge, Code, SectionHeader, StatCard } from "@evcore/ui";
import type { FixturePanel } from "../types/dashboard";

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
            <StatCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              tone={metric.tone ?? "neutral"}
              compact
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
