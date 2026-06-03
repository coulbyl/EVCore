"use client";

import { useState } from "react";
import {
  X,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
  { value: "SV", label: "SV" },
  { value: "EV", label: "EV" },
  { value: "CONF", label: "VICTOIRE" },
  { value: "BB", label: "BB" },
  { value: "NUL", label: "NUL" },
  { value: "COUPON", label: "COUPON" },
];

const CANAL_COLOR: Record<InvestmentIndicesCanal, string> = {
  EV: "var(--canal-ev)",
  SV: "var(--canal-sv)",
  CONF: "var(--canal-conf)",
  BB: "var(--canal-btts)",
  NUL: "var(--canal-draw)",
  COUPON: "var(--canal-sv)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function RoiIndicator({ roi }: { roi: number | null }) {
  if (roi === null)
    return <span className="text-xs text-muted-foreground/50">—</span>;
  const pct = (roi * 100).toFixed(1);
  if (roi > 0.03)
    return (
      <span className="flex items-center gap-0.5 text-xs font-bold tabular-nums text-success">
        +{pct}% <TrendingUp size={11} />
      </span>
    );
  if (roi < -0.03)
    return (
      <span className="flex items-center gap-0.5 text-xs font-bold tabular-nums text-destructive">
        {pct}% <TrendingDown size={11} />
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-xs font-bold tabular-nums text-muted-foreground">
      {pct}% <Minus size={11} />
    </span>
  );
}

type TableRow = {
  label: string;
  total: number;
  won: number;
  hitRate: number;
  roi: number | null;
};

