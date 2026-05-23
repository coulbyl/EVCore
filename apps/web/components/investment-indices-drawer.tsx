"use client";

import { useState } from "react";
import { X, BarChart2, TrendingUp, TrendingDown, Filter } from "lucide-react";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerTitle,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@evcore/ui";
import { daysAgoIso, toISODate, isoToDate } from "@/lib/date";
import { useInvestmentIndices } from "@/domains/ai-engine/use-cases/use-investment-indices";
import type { InvestmentIndicesCanal } from "@/domains/ai-engine/types/investment-indices";

// ── Constants ─────────────────────────────────────────────────────────────────

const CANAL_OPTIONS: { value: InvestmentIndicesCanal; label: string }[] = [
  { value: "SV", label: "Safe Value" },
  { value: "EV", label: "Expected Value" },
  { value: "CONF", label: "Confiance" },
  { value: "BB", label: "BTTS" },
  { value: "NUL", label: "Nul" },
  { value: "COUPON", label: "Coupons" },
];

const CANAL_COLOR: Record<InvestmentIndicesCanal, string> = {
  EV: "var(--canal-ev)",
  SV: "var(--canal-sv)",
  CONF: "var(--canal-conf)",
  BB: "var(--canal-btts)",
  NUL: "var(--canal-draw)",
  COUPON: "var(--canal-sv)",
};

// ── DateButton ────────────────────────────────────────────────────────────────

