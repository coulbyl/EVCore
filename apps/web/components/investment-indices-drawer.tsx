"use client";

import { useState } from "react";
import { X, BarChart2, TrendingUp, TrendingDown } from "lucide-react";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerTitle,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@evcore/ui";
import { todayIso, daysAgoIso, toISODate, isoToDate } from "@/lib/date";
import { useInvestmentIndices } from "@/domains/ai-engine/use-cases/use-investment-indices";
import type { InvestmentIndicesCanal } from "@/domains/ai-engine/types/investment-indices";
import type { InvestmentPickDto } from "@/domains/ai-engine/types/investment";

type Canal = InvestmentIndicesCanal;

const CANAL_LABEL: Record<Canal, string> = {
  SV: "Safe Value",
  EV: "Expected Value",
  CONF: "Confiance",
  BB: "BTTS",
  NUL: "Nul",
  COUPON: "Coupons",
};

function DateButton({
  value,
  onChange,
  label,
  maxDate,
}: {
  value: string | undefined;
  onChange: (iso: string) => void;
  label: string;
  maxDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const display = value
    ? new Date(`${value}T12:00:00Z`).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-xs font-medium text-foreground hover:bg-secondary/80"
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

export function InvestmentIndicesDrawer({
  canal,
  open,
  onClose,
  isMobile,
  picks,
}: {
  canal: Canal;
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
  picks?: InvestmentPickDto[];
}) {
  const yesterday = daysAgoIso(1);
  const [from, setFrom] = useState<string>(daysAgoIso(89));
  const [to, setTo] = useState<string>(yesterday);

  const { data, isLoading, isError } = useInvestmentIndices({
    canal,
    from,
    to,
    enabled: open,
  });

  function handleClose() {
    onClose();
  }

  const buckets = data?.buckets ?? [];
  const hasBuckets = buckets.length > 0;
  const goodCount = buckets.filter((b) => b.isGood).length;

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && handleClose()}
      direction={isMobile ? "bottom" : "right"}
    >
      <DrawerContent
        className={
          isMobile
            ? "z-50 flex max-h-[90vh] flex-col rounded-t-[1.5rem] border-t border-border bg-panel outline-none"
            : "z-50 inset-y-4 right-4 flex h-[calc(100dvh-2rem)] w-[420px] flex-col rounded-[1.5rem] border border-border bg-panel shadow-[0_24px_80px_rgba(15,23,42,0.18)] outline-none"
        }
      >
        <DrawerTitle className="sr-only">
          Indice de paris — {CANAL_LABEL[canal]}
        </DrawerTitle>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={15} className="text-muted-foreground" />
            <span className="text-sm font-semibold">Indice de paris</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
              {CANAL_LABEL[canal]}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          {/* Date range */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Période d'analyse
            </p>
            <div className="flex items-center gap-2">
              <DateButton
                value={from}
                onChange={(v) => setFrom(v)}
                label="Début"
                maxDate={to}
              />
              <span className="text-xs text-muted-foreground">→</span>
              <DateButton
                value={to}
                onChange={(v) => setTo(v)}
                label="Fin"
                maxDate={yesterday}
              />
            </div>
          </div>

          {/* Summary banner */}
          {data && (
            <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
              <div className="text-center">
                <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  Total
                </p>
                <p className="text-base font-bold tabular-nums">
                  {data.summary.total}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  Gagnés
                </p>
                <p className="text-base font-bold tabular-nums text-success">
                  {data.summary.won}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  Hit rate
                </p>
                <p className="text-base font-bold tabular-nums">
                  {(data.summary.hitRate * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  Bons indices
                </p>
                <p className="text-base font-bold tabular-nums text-success">
                  {goodCount}/{buckets.length}
                </p>
              </div>
            </div>
          )}

          {/* Indices table */}
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-xl bg-secondary"
                />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">
              Impossible de charger les indices.
            </p>
          ) : !hasBuckets ? (
            <p className="text-sm text-muted-foreground">
              Aucune donnée résolue pour cette période.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_48px_48px_56px_28px] items-center gap-2 px-3 pb-1">
                <p className="text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                  Fourchette
                </p>
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

              {buckets.map((bucket) => {
                const hitPct = (bucket.hitRate * 100).toFixed(1);
                const barWidth = Math.round(bucket.hitRate * 100);
                return (
                  <div
                    key={bucket.label}
                    className={cn(
                      "relative overflow-hidden rounded-xl border px-3 py-2.5",
                      bucket.isGood
                        ? "border-success/20 bg-success/6"
                        : "border-border bg-secondary/30",
                    )}
                  >
                    {/* progress bar */}
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 opacity-10",
                        bucket.isGood ? "bg-success" : "bg-muted-foreground",
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                    <div className="relative grid grid-cols-[1fr_48px_48px_56px_28px] items-center gap-2">
                      <span className="text-xs font-semibold">
                        {bucket.label}
                      </span>
                      <span className="text-center text-xs tabular-nums text-muted-foreground">
                        {bucket.total}
                      </span>
                      <span className="text-center text-xs tabular-nums text-muted-foreground">
                        {bucket.won}
                      </span>
                      <span
                        className={cn(
                          "text-right text-xs font-bold tabular-nums",
                          bucket.isGood ? "text-success" : "text-foreground",
                        )}
                      >
                        {hitPct}%
                      </span>
                      <span className="flex justify-center">
                        {bucket.isGood ? (
                          <TrendingUp size={13} className="text-success" />
                        ) : (
                          <TrendingDown
                            size={13}
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
          {hasBuckets && (
            <p className="text-[0.68rem] leading-snug text-muted-foreground">
              Un indice est "bon" quand le hit rate réel est ≥ au milieu de la
              fourchette de probabilité. Cela indique que le modèle est calibré
              ou meilleur qu'attendu sur ce niveau de confiance.
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
