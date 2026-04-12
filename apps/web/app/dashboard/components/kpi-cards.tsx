"use client";

import type { KpiCard } from "@/domains/dashboard/types/dashboard";
import { useIsMobile } from "@/hooks/use-mobile";
import { DashboardKpiCard } from "./dashboard-kpi-card";

export function KpiCards({ items }: { items: KpiCard[] }) {
  const isMobile = useIsMobile();

  return (
    <section
      className="grid grid-cols-2 gap-3 sm:gap-4"
      style={{
        gridTemplateColumns: `repeat(${isMobile ? 2 : items.length}, minmax(0, 1fr))`,
      }}
    >
      {items.map((item) => (
        <DashboardKpiCard key={item.label} item={item} compact={isMobile} />
      ))}
    </section>
  );
}
