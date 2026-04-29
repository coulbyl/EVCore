"use client";

import { useState } from "react";
import {
  Badge,
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  TableCard,
  Tabs,
  TabsList,
  TabsTrigger,
  type ColumnDef,
} from "@evcore/ui";
import { cn } from "@evcore/ui";
import { useTranslations } from "next-intl";
import {
  useCompetitionStats,
  type CompetitionStatCanal,
} from "@/domains/dashboard/use-cases/get-competition-stats";
import type { CompetitionStat } from "@/domains/dashboard/types/dashboard";

function parseRoi(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Number.parseFloat(value.replace("%", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function roiToneClass(value: string | null) {
  if (!value) return "text-muted-foreground";
  if (value.startsWith("+")) return "text-success";
  if (value.startsWith("-")) return "text-danger";
  return "text-foreground";
}

function formatNullableValue(value: string | null) {
  return value ?? "—";
}

export function CompetitionStatsSection() {
  const t = useTranslations("performancePage");
  const tableT = useTranslations("table");
  const common = useTranslations("common");
  const [canal, setCanal] = useState<CompetitionStatCanal>("ALL");
  const { data, error, isLoading } = useCompetitionStats(canal);
  const rows = data ?? [];

  const rankedRows = [...rows]
    .filter((row) => row.model.roi !== null)
    .sort(
      (left, right) => parseRoi(right.model.roi) - parseRoi(left.model.roi),
    );
  const bestCompetitionId = rankedRows[0]?.competitionId ?? null;
  const worstCompetitionId =
    rankedRows.length > 0
      ? rankedRows[rankedRows.length - 1]?.competitionId
      : null;

  const columns: ColumnDef<CompetitionStat>[] = [
    {
      id: "name",
      header: t("table.competition"),
      accessorKey: "competitionName",
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-semibold text-foreground">
            {row.original.competitionName}
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[0.62rem]">
              {row.original.competitionCode}
            </Badge>
            {row.original.competitionId === bestCompetitionId ? (
              <span className="text-xs font-medium text-success">
                {t("table.best")}
              </span>
            ) : row.original.competitionId === worstCompetitionId ? (
              <span className="text-xs font-medium text-danger">
                {t("table.worst")}
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: "fixtures",
      header: t("table.analyzed"),
      accessorFn: (row) => row.activeFixtures,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.activeFixtures}</span>
      ),
    },
    {
      id: "modelRoi",
      header: t("table.modelRoi"),
      accessorFn: (row) => row.model.roi ?? "—",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span
          className={cn(
            "tabular-nums font-semibold",
            roiToneClass(row.original.model.roi),
          )}
        >
          {formatNullableValue(row.original.model.roi)}
        </span>
      ),
    },
    {
      id: "modelWr",
      header: t("table.modelWinRate"),
      accessorFn: (row) => row.model.winRate ?? "—",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatNullableValue(row.original.model.winRate)}
        </span>
      ),
    },
    {
      id: "myRoi",
      header: t("table.myRoi"),
      accessorFn: (row) => row.myPicks?.roi ?? "—",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span
          className={cn(
            "tabular-nums font-semibold",
            roiToneClass(row.original.myPicks?.roi ?? null),
          )}
        >
          {formatNullableValue(row.original.myPicks?.roi ?? null)}
        </span>
      ),
    },
  ];

  return (
    <TableCard
      title={t("competitions")}
      subtitle={t("competitionsPeriod")}
      action={
        <Tabs
          value={canal}
          onValueChange={(v) => setCanal(v as CompetitionStatCanal)}
        >
          <TabsList>
            <TabsTrigger value="ALL">{t("canalGlobal")}</TabsTrigger>
            <TabsTrigger value="EV">{t("canalEv")}</TabsTrigger>
            <TabsTrigger value="SV">{t("canalSv")}</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        initialSorting={[{ id: "fixtures", desc: true }]}
        className="border-0"
        rowClassName={(row) =>
          cn(
            row.competitionId === bestCompetitionId &&
              "bg-success/10 hover:bg-success/15",
            row.competitionId === worstCompetitionId &&
              "bg-danger/10 hover:bg-danger/15",
          )
        }
        emptyState={
          error ? (
            <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
              <EmptyHeader>
                <EmptyTitle>{common("error")}</EmptyTitle>
                <EmptyDescription>
                  {error instanceof Error ? error.message : common("error")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
              <EmptyHeader>
                <EmptyTitle>{tableT("empty")}</EmptyTitle>
                <EmptyDescription>{t("competitionsPeriod")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )
        }
        mobileCard={(row) => (
          <div
            key={row.competitionId}
            className={cn(
              "rounded-[1.2rem] border border-border bg-panel p-4",
              row.competitionId === bestCompetitionId &&
                "border-success/30 bg-success/10",
              row.competitionId === worstCompetitionId &&
                "border-danger/30 bg-danger/10",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">
                  {row.competitionName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.competitionCode} · {row.activeFixtures}{" "}
                  {t("table.matches")}
                </p>
              </div>
              <span
                className={cn(
                  "tabular-nums font-semibold",
                  roiToneClass(row.model.roi),
                )}
              >
                {formatNullableValue(row.model.roi)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("table.modelWinRate")}
                </p>
                <p className="tabular-nums">
                  {formatNullableValue(row.model.winRate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("table.myRoi")}
                </p>
                <p
                  className={cn(
                    "tabular-nums",
                    roiToneClass(row.myPicks?.roi ?? null),
                  )}
                >
                  {formatNullableValue(row.myPicks?.roi ?? null)}
                </p>
              </div>
            </div>
          </div>
        )}
      />
    </TableCard>
  );
}
