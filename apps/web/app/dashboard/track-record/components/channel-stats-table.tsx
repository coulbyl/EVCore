"use client";

import { useMemo } from "react";
import { DataTable, type ColumnDef } from "@evcore/ui";
import type { ChannelStatus } from "@/domains/dashboard/types/dashboard";
import {
  formatCalibrationRatio,
  formatHitRate,
  formatRoi,
  statusToneClass,
} from "../track-record-constants";
import { ChannelStatusBadge } from "@/components/channel-status-badge";

export type ChannelStatRow = {
  key: string;
  primaryLabel: string;
  secondaryLabel?: string;
  status: ChannelStatus;
  roi: number | null;
  hitRate: number | null;
  calibrationRatio: number | null;
  sampleSize: number;
};

/** One shared TanStack column model drives both the desktop table and the
 * mobile card list via DataTable's `mobileCard` prop — see CLAUDE.md
 * (TanStack Table): "Do not hardcode mobile/desktop table variants
 * separately when one shared table model can drive both." A prior version
 * of this component hand-rolled its own `hidden sm:block` table /
 * `sm:hidden` card split instead of reusing DataTable, duplicating a pattern
 * already used by 7+ other pages. */
export function ChannelStatsTable({
  primaryColumnLabel,
  rows,
}: {
  primaryColumnLabel: string;
  rows: ChannelStatRow[];
}) {
  const columns: ColumnDef<ChannelStatRow>[] = useMemo(
    () => [
      {
        id: "primary",
        header: primaryColumnLabel,
        accessorFn: (row) => row.primaryLabel,
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.primaryLabel}
            {row.original.secondaryLabel ? (
              <span className="ml-1.5 font-normal text-muted-foreground">
                · {row.original.secondaryLabel}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "status",
        header: "Statut",
        cell: ({ row }) => <ChannelStatusBadge status={row.original.status} />,
      },
      {
        id: "calibration",
        header: "Calibration",
        accessorFn: (row) => row.calibrationRatio ?? Number.NEGATIVE_INFINITY,
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span
            className={`font-medium tabular-nums ${statusToneClass(row.original.status)}`}
          >
            {formatCalibrationRatio(row.original.calibrationRatio)}
          </span>
        ),
      },
      {
        id: "roi",
        header: "ROI",
        accessorFn: (row) => row.roi ?? Number.NEGATIVE_INFINITY,
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums text-muted-foreground">
            {formatRoi(row.original.roi)}
          </span>
        ),
      },
      {
        id: "hitRate",
        header: "Taux de réussite",
        accessorFn: (row) => row.hitRate ?? Number.NEGATIVE_INFINITY,
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatHitRate(row.original.hitRate)}
          </span>
        ),
      },
      {
        id: "sampleSize",
        header: "Échantillon",
        accessorFn: (row) => row.sampleSize,
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            n={row.original.sampleSize}
          </span>
        ),
      },
    ],
    [primaryColumnLabel],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      mobileCard={(row) => (
        <div className="rounded-2xl border border-border bg-panel p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              {row.primaryLabel}
              {row.secondaryLabel ? (
                <span className="block font-normal text-muted-foreground">
                  {row.secondaryLabel}
                </span>
              ) : null}
            </p>
            <ChannelStatusBadge status={row.status} />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border/60 pt-2.5">
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                Calibration
              </p>
              <p
                className={`mt-0.5 text-sm font-semibold tabular-nums ${statusToneClass(row.status)}`}
              >
                {formatCalibrationRatio(row.calibrationRatio)}
              </p>
            </div>
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                ROI
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-muted-foreground">
                {formatRoi(row.roi)}
              </p>
            </div>
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                Réussite
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                {formatHitRate(row.hitRate)}
              </p>
            </div>
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                Échantillon
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-muted-foreground">
                n={row.sampleSize}
              </p>
            </div>
          </div>
        </div>
      )}
    />
  );
}
