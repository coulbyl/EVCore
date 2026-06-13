"use client";

import { useState } from "react";
import { Badge, Button } from "@evcore/ui";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  Database,
  ListOrdered,
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
    icon: <Database size={14} />,
    description: "fixtures → settlement → stats → injuries → odds-csv → elo",
  },
  {
    kind: "global",
    type: "fixtures",
    label: "Fixtures",
    icon: <RefreshCw size={14} />,
    description: "Matchs saison courante",
  },
  {
    kind: "global",
    type: "stats",
    label: "Stats",
    icon: <TrendingUp size={14} />,
    description: "xG, forme, stats saison courante",
  },
  {
    kind: "global",
    type: "injuries",
    label: "Blessures",
    icon: <Stethoscope size={14} />,
    description: "Sync des absences",
  },
  {
    kind: "global",
    type: "settlement",
    label: "Règlement",
    icon: <CheckCircle2 size={14} />,
    description: "Paris en attente → résultats",
  },
  {
    kind: "global",
    type: "stale-scheduled",
    label: "Stale scheduled",
    icon: <AlertCircle size={14} />,
    description: "Fixtures périmées",
  },
  {
    kind: "global",
    type: "elo",
    label: "Elo",
    icon: <Trophy size={14} />,
    description: "Recalcul des ratings Elo",
  },
  {
    kind: "global",
    type: "odds-csv",
    label: "Odds CSV",
    icon: <Zap size={14} />,
    description: "Import cotes football-data.co.uk",
  },
  {
    kind: "global",
    type: "standings",
    label: "Standings",
    icon: <ListOrdered size={14} />,
    description: "Classements des compétitions configurées (WC)",
  },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type RowStatus = { ok: boolean; ts?: string; error?: string } | null;

function ActionRow({ def }: { def: ActionDef }) {
  const [status, setStatus] = useState<RowStatus>(null);
  const fullSync = useTriggerFullSync();
  const globalSync = useTriggerGlobalSync(
    def.kind === "global" ? def.type : "fixtures",
  );
  const mutation = def.kind === "full" ? fullSync : globalSync;

  async function handleTrigger() {
    setStatus(null);
    try {
      if (def.kind === "full") await fullSync.mutateAsync();
      else await globalSync.mutateAsync(undefined);
      setStatus({ ok: true, ts: formatTime(new Date()) });
    } catch (err) {
      setStatus({
        ok: false,
        error: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }

  return (
    <div className="flex items-center gap-4 py-3">
      <span className="shrink-0 text-muted-foreground">{def.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{def.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {def.description}
        </p>
        {status?.error && (
          <p className="mt-0.5 text-xs text-danger">{status.error}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {status?.ok && (
          <div className="flex flex-col items-end gap-0.5">
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleTrigger}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "En cours…" : "Déclencher"}
        </Button>
      </div>
    </div>
  );
}

function MlRetrainRow() {
  const [status, setStatus] = useState<
    (RowStatus & { queued?: number }) | null
  >(null);
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
    <div className="flex items-center gap-4 py-3">
      <span className="shrink-0 text-muted-foreground">
        <BrainCircuit size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">ML Retrain</p>
        <p className="truncate text-xs text-muted-foreground">
          Force re-entraînement sur tous les segments
        </p>
        {status?.error && (
          <p className="mt-0.5 text-xs text-danger">{status.error}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {status?.ok && (
          <div className="flex flex-col items-end gap-0.5">
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleTrigger}
          disabled={retrainCheck.isPending}
        >
          {retrainCheck.isPending ? "En cours…" : "Déclencher"}
        </Button>
      </div>
    </div>
  );
}

export function GlobalActionsSection() {
  return (
    <section className="flex flex-col gap-3">
      <p className="text-[0.72rem] font-semibold uppercase tracking-widest text-muted-foreground">
        Syncs ETL
      </p>
      <div className="divide-y divide-border rounded-[1.1rem] border border-border bg-panel">
        {ACTIONS.map((def) => (
          <div key={def.label} className="px-4">
            <ActionRow def={def} />
          </div>
        ))}
        <div className="px-4">
          <MlRetrainRow />
        </div>
      </div>
    </section>
  );
}
