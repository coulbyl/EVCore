import Link from "next/link";
import { Badge } from "@evcore/ui";
import type { AlertItem } from "@/domains/dashboard/types/dashboard";

export function ActiveAlerts({ alerts }: { alerts: AlertItem[] }) {
  return (
    <div className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Alertes actives
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
            Points d&apos;attention
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive">{alerts.length} ouvertes</Badge>
          <Link
            href="/dashboard/notifications"
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Voir tout →
          </Link>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="rounded-[1.2rem] border border-border bg-panel p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-foreground">{alert.title}</p>
              <Badge
                variant={
                  alert.severity === "high"
                    ? "destructive"
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
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {alert.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
