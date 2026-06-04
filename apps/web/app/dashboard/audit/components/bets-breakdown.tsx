"use client";

import { useTranslations } from "next-intl";
import { StatList, TableCard } from "@evcore/ui";
import type { StatListItem } from "@evcore/ui";
import type { AuditOverview } from "@/domains/audit/types/audit";

export function BetsBreakdown({
  betsByStatus,
  betsByMarket,
  settledBets,
  adjustmentProposals,
  activeSuspensions,
}: Pick<
  AuditOverview,
  | "betsByStatus"
  | "betsByMarket"
  | "settledBets"
  | "adjustmentProposals"
  | "activeSuspensions"
>) {
  const t = useTranslations("audit");

  const learningItems: StatListItem[] = [
    {
      label: t("settledBets"),
      value: settledBets < 50 ? `${settledBets} / 50` : String(settledBets),
      tone: settledBets >= 50 ? "positive" : "warning",
    },
    {
      label: t("proposals"),
      value: String(adjustmentProposals),
    },
    {
      label: t("activeSuspensions"),
      value: String(activeSuspensions),
      tone: activeSuspensions > 0 ? "negative" : "neutral",
    },
  ];

  return (
    <div className="bento-grid">
      <div className="col-span-2 sm:col-span-3 lg:col-span-4">
        <TableCard title={t("betsByStatus")} className="h-full">
        <div className="p-4">
          <StatList
            items={betsByStatus.map((r) => ({
              label: r.status,
              value: r.count.toLocaleString(),
              mono: true,
            }))}
          />
        </div>
        </TableCard>
      </div>

      <div className="col-span-2 sm:col-span-3 lg:col-span-4">
        <TableCard title={t("betsByMarket")} className="h-full">
        <div className="p-4">
          <StatList
            items={betsByMarket.map((r) => ({
              label: r.market,
              value: r.count.toLocaleString(),
              mono: true,
            }))}
          />
        </div>
        </TableCard>
      </div>

      <div className="col-span-2 sm:col-span-6 lg:col-span-4">
        <TableCard title={t("learningLoop")} className="h-full">
        <div className="p-4">
          <StatList items={learningItems} />
        </div>
        </TableCard>
      </div>
    </div>
  );
}
