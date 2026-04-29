"use client";

import {
  Badge,
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
import {
  proposalKind,
  type AdjustmentProposal,
} from "@/domains/adjustment/types/adjustment";
import { formatDateShort } from "@/lib/date";

function ProposalKindBadge({ proposal }: { proposal: AdjustmentProposal }) {
  const kind = proposalKind(proposal.notes);
  if (kind === "rollback") {
    return (
      <Badge
        variant="outline"
        className="border-danger/40 text-danger text-[0.62rem]"
      >
        rollback
      </Badge>
    );
  }
  if (kind === "shadow") {
    return (
      <Badge
        variant="outline"
        className="border-indigo-400/40 text-indigo-400 text-[0.62rem]"
      >
        shadow
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-accent/40 text-accent text-[0.62rem]"
    >
      auto
    </Badge>
  );
}

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

  const recentEvents = applied.slice(0, 5);

  return (
    <TableCard title={t("weights")} subtitle={t("weightsHint")}>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
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

        {recentEvents.length > 0 && (
          <div className="rounded-[1.2rem] border border-border bg-panel px-4 py-3">
            <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("proposalHistory")}
            </p>
            <ul className="flex flex-col gap-2">
              {recentEvents.map((proposal) => (
                <li
                  key={proposal.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ProposalKindBadge proposal={proposal} />
                    <span className="text-muted-foreground truncate">
                      {formatDateShort(proposal.createdAt)}
                    </span>
                  </div>
                  <span className="tabular-nums text-xs text-muted-foreground shrink-0">
                    Brier {proposal.calibrationError.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </TableCard>
  );
}
