import { DataTable, EvBadge, ProgressBar } from "@evcore/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { formatCompactValue } from "@/helpers/number";
import type { AuditLeagueRow } from "@/domains/audit/types/audit";

const COLUMNS: ColumnDef<AuditLeagueRow>[] = [
  {
    id: "league",
    header: "Ligue",
    cell: ({ row }) => (
      <span>
        <span className="font-mono text-[0.7rem] text-muted-foreground">{row.original.code}</span>
        <span className="ml-2 text-sm text-muted-foreground">{row.original.name}</span>
      </span>
    ),
  },
  {
    id: "active",
    header: "Active",
    cell: ({ row }) =>
      row.original.isActive ? (
        <EvBadge tone="success">Active</EvBadge>
      ) : (
        <EvBadge tone="neutral">Inactive</EvBadge>
      ),
  },
  {
    id: "fixtures",
    header: "Fixtures",
    accessorFn: (row) => formatCompactValue(row.fixtures),
  },
  {
    id: "finished",
    header: "Terminées",
    accessorFn: (row) => formatCompactValue(row.finished),
  },
  {
    id: "xg",
    header: "Couv. xG",
    cell: ({ row }) => (
      <ProgressBar
        value={row.original.xgCoveragePct}
        thresholds={{ success: 80, warning: 50 }}
        className="min-w-[6rem]"
      />
    ),
  },
  {
    id: "odds",
    header: "Cotes",
    accessorFn: (row) => formatCompactValue(row.withOdds),
  },
  {
    id: "stats",
    header: "Stats",
    accessorFn: (row) => formatCompactValue(row.teamStats),
  },
];

export function LeagueBreakdown({ rows }: { rows: AuditLeagueRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      data={rows}
      mobileCard={(row) => (
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[0.7rem] text-muted-foreground">{row.code}</span>
              <span className="text-sm text-foreground">{row.name}</span>
            </div>
            <EvBadge tone={row.isActive ? "success" : "neutral"}>
              {row.isActive ? "Active" : "Inactive"}
            </EvBadge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["Fixtures", formatCompactValue(row.fixtures)],
                ["Terminées", formatCompactValue(row.finished)],
                ["Cotes", formatCompactValue(row.withOdds)],
                ["Stats", formatCompactValue(row.teamStats)],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="rounded-lg border border-border bg-secondary px-3 py-2">
                <p className="text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                <p className="mt-0.5 font-semibold text-foreground">{val}</p>
              </div>
            ))}
          </div>
          <ProgressBar
            value={row.xgCoveragePct}
            thresholds={{ success: 80, warning: 50 }}
            label="xG"
          />
        </div>
      )}
    />
  );
}
