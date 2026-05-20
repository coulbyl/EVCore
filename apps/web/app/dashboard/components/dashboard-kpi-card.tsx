import { StatCard } from "@evcore/ui";
import type { KpiCard } from "@/domains/dashboard/types/dashboard";
import { KpiDelta } from "./kpi-delta";

export function DashboardKpiCard({ item }: { item: KpiCard }) {
  return (
    <StatCard
      label={item.label}
      value={item.value}
      tone={item.tone}
      delta={<KpiDelta delta={item.delta} />}
    />
  );
}
