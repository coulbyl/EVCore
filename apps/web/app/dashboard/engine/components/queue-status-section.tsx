import { Skeleton } from "@evcore/ui";
import { AlertCircle, CheckCircle2, Clock, Loader2, Zap } from "lucide-react";
import type { EtlQueueStatus, QueueJobCounts } from "@/domains/etl/types/etl";

const QUEUE_LABELS: Record<string, string> = {
  "league-sync": "League sync",
  "pending-bets-settlement-sync": "Settlement",
  "stale-scheduled-sync": "Stale scheduled",
  "odds-csv-import": "Odds CSV",
  "elo-sync": "Elo",
  "odds-prematch-sync": "Odds prematch",
  "betting-engine": "Betting engine",
  "odds-historical-import": "Historical odds",
  "rolling-horizon": "Rolling horizon",
  "ml-backfill": "ML backfill",
};

function queueHealth(counts: QueueJobCounts): "ok" | "active" | "error" {
  if (counts.failed > 0) return "error";
  if (counts.active > 0 || counts.waiting > 0) return "active";
  return "ok";
}

function QueueCard({
  name,
  counts,
}: {
  name: string;
  counts: QueueJobCounts;
}) {
  const health = queueHealth(counts);

  const icon =
    health === "error" ? (
      <AlertCircle size={13} className="text-danger" />
    ) : health === "active" ? (
      <Loader2 size={13} className="animate-spin text-accent" />
    ) : (
      <CheckCircle2 size={13} className="text-success" />
    );

  return (
    <div className="flex flex-col gap-2 rounded-[1.1rem] border border-border bg-panel px-4 py-3">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-semibold text-foreground">
          {QUEUE_LABELS[name] ?? name}
        </p>
      </div>
      <div className="grid grid-cols-5 gap-1 text-center text-[0.6rem]">
        <Stat label="Active" value={counts.active} highlight="accent" />
        <Stat label="Wait" value={counts.waiting} highlight="warning" />
        <Stat label="Done" value={counts.completed} />
        <Stat label="Fail" value={counts.failed} highlight="danger" />
        <Stat label="Delayed" value={counts.delayed} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: "accent" | "warning" | "danger";
}) {
  const colorClass =
    value > 0 && highlight
      ? highlight === "accent"
        ? "text-accent"
        : highlight === "warning"
          ? "text-warning"
          : "text-danger"
      : "text-muted-foreground";

  return (
    <div className="flex flex-col gap-0.5">
      <span className={`tabular-nums font-semibold ${colorClass}`}>{value}</span>
      <span className="text-muted-foreground/60">{label}</span>
    </div>
  );
}

export function QueueStatusSection({
  data,
  isLoading,
}: {
  data: EtlQueueStatus | undefined;
  isLoading: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Zap size={14} className="text-accent" />
        <p className="text-[0.72rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Statut des queues
        </p>
        <span className="ml-auto flex items-center gap-1 text-[0.6rem] text-muted-foreground/50">
          <Clock size={10} />
          auto-refresh 5s
        </span>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[1.1rem]" />
          ))}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Object.entries(data).map(([name, counts]) => (
            <QueueCard key={name} name={name} counts={counts} />
          ))}
        </div>
      )}
    </section>
  );
}
