import { EvBadge } from "@evcore/ui";
import type { AlertItem } from "@/domains/dashboard/types/dashboard";

export function ActiveAlerts({ alerts }: { alerts: AlertItem[] }) {
  return (
    <div className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Alertes actives
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
            Points d&apos;attention
          </h2>
        </div>
        <EvBadge tone="danger">{alerts.length} ouvertes</EvBadge>
      </div>
      <div className="mt-4 space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="rounded-[1.2rem] border border-border bg-slate-50/90 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-800">{alert.title}</p>
              <EvBadge
                tone={
                  alert.severity === "high"
                    ? "danger"
                    : alert.severity === "medium"
                      ? "warning"
                      : "neutral"
                }
              >
                {alert.severity === "high"
                  ? "élevée"
                  : alert.severity === "medium"
                    ? "moyenne"
                    : "faible"}
              </EvBadge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {alert.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
