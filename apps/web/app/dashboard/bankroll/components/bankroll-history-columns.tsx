import type { ColumnDef } from "@tanstack/react-table";
import { formatDateShort } from "@/lib/date";
import {
  type EnrichedTransaction,
  type Translator,
  parseAmount,
  transactionTypeLabel,
} from "./bankroll-constants";

type AmountFormatter = (v: string | number, compact?: boolean) => string;

/**
 * Montants en couleur neutre, signés : un retour ou un dépôt en vert se
 * lisait comme un gain (revue UX du 2026-10-27, P1-4).
 */
export function buildHistoryColumns(
  t: Translator,
  formatAmount: AmountFormatter,
  formatSigned: AmountFormatter,
): ColumnDef<EnrichedTransaction>[] {
  return [
    {
      id: "date",
      header: t("table.date"),
      accessorFn: (row) => row.createdAt,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDateShort(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "type",
      header: t("table.type"),
      accessorFn: (row) => transactionTypeLabel(row.type, t),
    },
    {
      id: "detail",
      header: t("table.detail"),
      accessorFn: (row) => row.detailLabel,
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue<string>()}</span>
      ),
    },
    {
      id: "amount",
      header: t("table.amount"),
      accessorFn: (row) => parseAmount(row.amount),
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums text-foreground">
          {formatSigned(parseAmount(row.original.amount))}
        </span>
      ),
      meta: { align: "right" },
    },
    {
      id: "balance",
      header: t("table.balanceAfter"),
      accessorFn: (row) => row.balanceAfter,
      cell: ({ getValue }) => (
        <span className="font-semibold tabular-nums">
          {formatAmount(getValue<number>())}
        </span>
      ),
      meta: { align: "right" },
    },
  ];
}
