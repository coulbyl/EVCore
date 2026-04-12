"use client";

import type { KpiCard } from "@/domains/dashboard/types/dashboard";
import { useIsMobile } from "@/hooks/use-mobile";
import { DashboardKpiCard } from "./dashboard-kpi-card";

export function KpiCards({ items }: { items: KpiCard[] }) {
  const isMobile = useIsMobile();

  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {items.map((item) => (
        <DashboardKpiCard key={item.label} item={item} compact={isMobile} />
      ))}
    </section>
  );
}
