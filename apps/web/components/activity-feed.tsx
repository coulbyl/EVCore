import { SectionHeader } from "@evcore/ui";
import type { ActivityItem } from "../types/dashboard";

const levelClassName: Record<ActivityItem["level"], string> = {
  INFO: "text-sky-700",
  WARN: "text-warning",
  BET: "text-success",
  ALERT: "text-danger",
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-[1.7rem] border border-border bg-panel-strong p-6 ev-shell-shadow">
      <SectionHeader title="Activité" subtitle="Signaux opérateur récents" />
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div
            key={`${item.time}-${item.message}`}
            className="grid grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-100 bg-[linear-gradient(180deg,#fbfcfe_0%,#f3f6fb_100%)] px-3.5 py-3 text-sm"
          >
            <span className="font-mono text-slate-500">{item.time}</span>
            <p className="text-slate-600">
              <span className={levelClassName[item.level]}>[{item.level}]</span>{" "}
              {item.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