function DateButton({
  value,
  onChange,
  placeholder,
  maxDate,
}: {
  value: string | undefined;
  onChange: (iso: string) => void;
  placeholder: string;
  maxDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const display = value
    ? new Date(`${value}T12:00:00Z`).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 flex-1 items-center justify-center rounded-lg border border-border bg-secondary px-3 text-xs font-medium transition-colors hover:bg-secondary/80",
            value ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {display}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? isoToDate(value) : undefined}
          onSelect={(d) => {
            if (!d) return;
            const iso = toISODate(d);
            if (maxDate && iso > maxDate) return;
            onChange(iso);
            setOpen(false);
          }}
          disabled={(d) => {
            const iso = toISODate(d);
            const yesterday = daysAgoIso(1);
            if (iso > yesterday) return true;
            if (maxDate && iso > maxDate) return true;
            return false;
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export function InvestmentIndicesDrawer({
  open,
  onClose,
  isMobile,
  initialCanal,
}: {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
  initialCanal?: InvestmentIndicesCanal;
}) {
  const yesterday = daysAgoIso(1);

  const [canal, setCanal] = useState<InvestmentIndicesCanal>(
    initialCanal ?? "SV",
  );
  const [from, setFrom] = useState<string>(daysAgoIso(89));
  const [to, setTo] = useState<string>(yesterday);

  // Applied filters (only updated on "Filtrer" click)
  const [applied, setApplied] = useState<{
    canal: InvestmentIndicesCanal;
    from: string;
    to: string;
  } | null>(null);

  const { data, isLoading, isFetching, isError } = useInvestmentIndices({
    canal: applied?.canal ?? canal,
    from: applied?.from,
    to: applied?.to,
    enabled: applied !== null && open,
  });

  function handleFilter() {
    setApplied({ canal, from, to });
  }

  function handleClose() {
    onClose();
  }

  const rows = data?.rows ?? [];
  const hasRows = rows.length > 0;
  const goodCount = rows.filter((r) => r.isGood).length;
  const color = CANAL_COLOR[applied?.canal ?? canal];

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && handleClose()}
      direction={isMobile ? "bottom" : "right"}
    >
      <DrawerContent
        className={
          isMobile
            ? "z-50 flex max-h-[92vh] flex-col rounded-t-[1.5rem] border-t border-border bg-panel outline-none"
            : "z-50 inset-y-4 right-4 flex h-[calc(100dvh-2rem)] w-[440px] flex-col rounded-[1.5rem] border border-border bg-panel shadow-[0_24px_80px_rgba(15,23,42,0.18)] outline-none"
        }
      >
        <DrawerTitle className="sr-only">Indice de paris</DrawerTitle>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={15} className="text-muted-foreground" />
            <span className="text-sm font-semibold">Indice de paris</span>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          {/* Filters */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/30 p-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
              Filtres
            </p>

            {/* Canal select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Canal</label>
              <Select
                value={canal}
                onValueChange={(v) => setCanal(v as InvestmentIndicesCanal)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">
                Période d&apos;analyse
              </label>
              <div className="flex items-center gap-2">
                <DateButton
                  value={from}
                  onChange={setFrom}
                  placeholder="Début"
                  maxDate={to}
                />
                <span className="text-xs text-muted-foreground">→</span>
                <DateButton
                  value={to}
                  onChange={setTo}
                  placeholder="Fin"
                  maxDate={yesterday}
                />
              </div>
            </div>

            <Button
              onClick={handleFilter}
              className="w-full gap-2"
              disabled={isLoading || isFetching}
            >
              <Filter size={13} />
              {isLoading || isFetching ? "Chargement…" : "Filtrer"}
            </Button>
          </div>

          {/* Empty state before first filter */}
          {applied === null && (
            <p className="text-sm text-muted-foreground">
              Sélectionne un canal et une période, puis clique sur Filtrer pour
              afficher les indices.
            </p>
          )}

          {/* Summary banner */}
          {applied !== null && data && (
            <div
              className="flex items-center justify-between rounded-xl border px-4 py-3"
              style={{
                borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                background: `color-mix(in srgb, ${color} 6%, transparent)`,
              }}
            >
              <div className="text-center">
                <p className="text-[0.62rem] uppercase tracking-widest text-muted-foreground">
                  Total
                </p>
                <p className="text-lg font-bold tabular-nums">
                  {data.summary.total}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[0.62rem] uppercase tracking-widest text-muted-foreground">
                  Gagnés
                </p>
                <p className="text-lg font-bold tabular-nums text-success">
                  {data.summary.won}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[0.62rem] uppercase tracking-widest text-muted-foreground">
                  Hit rate
                </p>
                <p className="text-lg font-bold tabular-nums">
                  {(data.summary.hitRate * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-[0.62rem] uppercase tracking-widest text-muted-foreground">
                  Fiables
                </p>
                <p className="text-lg font-bold tabular-nums text-success">
                  {goodCount}/{rows.length}
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {applied !== null && isError && (
            <p className="text-sm text-destructive">
              Impossible de charger les indices.
            </p>
          )}

          {/* Loading skeleton */}
          {(isLoading || isFetching) && (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 animate-pulse rounded-xl bg-secondary"
                />
              ))}
            </div>
          )}

          {/* No data */}
          {applied !== null && !isLoading && !isFetching && !isError && !hasRows && (
            <p className="text-sm text-muted-foreground">
              Aucune donnée résolue pour cette période.
            </p>
          )}

          {/* Probability table */}
          {!isLoading && !isFetching && hasRows && (
            <div className="flex flex-col gap-1">
              {/* Header */}
              <div className="grid grid-cols-[48px_1fr_48px_48px_56px_28px] items-center gap-2 px-3 pb-1">
                <p className="text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                  Proba
                </p>
                <div />
                <p className="text-center text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                  Picks
                </p>
                <p className="text-center text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                  Gagnés
                </p>
                <p className="text-right text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                  Hit rate
                </p>
                <div />
              </div>

              {rows.map((row) => {
                const barWidth = Math.round(row.hitRate * 100);
                return (
                  <div
                    key={row.probability}
                    className={cn(
                      "relative overflow-hidden rounded-xl border px-3 py-2",
                      row.isGood
                        ? "border-success/20 bg-success/5"
                        : "border-border bg-secondary/30",
                    )}
                  >
                    {/* Progress bar background */}
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 opacity-10",
                        row.isGood ? "bg-success" : "bg-muted-foreground",
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                    <div className="relative grid grid-cols-[48px_1fr_48px_48px_56px_28px] items-center gap-2">
                      <span className="text-xs font-bold tabular-nums">
                        {row.probability.toFixed(1)}%
                      </span>
                      {/* Mini bar */}
                      <div className="h-1 overflow-hidden rounded-full bg-border">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            row.isGood ? "bg-success" : "bg-muted-foreground/50",
                          )}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="text-center text-xs tabular-nums text-muted-foreground">
                        {row.total}
                      </span>
                      <span className="text-center text-xs tabular-nums text-muted-foreground">
                        {row.won}
                      </span>
                      <span
                        className={cn(
                          "text-right text-xs font-bold tabular-nums",
                          row.isGood ? "text-success" : "text-foreground",
                        )}
                      >
                        {(row.hitRate * 100).toFixed(1)}%
                      </span>
                      <span className="flex justify-center">
                        {row.isGood ? (
                          <TrendingUp size={12} className="text-success" />
                        ) : (
                          <TrendingDown
                            size={12}
                            className="text-muted-foreground"
                          />
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          {hasRows && !isLoading && !isFetching && (
            <p className="text-[0.68rem] leading-snug text-muted-foreground">
              Un indice est fiable quand le hit rate réel ≥ la probabilité
              annoncée par le modèle. Cela indique que le modèle est calibré ou
              meilleur qu&apos;attendu à ce niveau de confiance.
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