function IndicesTable({ rows }: { rows: TableRow[] }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[1fr_44px_44px_72px] items-center gap-2 px-3 pb-1">
        <div />
        <p className="text-center text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Paris
        </p>
        <p className="text-center text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Réussite
        </p>
        <p className="text-right text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground">
          ROI
        </p>
      </div>
      {rows.map((row) => {
        const barWidth = Math.round(row.hitRate * 100);
        return (
          <div
            key={row.label}
            className="relative overflow-hidden rounded-xl border border-border bg-secondary/30 px-3 py-2"
          >
            <div
              className="absolute inset-y-0 left-0 bg-muted-foreground opacity-[0.06]"
              style={{ width: `${barWidth}%` }}
            />
            <div className="relative grid grid-cols-[1fr_44px_44px_72px] items-center gap-2">
              <span className="truncate text-xs font-medium">{row.label}</span>
              <span className="text-center text-xs tabular-nums text-muted-foreground">
                {row.total}
              </span>
              <span className="text-center text-xs tabular-nums text-muted-foreground">
                {(row.hitRate * 100).toFixed(0)}%
              </span>
              <div className="flex justify-end">
                <RoiIndicator roi={row.roi} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
  const [applied, setApplied] = useState<{
    canal: InvestmentIndicesCanal;
    from: string;
    to: string;
  } | null>(null);
  const [calibrationOpen, setCalibrationOpen] = useState(false);

  const { data, isLoading, isFetching, isError } = useInvestmentIndices({
    canal: applied?.canal ?? canal,
    from: applied?.from,
    to: applied?.to,
    enabled: applied !== null && open,
  });

  function handleFilter() {
    setApplied({ canal, from, to });
  }

  const color = CANAL_COLOR[applied?.canal ?? canal];
  const hasData = !!data && !isLoading && !isFetching;

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && onClose()}
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
        <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <BarChart2 size={15} className="text-muted-foreground" />
              <span className="text-sm font-semibold">Indice de paris</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Concentre ta mise là où le modèle crée de la valeur — identifie
              les marchés et cotes où le ROI est positif pour arbitrer entre tes
              sélections du jour.
            </p>
          </div>
          <button
            onClick={onClose}
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
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Canal</label>
              <Select
                value={canal}
                onValueChange={(v) => setCanal(v as InvestmentIndicesCanal)}
              >
                <SelectTrigger className="h-9 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANAL_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-xs"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          {/* Empty state */}
          {applied === null && (
            <p className="text-sm text-muted-foreground">
              Sélectionne un canal et une période, puis clique sur Filtrer pour
              afficher les indices.
            </p>
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
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 animate-pulse rounded-xl bg-secondary"
                />
              ))}
            </div>
          )}

          {/* No data */}
          {applied !== null && hasData && data.summary.total === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucune donnée résolue pour cette période.
            </p>
          )}

          {hasData && data.summary.total > 0 && (
            <>
              {/* Summary banner */}
              <div
                className="grid grid-cols-4 gap-3 rounded-xl border px-4 py-3"
                style={{
                  borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                  background: `color-mix(in srgb, ${color} 6%, transparent)`,
                }}
              >
                {(
                  [
                    { label: "Paris", value: String(data.summary.total) },
                    { label: "Gagnés", value: String(data.summary.won) },
                    {
                      label: "Réussite",
                      value: `${(data.summary.hitRate * 100).toFixed(1)}%`,
                    },
                    {
                      label: "ROI",
                      value:
                        data.summary.roi !== null
                          ? `${data.summary.roi >= 0 ? "+" : ""}${(data.summary.roi * 100).toFixed(1)}%`
                          : "—",
                      highlight:
                        data.summary.roi !== null
                          ? data.summary.roi > 0
                            ? "success"
                            : data.summary.roi < 0
                              ? "destructive"
                              : null
                          : null,
                    },
                  ] as {
                    label: string;
                    value: string;
                    highlight?: "success" | "destructive" | null;
                  }[]
                ).map(({ label, value, highlight }) => (
                  <div key={label} className="text-center">
                    <p className="text-[0.62rem] uppercase tracking-widest text-muted-foreground">
                      {label}
                    </p>
                    <p
                      className={cn(
                        "text-lg font-bold tabular-nums",
                        highlight === "success" && "text-success",
                        highlight === "destructive" && "text-destructive",
                      )}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Par marché */}
              {data.byMarket.length > 1 && (
                <div className="flex flex-col gap-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                    Par marché
                  </p>
                  <IndicesTable rows={data.byMarket} />
                </div>
              )}

              {/* Par tranche de cote */}
              {data.byOddsRange !== null && data.byOddsRange.length > 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                    Par tranche de cote
                  </p>
                  <IndicesTable rows={data.byOddsRange} />
                </div>
              )}

              {/* Calibration — collapsed by default */}
              {data.rows.length > 0 && (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setCalibrationOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  >
                    {calibrationOpen ? (
                      <ChevronUp size={11} />
                    ) : (
                      <ChevronDown size={11} />
                    )}
                    Calibration par probabilité
                  </button>

                  {calibrationOpen && (
                    <>
                      <div className="flex flex-col gap-1">
                        <div className="grid grid-cols-[48px_1fr_48px_48px_56px_28px] items-center gap-2 px-3 pb-1">
                          <p className="text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                            Proba
                          </p>
                          <div />
                          <p className="text-center text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                            Paris
                          </p>
                          <p className="text-center text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                            Gagnés
                          </p>
                          <p className="text-right text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                            Réussite
                          </p>
                          <div />
                        </div>
                        {data.rows.map((row) => {
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
                              <div
                                className={cn(
                                  "absolute inset-y-0 left-0 opacity-10",
                                  row.isGood
                                    ? "bg-success"
                                    : "bg-muted-foreground",
                                )}
                                style={{ width: `${barWidth}%` }}
                              />
                              <div className="relative grid grid-cols-[48px_1fr_48px_48px_56px_28px] items-center gap-2">
                                <span className="text-xs font-bold tabular-nums">
                                  {row.probability.toFixed(1)}%
                                </span>
                                <div className="h-1 overflow-hidden rounded-full bg-border">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      row.isGood
                                        ? "bg-success"
                                        : "bg-muted-foreground/50",
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
                                    row.isGood
                                      ? "text-success"
                                      : "text-foreground",
                                  )}
                                >
                                  {(row.hitRate * 100).toFixed(1)}%
                                </span>
                                <span className="flex justify-center">
                                  {row.isGood ? (
                                    <TrendingUp
                                      size={12}
                                      className="text-success"
                                    />
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
                      <p className="text-[0.68rem] leading-snug text-muted-foreground">
                        Fiable quand le taux de réussite réel ≥ la probabilité
                        annoncée par le modèle.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Legend */}
              <p className="text-[0.68rem] leading-snug text-muted-foreground">
                <span className="font-semibold text-foreground/60">
                  Taux de réussite
                </span>{" "}
                — % de picks gagnés sur la période.{" "}
                <span className="font-semibold text-foreground/60">ROI</span> —
                gain net moyen par unité misée à mise égale : +10% signifie
                +0,10€ gagné pour chaque 1€ joué.
              </p>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
