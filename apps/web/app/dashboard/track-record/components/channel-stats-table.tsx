import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@evcore/ui";
import type { ChannelStatus } from "@/domains/dashboard/types/dashboard";
import { formatHitRate, formatRoi, roiToneClass } from "../track-record-constants";
import { ChannelStatusBadge } from "./channel-status-badge";

export type ChannelStatRow = {
  key: string;
  primaryLabel: string;
  secondaryLabel?: string;
  status: ChannelStatus;
  roi: number | null;
  hitRate: number | null;
  sampleSize: number;
};

/**
 * Renders the same channel-performance rows twice from one data model: a
 * table for desktop, a stacked card list for mobile — the table's own
 * overflow-x-auto scrolls under 640px but with no visible affordance, so ROI
 * and sample size were readable only after an undiscoverable swipe.
 */
export function ChannelStatsTable({
  primaryColumnLabel,
  rows,
}: {
  primaryColumnLabel: string;
  rows: ChannelStatRow[];
}) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{primaryColumnLabel}</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">ROI</TableHead>
              <TableHead className="text-right">Taux de réussite</TableHead>
              <TableHead className="text-right">Échantillon</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium text-foreground">
                  {row.primaryLabel}
                  {row.secondaryLabel ? (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · {row.secondaryLabel}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <ChannelStatusBadge status={row.status} />
                </TableCell>
                <TableCell
                  className={`text-right font-medium tabular-nums ${roiToneClass(row.status)}`}
                >
                  {formatRoi(row.roi)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatHitRate(row.hitRate)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  n={row.sampleSize}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-2 sm:hidden">
        {rows.map((row) => (
          <li
            key={row.key}
            className="rounded-2xl border border-border bg-panel p-3"
          >
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
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-2.5">
              <div>
                <p className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                  ROI
                </p>
                <p
                  className={`mt-0.5 text-sm font-semibold tabular-nums ${roiToneClass(row.status)}`}
                >
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
          </li>
        ))}
      </ul>
    </>
  );
}
