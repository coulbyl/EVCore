"use client";

import type { KpiCard } from "@/domains/dashboard/types/dashboard";
import { DashboardKpiCard } from "./dashboard-kpi-card";

export function KpiCards({ items }: { items: KpiCard[] }) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))] sm:gap-4">
      {items.map((item) => (
        <DashboardKpiCard key={item.label} item={item} />
      ))}
    </section>
  );
}
