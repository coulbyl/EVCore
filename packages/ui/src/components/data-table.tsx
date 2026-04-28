"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnPinningState,
  type ExpandedState,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
} from "lucide-react";

import { cn } from "@evcore/ui/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@evcore/ui/components/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@evcore/ui/components/select";
import { Skeleton } from "@evcore/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@evcore/ui/components/table";

// ── Types ──────────────────────────────────────────────────────────────────

export type { ColumnDef };

type DataTableColumnMeta = {
  align?: "left" | "center" | "right";
  pin?: "left" | "right";
};

type DataTableProps<TData> = {
  columns: ColumnDef<TData>[];
  data: TData[];
  isLoading?: boolean;
  loadingRows?: number;
  emptyState?: React.ReactNode;
  getRowCanExpand?: (row: TData) => boolean;
  renderSubRow?: (row: TData) => React.ReactNode;
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string | undefined;
  mobileCard?: (row: TData, index: number) => React.ReactNode;
  initialSorting?: SortingState;
  columnVisibility?: VisibilityState;
  className?: string;
  pagination?: {
    pageSize?: number;
    pageSizeOptions?: number[];
  };
};

// ── DataTable ──────────────────────────────────────────────────────────────

function getPinnedCellProps<TData>(
  column: Column<TData, unknown>,
  surface: "header" | "body",
) {
  const pinned = column.getIsPinned();

  if (!pinned) {
    return { className: "", style: undefined };
  }

  return {
    className: cn(
      "sticky z-20",
      surface === "header"
        ? "bg-panel supports-backdrop-filter:bg-panel/95"
        : "bg-panel-strong group-hover:bg-muted/35",
    ),
    style: {
      left: pinned === "left" ? `${column.getStart("left")}px` : undefined,
      right: pinned === "right" ? `${column.getAfter("right")}px` : undefined,
    } as React.CSSProperties,
  };
}

function getPaginationItems(pageIndex: number, pageCount: number) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }

  const items: Array<number | "ellipsis"> = [0];
  const start = Math.max(1, pageIndex - 1);
  const end = Math.min(pageCount - 2, pageIndex + 1);

  if (start > 1) {
    items.push("ellipsis");
  }

  for (let index = start; index <= end; index += 1) {
    items.push(index);
  }

  if (end < pageCount - 2) {
    items.push("ellipsis");
  }

  items.push(pageCount - 1);

  return items;
}

