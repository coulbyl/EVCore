"use client";

import { CheckCircle2, AlertTriangle, XCircle, Activity } from "lucide-react";
import { Skeleton } from "@evcore/ui";
import { workerStatusLabel } from "@/domains/dashboard/helpers/worker-status-label";
import type { WorkerStatus } from "@/domains/dashboard/types/dashboard";

const STATUS_CONFIG = {
  healthy: { Icon: CheckCircle2, className: "text-success" },
  watch: { Icon: AlertTriangle, className: "text-warning" },
  late: { Icon: XCircle, className: "text-danger" },
} as const;

function WorkerRow({ item }: { item: WorkerStatus }) {
  const { Icon, className } = STATUS_CONFIG[item.status];
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 shrink-0 ${className}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {item.worker}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {item.lastRun}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {item.detail || workerStatusLabel(item.status)}
        </p>
      </div>
    </div>
  );
}

type Props = {
  workers: WorkerStatus[];
  isLoading: boolean;
  isError: boolean;
};

export function PipelineStatus({ workers, isLoading, isError }: Props) {
  return (
    <div className="bento-cell flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Activity size={15} className="text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Pipeline
        </span>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-1 items-center justify-center py-6">
          <p className="text-xs text-danger">Impossible de charger le pipeline.</p>
        </div>
      )}

      {!isLoading && !isError && workers.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <Activity size={24} className="text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Aucun worker actif</p>
        </div>
      )}

      {!isLoading && !isError && workers.length > 0 && (
        <div className="flex flex-col gap-3">
          {workers.map((w) => (
            <WorkerRow key={w.worker} item={w} />
          ))}
        </div>
      )}
    </div>
  );
}
