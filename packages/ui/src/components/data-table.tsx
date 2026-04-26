"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ExpandedState,
} from "@tanstack/react-table"
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react"

import { cn } from "@evcore/ui/lib/utils"
import { Skeleton } from "@evcore/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@evcore/ui/components/table"

// ── Types ──────────────────────────────────────────────────────────────────

export type { ColumnDef }

type DataTableProps<TData> = {
  columns: ColumnDef<TData>[]
  data: TData[]
  isLoading?: boolean
  loadingRows?: number
  emptyState?: React.ReactNode
  getRowCanExpand?: (row: TData) => boolean
  renderSubRow?: (row: TData) => React.ReactNode
  onRowClick?: (row: TData) => void
  mobileCard?: (row: TData, index: number) => React.ReactNode
  initialSorting?: SortingState
  columnVisibility?: VisibilityState
  className?: string
}

// ── DataTable ──────────────────────────────────────────────────────────────

function DataTable<TData>({
  columns,
  data,
  isLoading,
  loadingRows = 5,
  emptyState,
  getRowCanExpand,
  renderSubRow,
  onRowClick,
  mobileCard,
  initialSorting = [],
  columnVisibility,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [expanded, setExpanded] = React.useState<ExpandedState>({})

  const table = useReactTable({
    data,
    columns,
    state: { sorting, expanded, columnVisibility },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: getRowCanExpand ? (row) => getRowCanExpand(row.original) : undefined,
  })

  const colCount = table.getVisibleFlatColumns().length

  const tableEl = (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id} className="bg-panel hover:bg-panel">
            {hg.headers.map((header) => {
              const canSort = header.column.getCanSort()
              const sorted = header.column.getIsSorted()
              return (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  className={cn(
                    "text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
                    canSort && "cursor-pointer select-none hover:text-foreground"
                  )}
                  onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                >
                  {header.isPlaceholder ? null : (
                    <span className="inline-flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        sorted === "asc" ? (
                          <ChevronUpIcon className="size-3" />
                        ) : sorted === "desc" ? (
                          <ChevronDownIcon className="size-3" />
                        ) : (
                          <ChevronsUpDownIcon className="size-3 opacity-40" />
                        )
                      )}
                    </span>
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: loadingRows }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: colCount }).map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={colCount} className="py-10 text-center text-muted-foreground">
              {emptyState ?? "Aucune donnée."}
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <React.Fragment key={row.id}>
              <TableRow
                className={cn(
                  row.getIsExpanded() && "bg-secondary/50",
                  (row.getCanExpand() || onRowClick) && "cursor-pointer"
                )}
                onClick={
                  onRowClick
                    ? () => onRowClick(row.original)
                    : row.getCanExpand()
                      ? row.getToggleExpandedHandler()
                      : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
              {row.getIsExpanded() && renderSubRow && (
                <TableRow className="bg-secondary/20 hover:bg-secondary/20">
                  <TableCell colSpan={colCount}>
                    {renderSubRow(row.original)}
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))
        )}
      </TableBody>
    </Table>
  )

  if (mobileCard) {
    return (
      <>
        <div className="flex flex-col gap-2 sm:hidden">
          {isLoading
            ? Array.from({ length: loadingRows }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))
            : data.length === 0
              ? <div className="py-4 text-center text-sm text-muted-foreground">{emptyState ?? "Aucune donnée."}</div>
              : data.map((row, i) => <React.Fragment key={i}>{mobileCard(row, i)}</React.Fragment>)}
        </div>
        <div className={cn("hidden sm:block overflow-hidden rounded-[1.3rem] border border-border", className)}>
          {tableEl}
        </div>
      </>
    )
  }

  return (
    <div className={cn("overflow-hidden rounded-[1.3rem] border border-border", className)}>
      {tableEl}
    </div>
  )
}

export { DataTable }
