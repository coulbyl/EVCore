import { useState } from "react";
import { Badge, Button } from "@evcore/ui";
import {
  AlertCircle,
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

function ActionCard({ def }: { def: ActionDef }) {
  const [status, setStatus] = useState<{ ok: boolean; error?: string } | null>(
    null,
  );
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
      setStatus({ ok: true });
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
          <Badge variant="success" className="shrink-0 text-[0.6rem]">
            OK
          </Badge>
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
      </div>
    </section>
  );
}
