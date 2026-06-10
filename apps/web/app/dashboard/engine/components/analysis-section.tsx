import { useState } from "react";
import { Badge, Button } from "@evcore/ui";
import { BrainCircuit, CheckCircle2, Layers } from "lucide-react";
import {
  useTriggerAnalysisHorizon,
  useTriggerBettingEngineDate,
  useTriggerGlobalSync,
} from "@/domains/etl/use-cases/use-etl";
import type { EtlHorizonResult } from "@/domains/etl/types/etl";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function DateInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[0.65rem] font-medium text-muted-foreground">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-xl border border-border bg-panel px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}

function BettingEngineCard() {
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);
  const trigger = useTriggerBettingEngineDate();

  async function handleAnalyze() {
    setStatus(null);
    try {
      await trigger.mutateAsync(date);
      setStatus({ ok: true });
    } catch (err) {
      setStatus({
        ok: false,
        error: err instanceof Error ? err.message : "Erreur",
      });
    }
  }

  return (
    <div className="bento-cell flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-secondary text-accent">
          <BrainCircuit size={16} />
        </span>
        <div>
          <p className="font-semibold text-foreground">Moteur de paris</p>
          <p className="text-xs text-muted-foreground">
            Déclenche l&apos;analyse betting engine pour une date précise.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <DateInput label="Date" value={date} onChange={setDate} />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAnalyze}
          disabled={trigger.isPending || !date}
        >
          {trigger.isPending ? "En cours…" : "Analyser"}
          {status?.ok && (
            <CheckCircle2 size={13} className="ml-1 text-success" />
          )}
        </Button>
      </div>
      {status?.error && <p className="text-xs text-danger">{status.error}</p>}
    </div>
  );
}

function OddsPrematchCard() {
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);
  const trigger = useTriggerGlobalSync("odds-prematch");

  async function handleSync() {
    setStatus(null);
    try {
      await trigger.mutateAsync(date);
      setStatus({ ok: true });
    } catch (err) {
      setStatus({
        ok: false,
        error: err instanceof Error ? err.message : "Erreur",
      });
    }
  }

  return (
    <div className="bento-cell flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-secondary text-accent">
          <Layers size={16} />
        </span>
        <div>
          <p className="font-semibold text-foreground">Odds prematch</p>
          <p className="text-xs text-muted-foreground">
            Sync des cotes avant-match pour une date donnée.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <DateInput label="Date" value={date} onChange={setDate} />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={trigger.isPending || !date}
        >
          {trigger.isPending ? "En cours…" : "Synchroniser"}
          {status?.ok && (
            <CheckCircle2 size={13} className="ml-1 text-success" />
          )}
        </Button>
      </div>
      {status?.error && <p className="text-xs text-danger">{status.error}</p>}
    </div>
  );
}

function HorizonCard() {
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [result, setResult] = useState<EtlHorizonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trigger = useTriggerAnalysisHorizon();

  async function handleHorizon() {
    setResult(null);
    setError(null);
    try {
      const r = await trigger.mutateAsync(
        startDate || endDate
          ? { startDate: startDate || undefined, endDate: endDate || undefined }
          : undefined,
      );
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="bento-cell flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-secondary text-accent">
          <Layers size={16} />
        </span>
        <div>
          <p className="font-semibold text-foreground">Rolling horizon</p>
          <p className="text-xs text-muted-foreground">
            Odds prematch + analyse pour J+1..J+4 (fenêtre glissante).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <DateInput
          label="Début (optionnel)"
          value={startDate}
          onChange={setStartDate}
        />
        <DateInput
          label="Fin (optionnel)"
          value={endDate}
          onChange={setEndDate}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleHorizon}
          disabled={trigger.isPending}
        >
          {trigger.isPending ? "En cours…" : "Lancer l'horizon"}
        </Button>
      </div>

      {result && (
        <div className="flex flex-wrap gap-1.5">
          {result.enqueuedDates.map((d) => (
            <Badge
              key={d}
              variant="neutral"
              className="font-mono text-[0.6rem]"
            >
              {d}
            </Badge>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function AnalysisSection() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <BrainCircuit size={14} className="text-accent" />
        <p className="text-[0.72rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Analyse & odds
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <BettingEngineCard />
        <OddsPrematchCard />
        <HorizonCard />
      </div>
    </section>
  );
}
