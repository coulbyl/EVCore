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
    <div className="grid gap-4 md:grid-cols-3">
      <TableCard title={t("betsByStatus")}>
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

      <TableCard title={t("betsByMarket")}>
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

      <TableCard title={t("learningLoop")}>
        <div className="p-4">
          <StatList items={learningItems} />
        </div>
      </TableCard>
    </div>
  );
}
