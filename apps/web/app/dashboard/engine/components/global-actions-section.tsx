"use client";

import { useState } from "react";
import { Badge, Button } from "@evcore/ui";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  Database,
  RefreshCw,
  Stethoscope,
  Trophy,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  useTriggerFullSync,
  useTriggerGlobalSync,
} from "@/domains/etl/use-cases/use-etl";
import { useTriggerRetrainCheck } from "@/domains/ml/use-cases/use-ml";
import type { GlobalSyncType } from "@/domains/etl/types/etl";

type ActionDef = {
  label: string;
  description: string;
  icon: React.ReactNode;
} & ({ kind: "full" } | { kind: "global"; type: GlobalSyncType });

const ACTIONS: ActionDef[] = [
  {
    kind: "full",
    label: "Sync complet",
    icon: <Database size={13} />,
    description: "fixtures → settlement → stats → injuries → odds-csv → elo",
  },
  {
    kind: "global",
    type: "fixtures",
    label: "Fixtures",
    icon: <RefreshCw size={13} />,
    description: "Matchs saison courante",
  },
  {
    kind: "global",
    type: "stats",
    label: "Stats",
    icon: <TrendingUp size={13} />,
    description: "xG, forme, stats saison courante",
  },
  {
    kind: "global",
    type: "injuries",
    label: "Blessures",
    icon: <Stethoscope size={13} />,
    description: "Sync des absences",
  },
  {
    kind: "global",
    type: "settlement",
    label: "Règlement",
    icon: <CheckCircle2 size={13} />,
    description: "Paris en attente → résultats",
  },
  {
    kind: "global",
    type: "stale-scheduled",
    label: "Stale scheduled",
    icon: <AlertCircle size={13} />,
    description: "Fixtures périmées",
  },
  {
    kind: "global",
    type: "elo",
    label: "Elo",
    icon: <Trophy size={13} />,
    description: "Recalcul des ratings Elo",
  },
  {
    kind: "global",
    type: "odds-csv",
    label: "Odds CSV",
    icon: <Zap size={13} />,
    description: "Import cotes football-data.co.uk",
  },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function ActionCard({ def }: { def: ActionDef }) {
  const [status, setStatus] = useState<{
    ok: boolean;
    ts?: string;
    error?: string;
  } | null>(null);
  const fullSync = useTriggerFullSync();
  const globalSync = useTriggerGlobalSync(
    def.kind === "global" ? def.type : "fixtures",
  );
  const mutation = def.kind === "full" ? fullSync : globalSync;

  async function handleTrigger() {
    setStatus(null);
    try {
      if (def.kind === "full") {
        await fullSync.mutateAsync();
      } else {
        await globalSync.mutateAsync(undefined);
      }
      setStatus({ ok: true, ts: formatTime(new Date()) });
    } catch (err) {
      setStatus({
        ok: false,
        error: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[1.1rem] border border-border bg-panel px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-accent">{def.icon}</span>
            <p className="text-sm font-semibold text-foreground">{def.label}</p>
          </div>
          <p className="text-[0.65rem] text-muted-foreground">
            {def.description}
          </p>
        </div>
        {status?.ok && (
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <Badge variant="success" className="text-[0.6rem]">
              OK
            </Badge>
            {status.ts && (
              <span className="text-[0.58rem] text-muted-foreground/60">
                {status.ts}
              </span>
            )}
          </div>
        )}
      </div>
      {status?.error && (
        <p className="text-[0.65rem] text-danger">{status.error}</p>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleTrigger}
        disabled={mutation.isPending}
        className="self-start"
      >
        {mutation.isPending ? "En cours…" : "Déclencher"}
      </Button>
    </div>
  );
}

function MlRetrainCard() {
  const [status, setStatus] = useState<{
    ok: boolean;
    queued?: number;
    ts?: string;
    error?: string;
  } | null>(null);
  const retrainCheck = useTriggerRetrainCheck();

  async function handleTrigger() {
    setStatus(null);
    try {
      const res = await retrainCheck.mutateAsync();
      setStatus({ ok: true, queued: res.queued, ts: formatTime(new Date()) });
    } catch (err) {
      setStatus({
        ok: false,
        error: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[1.1rem] border border-border bg-panel px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-accent">
              <BrainCircuit size={13} />
            </span>
            <p className="text-sm font-semibold text-foreground">ML Retrain</p>
          </div>
          <p className="text-[0.65rem] text-muted-foreground">
            Force re-entraînement sur tous les segments
          </p>
        </div>
        {status?.ok && (
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <Badge variant="success" className="text-[0.6rem]">
              {status.queued ?? 0} job{(status.queued ?? 0) !== 1 ? "s" : ""}
            </Badge>
            {status.ts && (
              <span className="text-[0.58rem] text-muted-foreground/60">
                {status.ts}
              </span>
            )}
          </div>
        )}
      </div>
      {status?.error && (
        <p className="text-[0.65rem] text-danger">{status.error}</p>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleTrigger}
        disabled={retrainCheck.isPending}
        className="self-start"
      >
        {retrainCheck.isPending ? "En cours…" : "Déclencher"}
      </Button>
    </div>
  );
}

export function GlobalActionsSection() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <RefreshCw size={14} className="text-accent" />
        <p className="text-[0.72rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Actions globales
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((def) => (
          <ActionCard key={def.label} def={def} />
        ))}
        <MlRetrainCard />
      </div>
    </section>
  );
}
