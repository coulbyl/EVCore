import { Skeleton } from "@evcore/ui";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Trash2,
  Zap,
} from "lucide-react";
import type {
  EtlQueueStatus,
  EtlSchedulerEntry,
  QueueJobCounts,
} from "@/domains/etl/types/etl";
import {
  useClearQueueFailed,
  useEtlSchedulers,
} from "@/domains/etl/use-cases/use-etl";

const QUEUE_LABELS: Record<string, string> = {
  "league-sync": "League sync",
  "pending-bets-settlement-sync": "Settlement",
  "stale-scheduled-sync": "Stale scheduled",
  "odds-csv-import": "Odds CSV",
  "elo-sync": "Elo",
  "odds-prematch-sync": "Odds prematch",
  "betting-engine": "Betting engine",
  "betting-engine-rebuild": "Rebuild engine",
  "odds-historical-import": "Historical odds",
  "rolling-horizon": "Rolling horizon",
  "ai-engine": "AI Engine",
  "ml-training": "ML training",
  "ml-scheduler": "ML scheduler",
};

function queueHealth(counts: QueueJobCounts): "ok" | "active" | "error" {
  if (counts.failed > 0) return "error";
  if (counts.active > 0 || counts.waiting > 0) return "active";
  return "ok";
}

function formatNextRun(next: number): string {
  const date = new Date(next);
  const now = Date.now();
  const diffMs = next - now;
  if (diffMs <= 0) return "en cours";
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 60) return `dans ${diffMin}min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `dans ${diffH}h`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function QueueCard({
  name,
  counts,
  nextRun,
  onClearFailed,
  isClearing,
}: {
  name: string;
  counts: QueueJobCounts;
  nextRun?: number;
  onClearFailed?: () => void;
  isClearing?: boolean;
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
        {onClearFailed && (
          <button
            className="ml-auto flex items-center gap-0.5 rounded px-1 py-0.5 text-[0.58rem] text-danger hover:bg-danger/10 disabled:opacity-50"
            onClick={onClearFailed}
            disabled={isClearing}
            title="Clear failed jobs"
          >
            <Trash2 size={10} />
            Clear
          </button>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1 text-center text-[0.6rem]">
        <Stat label="Active" value={counts.active} highlight="accent" />
        <Stat label="Wait" value={counts.waiting} highlight="warning" />
        <Stat label="Done" value={counts.completed} />
        <Stat label="Fail" value={counts.failed} highlight="danger" />
        <Stat label="Delayed" value={counts.delayed} />
      </div>
      {nextRun !== undefined && (
        <p className="flex items-center gap-1 text-[0.58rem] text-muted-foreground/60">
          <Clock size={9} />
          {formatNextRun(nextRun)}
        </p>
      )}
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
      <span className={`tabular-nums font-semibold ${colorClass}`}>
        {value}
      </span>
      <span className="text-muted-foreground/60">{label}</span>
    </div>
  );
}

function getNextRunForQueue(
  schedulers: EtlSchedulerEntry[],
  queueName: string,
): number | undefined {
  const entries = schedulers.filter((s) => s.queueName === queueName);
  const nexts = entries
    .map((s) => s.next)
    .filter((n): n is number => n !== undefined);
  return nexts.length > 0 ? Math.min(...nexts) : undefined;
}

export function QueueStatusSection({
  data,
  isLoading,
}: {
  data: EtlQueueStatus | undefined;
  isLoading: boolean;
}) {
  const { data: schedulers } = useEtlSchedulers();
  const clearFailed = useClearQueueFailed();

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
            <QueueCard
              key={name}
              name={name}
              counts={counts}
              nextRun={
                schedulers ? getNextRunForQueue(schedulers, name) : undefined
              }
              onClearFailed={
                counts.failed > 0 ? () => clearFailed.mutate(name) : undefined
              }
              isClearing={clearFailed.isPending}
            />
          ))}
        </div>
      )}
    </section>
  );
}
