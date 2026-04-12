import { StatCard } from "@evcore/ui";
import type { KpiCard } from "@/domains/dashboard/types/dashboard";
import { formatCompactValue } from "@/helpers/number";
import { KpiDelta } from "./kpi-delta";

export function DashboardKpiCard({
  item,
  compact,
}: {
  item: KpiCard;
  compact: boolean;
}) {
  return (
    <StatCard
      label={item.label}
      value={compact ? formatCompactValue(item.value) : item.value}
      tone={item.tone}
      delta={<KpiDelta delta={item.delta} compact={compact} />}
      compact={compact}
    />
  );
}