function DataTable<TData>({
  columns,
  data,
  isLoading,
  loadingRows = 5,
  emptyState,
  getRowCanExpand,
  renderSubRow,
  onRowClick,
  rowClassName,
  mobileCard,
  initialSorting = [],
  columnVisibility,
  className,
  pagination,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  const [paginationState, setPaginationState] = React.useState<PaginationState>(
    {
      pageIndex: 0,
      pageSize: pagination?.pageSize ?? 25,
    },
  );

  const initialColumnPinning = React.useMemo<ColumnPinningState>(() => {
    const left: string[] = [];
    const right: string[] = [];

    columns.forEach((column) => {
      const meta = column.meta as DataTableColumnMeta | undefined;

      if (!("id" in column) || !column.id || !meta?.pin) {
        return;
      }

      if (meta.pin === "left") {
        left.push(column.id);
        return;
      }

      right.push(column.id);
    });

    return { left, right };
  }, [columns]);
  const [columnPinning, setColumnPinning] =
    React.useState<ColumnPinningState>(initialColumnPinning);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      expanded,
      columnVisibility,
      columnPinning,
      pagination: paginationState,
    },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onColumnPinningChange: setColumnPinning,
    onPaginationChange: setPaginationState,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowCanExpand: getRowCanExpand
      ? (row) => getRowCanExpand(row.original)
      : undefined,
    manualPagination: !pagination,
    autoResetPageIndex: false,
  });

  const colCount = table.getVisibleFlatColumns().length;
  const pageCount = table.getPageCount();
  const pageRows = pagination
    ? table.getRowModel().rows
    : table.getPrePaginationRowModel().rows;
  const pageStart =
    pageRows.length === 0
      ? 0
      : paginationState.pageIndex * paginationState.pageSize + 1;
  const pageEnd = pageRows.length === 0 ? 0 : pageStart + pageRows.length - 1;
  const paginationItems = getPaginationItems(
    paginationState.pageIndex,
    pageCount,
  );
  const pageSizeOptions = pagination?.pageSizeOptions ?? [10, 25, 50, 100];

  const tableEl = (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id} className="bg-panel hover:bg-panel">
            {hg.headers.map((header) => {
              const canSort = header.column.getCanSort();
              const sorted = header.column.getIsSorted();
              const meta = header.column.columnDef.meta as
                | DataTableColumnMeta
                | undefined;
              const pinnedCell = getPinnedCellProps(header.column, "header");
              return (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  className={cn(
                    "text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
                    meta?.align === "center" && "text-center",
                    meta?.align === "right" && "text-right",
                    canSort &&
                      "cursor-pointer select-none hover:text-foreground",
                    pinnedCell.className,
                  )}
                  style={pinnedCell.style}
                  onClick={
                    canSort
                      ? header.column.getToggleSortingHandler()
                      : undefined
                  }
                >
                  {header.isPlaceholder ? null : (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        meta?.align === "center" && "justify-center",
                        meta?.align === "right" && "justify-end",
                      )}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {canSort &&
                        (sorted === "asc" ? (
                          <ChevronUpIcon className="size-3" />
                        ) : sorted === "desc" ? (
                          <ChevronDownIcon className="size-3" />
                        ) : (
                          <ChevronsUpDownIcon className="size-3 opacity-40" />
                        ))}
                    </span>
                  )}
                </TableHead>
              );
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
            <TableCell
              colSpan={colCount}
              className="py-10 text-center text-muted-foreground"
            >
              {emptyState ?? "Aucune donnée."}
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <React.Fragment key={row.id}>
              <TableRow
                className={cn(
                  row.getIsExpanded() && "bg-secondary/50",
                  (row.getCanExpand() || onRowClick) && "cursor-pointer",
                  rowClassName?.(row.original),
                )}
                onClick={
                  onRowClick
                    ? () => onRowClick(row.original)
                    : row.getCanExpand()
                      ? row.getToggleExpandedHandler()
                      : undefined
                }
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as
                    | DataTableColumnMeta
                    | undefined;
                  const pinnedCell = getPinnedCellProps(cell.column, "body");

                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        meta?.align === "center" && "text-center",
                        meta?.align === "right" && "text-right",
                        pinnedCell.className,
                      )}
                      style={pinnedCell.style}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  );
                })}
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
  );

  const paginationEl = pagination ? (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:text-sm">
          <span>
            {pageStart}-{pageEnd} sur {data.length}
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground sm:text-sm">
              Lignes
            </span>
            <Select
              value={`${paginationState.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="h-9 w-[84px] rounded-lg bg-panel-strong">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Pagination className="mx-0 w-auto justify-start sm:justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  text="Précédent"
                  className={cn(
                    !table.getCanPreviousPage() &&
                      "pointer-events-none opacity-50",
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    table.previousPage();
                  }}
                />
              </PaginationItem>

              {paginationItems.map((item, index) =>
                item === "ellipsis" ? (
                  <PaginationItem
                    key={`ellipsis-${index}`}
                    className="hidden sm:list-item"
                  >
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item} className="hidden sm:list-item">
                    <PaginationLink
                      href="#"
                      isActive={paginationState.pageIndex === item}
                      onClick={(event) => {
                        event.preventDefault();
                        table.setPageIndex(item);
                      }}
                    >
                      {item + 1}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  text="Suivant"
                  className={cn(
                    !table.getCanNextPage() && "pointer-events-none opacity-50",
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    table.nextPage();
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  ) : null;

  if (mobileCard) {
    return (
      <>
        <div className="flex flex-col gap-2 sm:hidden">
          {isLoading ? (
            Array.from({ length: loadingRows }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))
          ) : pageRows.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {emptyState ?? "Aucune donnée."}
            </div>
          ) : (
            pageRows.map((row, i) => (
              <React.Fragment key={row.id}>
                {mobileCard(row.original, i)}
              </React.Fragment>
            ))
          )}
        </div>
        <div
          className={cn(
            "hidden overflow-hidden rounded-[1.3rem] border border-border sm:block",
            className,
          )}
        >
          {tableEl}
          {paginationEl}
        </div>
        {paginationEl ? <div className="sm:hidden">{paginationEl}</div> : null}
      </>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.3rem] border border-border",
        className,
      )}
    >
      {tableEl}
      {paginationEl}
    </div>
  );
}

export { DataTable };
