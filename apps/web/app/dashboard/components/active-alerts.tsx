"use client";

import { Bell, BellOff } from "lucide-react";
import { Skeleton } from "@evcore/ui";
import type { AlertItem } from "@/domains/dashboard/types/dashboard";

const SEVERITY_STYLES = {
  high: "bg-danger/10 text-danger border-danger/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-border/60 text-muted-foreground border-border",
} as const;

const SEVERITY_LABEL: Record<AlertItem["severity"], string> = {
  high: "Critique",
  medium: "Attention",
  low: "Info",
};

function AlertRow({ item }: { item: AlertItem }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${SEVERITY_STYLES[item.severity]}`}
      >
        {SEVERITY_LABEL[item.severity]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{item.title}</p>
        {item.detail && (
          <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
        )}
      </div>
    </div>
  );
}

type Props = {
  alerts: AlertItem[];
  isLoading: boolean;
  isError: boolean;
};

export function ActiveAlerts({ alerts, isLoading, isError }: Props) {
  return (
    <div className="bento-cell flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Bell size={15} className="text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Alertes actives
        </span>
        {!isLoading && alerts.length > 0 && (
          <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-danger text-[0.6rem] font-bold text-white">
            {alerts.length}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="mt-0.5 h-5 w-14 shrink-0 rounded" />
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
          <p className="text-xs text-danger">Impossible de charger les alertes.</p>
        </div>
      )}

      {!isLoading && !isError && alerts.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <BellOff size={24} className="text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Aucune alerte active</p>
        </div>
      )}

      {!isLoading && !isError && alerts.length > 0 && (
        <div className="flex max-h-64 flex-col gap-3 overflow-y-auto">
          {alerts.map((a) => (
            <AlertRow key={a.id} item={a} />
          ))}
        </div>
      )}
    </div>
  );
}
