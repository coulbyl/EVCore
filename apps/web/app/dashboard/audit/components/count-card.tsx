import { StatCard } from "@evcore/ui";
import { formatCompactValue } from "@/helpers/number";

export function CountCard({ label, value }: { label: string; value: number }) {
  return <StatCard label={label} value={formatCompactValue(value)} tone="neutral" compact />;
}
