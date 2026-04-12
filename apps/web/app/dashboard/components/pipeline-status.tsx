import { Badge } from "@evcore/ui";
import { workerStatusLabel } from "@/domains/dashboard/helpers/worker-status-label";
import type { WorkerStatus } from "@/domains/dashboard/types/dashboard";

export function PipelineStatus({ workers }: { workers: WorkerStatus[] }) {
  return (
    <div className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            État du pipeline
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
            ETL et scoring
          </h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {workers.map((worker) => (
          <div
            key={worker.worker}
            className="rounded-2xl border border-border bg-slate-50 px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">
                {worker.worker}
              </p>
              <Badge
                tone={
                  worker.status === "healthy"
                    ? "success"
                    : worker.status === "watch"
                      ? "warning"
                      : "danger"
                }
              >
                {workerStatusLabel(worker.status)}
              </Badge>
            </div>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
              Dernière exécution {worker.lastRun}
            </p>
            <p className="mt-2 text-sm text-slate-600">{worker.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
