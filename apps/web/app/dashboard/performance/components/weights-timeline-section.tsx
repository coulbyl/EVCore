"use client";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  TableCard,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import { EvLineChart, type LineDef } from "@/components/charts";
import { CHART_COLORS } from "@/components/charts/chart-theme";
import { useAdjustmentProposals } from "@/domains/adjustment/use-cases/get-adjustment-proposals";
import { formatDateShort } from "@/lib/date";

export function WeightsTimelineSection() {
  const t = useTranslations("performancePage");
  const common = useTranslations("common");
  const { data, error } = useAdjustmentProposals();
  const applied = (data ?? []).filter(
    (proposal) => proposal.status === "APPLIED",
  );

  const lines: LineDef[] = [
    {
      key: "recentForm",
      color: CHART_COLORS.teal,
      label: t("factors.recentForm"),
    },
    {
      key: "xg",
      color: CHART_COLORS.amber,
      label: t("factors.xg"),
    },
    {
      key: "domExtPerf",
      color: CHART_COLORS.indigo,
      label: t("factors.domExtPerf"),
    },
    {
      key: "leagueVolat",
      color: CHART_COLORS.muted,
      label: t("factors.leagueVolat"),
    },
  ];

  const chartData = [...applied].reverse().map((proposal) => ({
    date: formatDateShort(proposal.createdAt),
    ...proposal.proposedWeights,
  }));

  return (
    <TableCard title={t("weights")} subtitle={t("weightsHint")}>
      <div className="p-4 sm:p-5">
        {error ? (
          <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
            <EmptyHeader>
              <EmptyTitle>{common("error")}</EmptyTitle>
              <EmptyDescription>
                {error instanceof Error ? error.message : common("error")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : chartData.length <= 1 ? (
          <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
            <EmptyHeader>
              <EmptyTitle>{t("noWeightData")}</EmptyTitle>
              <EmptyDescription>{t("weightsHint")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <EvLineChart
            data={chartData}
            xKey="date"
            height={220}
            lines={lines}
            showLegend
            formatY={(value) => Number(value).toFixed(2)}
          />
        )}
      </div>
    </TableCard>
  );
}
