"use client";

import { useMemo } from "react";
import { Badge, DataTable, type ColumnDef } from "@evcore/ui";
import type { StatsBackfillSeason } from "@/domains/etl/types/etl";
import { formatCount, waveLabel } from "./stats-backfill-constants";

export function StatsBackfillSeasonsTable({
  seasons,
}: {
  seasons: StatsBackfillSeason[];
}) {
  const columns: ColumnDef<StatsBackfillSeason>[] = useMemo(
    () => [
      {
        id: "season",
        header: "Saison",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            <span className="font-mono">{row.original.competitionCode}</span>
            <span className="ml-1.5 font-normal text-muted-foreground">
              {row.original.seasonName}
            </span>
          </span>
        ),
      },
      {
        id: "wave",
        header: "Vague",
        cell: ({ row }) => (
          <Badge variant="neutral" className="text-[0.6rem]">
            {waveLabel(row.original.wave)}
          </Badge>
        ),
      },
      {
        id: "pending",
        header: "En attente",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-foreground">
            {formatCount(row.original.pending)}
          </span>
        ),
      },
      {
        id: "synced",
        header: "Synchronisés",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums text-success">
            {formatCount(row.original.synced)}
          </span>
        ),
      },
      {
        id: "unavailable",
        header: "Indisponibles",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatCount(row.original.unavailable)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={seasons}
      emptyState={
        <p className="py-6 text-center text-xs text-muted-foreground">
          Plus aucune saison à traiter.
        </p>
      }
      mobileCard={(season) => (
        <div className="rounded-2xl border border-border bg-panel p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              <span className="font-mono">{season.competitionCode}</span>
              <span className="ml-1.5 font-normal text-muted-foreground">
                {season.seasonName}
              </span>
            </p>
            <Badge variant="neutral" className="text-[0.6rem]">
              {waveLabel(season.wave)}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-2.5 text-sm tabular-nums">
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                En attente
              </p>
              <p className="mt-0.5 font-semibold text-foreground">
                {formatCount(season.pending)}
              </p>
            </div>
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                Synchro
              </p>
              <p className="mt-0.5 text-success">
                {formatCount(season.synced)}
              </p>
            </div>
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                Indispo
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {formatCount(season.unavailable)}
              </p>
            </div>
          </div>
        </div>
      )}
    />
  );
}
