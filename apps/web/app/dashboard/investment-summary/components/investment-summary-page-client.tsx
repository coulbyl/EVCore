"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  CheckCircle2,
  ChartNoAxesColumn,
  LayoutList,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerTitle,
  FilterBar,
  Page,
  PageContent,
  StatCard,
  type DateRange,
  type FilterDef,
  type FilterState,
} from "@evcore/ui";

import { isoToDate, toISODate, daysAgoIso } from "@/lib/date";
import { useInvestmentSummary } from "@/domains/investment-summary/use-cases/use-investment-summary";
import { EvLineChart } from "@/components/charts/ev-line-chart";
import { Amount } from "@/components/amount";
import {
  formatPickForDisplay,
  formatMarketForDisplay,
} from "@/helpers/fixture";
import { formatKickoff } from "@/domains/fixture/helpers/fixture";
import { useIsMobile } from "@/hooks/use-mobile";
import type {
  InvestmentSummaryCanal,
  InvestmentSummaryPickRow,
  InvestmentSummaryCouponRow,
} from "@/domains/investment-summary/types/investment-summary";

// ── Simulation ────────────────────────────────────────────────────────────────

type SimResult = {
  count: number;
  totalStaked: number;
  totalReturned: number;
  net: number;
  roi: number;
};

function runPickSimulation(
  picks: InvestmentSummaryPickRow[],
  stake: number,
): SimResult {
  const count = picks.length;
  const totalStaked = count * stake;
  const totalReturned = picks.reduce((acc, p) => {
    if (p.result === "WON" && p.odds !== null) {
      return acc + stake * parseFloat(p.odds);
    }
    return acc;
  }, 0);
  const net = totalReturned - totalStaked;
  const roi = totalStaked > 0 ? (net / totalStaked) * 100 : 0;
  return { count, totalStaked, totalReturned, net, roi };
}

function runCouponSimulation(
  coupons: InvestmentSummaryCouponRow[],
  stake: number,
): SimResult {
  const count = coupons.length;
  const totalStaked = count * stake;
  const totalReturned = coupons.reduce((acc, c) => {
    return c.result === "WON" ? acc + stake * c.combinedOdds : acc;
  }, 0);
  const net = totalReturned - totalStaked;
  const roi = totalStaked > 0 ? (net / totalStaked) * 100 : 0;
  return { count, totalStaked, totalReturned, net, roi };
}

function SimulationDrawer({
  open,
  onClose,
  picks,
  coupons,
  isCouponMode,
  isMobile,
}: {
  open: boolean;
  onClose: () => void;
  picks: InvestmentSummaryPickRow[];
  coupons: InvestmentSummaryCouponRow[];
  isCouponMode: boolean;
  isMobile: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stakeInput, setStakeInput] = useState("");
  const [result, setResult] = useState<SimResult | null>(null);

  const itemCount = isCouponMode ? coupons.length : picks.length;

  function handleSimulate() {
    const stake = parseFloat(stakeInput.replace(",", "."));
    if (!isFinite(stake) || stake <= 0) return;
    setResult(
      isCouponMode
        ? runCouponSimulation(coupons, stake)
        : runPickSimulation(picks, stake),
    );
  }

  function handleClose() {
    setStakeInput("");
    setResult(null);
    onClose();
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && handleClose()}
      direction={isMobile ? "bottom" : "right"}
    >
      <DrawerContent
        className={
          isMobile
            ? "z-50 flex max-h-[85vh] flex-col rounded-t-[1.5rem] border-t border-border bg-panel outline-none"
            : "z-50 inset-y-4 right-4 flex h-[calc(100dvh-2rem)] w-[380px] flex-col rounded-[1.5rem] border border-border bg-panel shadow-[0_24px_80px_rgba(15,23,42,0.18)] outline-none"
        }
      >
        <DrawerTitle className="sr-only">Simulation de gains</DrawerTitle>
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <ChartNoAxesColumn size={16} className="text-muted-foreground" />
            <span className="text-sm font-semibold">Simulation de gains</span>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
          <p className="text-sm text-muted-foreground">
            Si tu avais misé la même somme sur chacun des{" "}
            <span className="font-semibold text-foreground">{itemCount}</span>{" "}
            {isCouponMode ? "coupons" : "picks"} de la période filtrée, voici ce
            que tu aurais gagné ou perdu.
          </p>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {isCouponMode ? "Mise par coupon" : "Mise par pick"}
            </label>
            <input
              ref={inputRef}
              type="number"
              min={0}
              step={1}
              value={stakeInput}
              onChange={(e) => {
                setStakeInput(e.target.value);
                setResult(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSimulate()}
              placeholder="Ex : 50"
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Button
            onClick={handleSimulate}
            disabled={!stakeInput || parseFloat(stakeInput) <= 0}
            className="w-full"
          >
            Simuler
          </Button>
          {result !== null ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Résultat
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-secondary/50 p-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                    {isCouponMode ? "Coupons" : "Picks"}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums">
                    {result.count}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary/50 p-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                    Total misé
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    <Amount value={result.totalStaked} />
                  </p>
                </div>
                <div className="rounded-xl bg-secondary/50 p-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                    Retourné
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    <Amount value={result.totalReturned} />
                  </p>
                </div>
                <div
                  className={`rounded-xl p-3 ${result.net >= 0 ? "bg-success/10" : "bg-destructive/10"}`}
                >
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                    Gain net
                  </p>
                  <p
                    className={`mt-1 text-xl font-bold ${result.net >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    <Amount value={result.net} signed />
                  </p>
                  <p
                    className={`mt-0.5 text-xs tabular-nums ${result.roi >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    ROI {result.roi >= 0 ? "+" : ""}
                    {result.roi.toFixed(1)} %
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CANAL_COLOR: Record<InvestmentSummaryCanal, string> = {
  EV: "var(--canal-ev)",
  SV: "var(--canal-sv)",
  CONF: "var(--canal-conf)",
  NUL: "var(--canal-draw)",
  BB: "var(--canal-btts)",
  COUPON: "var(--canal-sv)",
};

const DEFAULT_CANAL: InvestmentSummaryCanal = "SV";

const FILTER_DEFS: FilterDef[] = [
  {
    key: "canal",
    label: "Canal",
    type: "select",
    options: [
      { value: "EV", label: "EV" },
      { value: "SV", label: "SV" },
      { value: "CONF", label: "VICTOIRE" },
      { value: "NUL", label: "NUL" },
      { value: "BB", label: "BB" },
      { value: "COUPON", label: "COUPON" },
    ],
  },
  {
    key: "daterange",
    label: "Période",
    type: "daterange",
  },
];

// ── Pick item ─────────────────────────────────────────────────────────────────

function PickItem({ row }: { row: InvestmentSummaryPickRow }) {
  const color = CANAL_COLOR[row.canal];
  const marketLabel = formatMarketForDisplay(row.market, "fr");
  const pickLabel = formatPickForDisplay(row.pick, row.market);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card p-3 pl-4">
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: color }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm font-semibold">{row.fixture}</p>
          <p className="text-xs text-muted-foreground">
            {row.competition} · {formatKickoff(row.scheduledAt)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[0.68rem]">
              {marketLabel} · {pickLabel}
            </Badge>
            {row.odds ? (
              <Badge variant="outline" className="text-[0.68rem] tabular-nums">
                @{row.odds}
              </Badge>
            ) : null}
            <Badge
              variant={row.result === "WON" ? "success" : "destructive"}
              className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest"
            >
              {row.result === "WON" ? "Gagné" : "Perdu"}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Coupon item ───────────────────────────────────────────────────────────────

function CouponItem({ row }: { row: InvestmentSummaryCouponRow }) {
  const probPct = (row.jointProbability * 100).toFixed(0);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
            Coupon #{row.rank} · {row.forDate}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono tabular-nums text-muted-foreground">
            @{row.combinedOdds.toFixed(2)}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {probPct}%
          </span>
          <Badge
            variant={row.result === "WON" ? "success" : "destructive"}
            className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest"
          >
            {row.result === "WON" ? "Gagné" : "Perdu"}
          </Badge>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {row.legs.map((leg, i) => {
          const color =
            CANAL_COLOR[(leg.canal as InvestmentSummaryCanal) ?? "SV"];
          return (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/30 px-2.5 py-1.5"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {leg.homeLogo && (
                  <Image
                    src={leg.homeLogo}
                    alt=""
                    width={12}
                    height={12}
                    className="size-3 object-contain"
                  />
                )}
                {leg.awayLogo && (
                  <Image
                    src={leg.awayLogo}
                    alt=""
                    width={12}
                    height={12}
                    className="size-3 object-contain"
                  />
                )}
                <span className="min-w-0 truncate text-xs">{leg.fixture}</span>
              </div>
              {leg.odds !== null && (
                <span className="shrink-0 text-xs font-mono text-muted-foreground tabular-nums">
                  @{leg.odds.toFixed(2)}
                </span>
              )}
              {leg.isCorrect !== null && (
                <span
                  className={`shrink-0 text-[0.6rem] font-bold uppercase tracking-widest ${leg.isCorrect ? "text-success" : "text-destructive"}`}
                >
                  {leg.isCorrect ? "✓" : "✗"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroupDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function formatChartDate(iso: string): string {
  return `${iso.slice(8)}/${iso.slice(5, 7)}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function InvestmentSummaryPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const canal =
    (searchParams.get("canal") as InvestmentSummaryCanal) ?? DEFAULT_CANAL;
  const fromParam = searchParams.get("from") ?? undefined;
  const toParam = searchParams.get("to") ?? undefined;

  const yesterday = daysAgoIso(1);

  const [filters, setFilters] = useState<FilterState>({
    canal,
    daterange: fromParam
      ? {
          from: isoToDate(fromParam),
          to: toParam ? isoToDate(toParam) : undefined,
        }
      : undefined,
  });
  const [simOpen, setSimOpen] = useState(false);

  const daterange = filters.daterange as DateRange | undefined;
  const effectiveFrom = daterange?.from ? toISODate(daterange.from) : undefined;
  const effectiveTo = daterange?.to ? toISODate(daterange.to) : yesterday;

  const { data, isLoading, isError } = useInvestmentSummary({
    canal,
    from: effectiveFrom,
    to: effectiveTo,
  });

  const isCouponMode = canal === "COUPON";

  const chartData = useMemo(
    () =>
      (data?.progression ?? []).map((p) => ({
        date: formatChartDate(p.date),
        won: p.won,
        lost: p.lost,
      })),
    [data],
  );

  const wonPicks = useMemo(
    () => (data?.picks ?? []).filter((p) => p.result === "WON"),
    [data],
  );
  const lostPicks = useMemo(
    () => (data?.picks ?? []).filter((p) => p.result === "LOST"),
    [data],
  );
  const wonCoupons = useMemo(
    () => (data?.coupons ?? []).filter((c) => c.result === "WON"),
    [data],
  );
  const lostCoupons = useMemo(
    () => (data?.coupons ?? []).filter((c) => c.result === "LOST"),
    [data],
  );

  const totalItems = data?.stats.total ?? 0;

  function handleFiltersChange(next: FilterState) {
    setFilters(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.canal) params.set("canal", next.canal as string);
    else params.delete("canal");
    const dr = next.daterange as DateRange | undefined;
    if (dr?.from) params.set("from", toISODate(dr.from));
    else params.delete("from");
    if (dr?.to) {
      const iso = toISODate(dr.to);
      params.set("to", iso > yesterday ? yesterday : iso);
    } else {
      params.delete("to");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleReset() {
    setFilters({ canal: DEFAULT_CANAL });
    router.push(pathname);
  }

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5">
          {/* Filters */}
          <section className="shrink-0">
            <FilterBar
              filters={FILTER_DEFS}
              value={filters}
              onChange={handleFiltersChange}
              onReset={handleReset}
              className="[&>div]:w-[260px]"
            />
          </section>

          {/* Stats */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <StatCard
              icon={<LayoutList size={14} />}
              label={isCouponMode ? "Coupons" : "Picks"}
              value={isLoading ? "—" : String(data?.stats.total ?? 0)}
              tone="neutral"
            />
            <StatCard
              icon={<CheckCircle2 size={14} />}
              label="Gagnés"
              value={isLoading ? "—" : String(data?.stats.won ?? 0)}
              tone="success"
              delta={
                data && data.stats.total > 0
                  ? `${Math.round((data.stats.won / data.stats.total) * 100)}%`
                  : undefined
              }
            />
            <StatCard
              icon={<XCircle size={14} />}
              label="Perdus"
              value={isLoading ? "—" : String(data?.stats.lost ?? 0)}
              tone="danger"
              delta={
                data && data.stats.total > 0
                  ? `${Math.round((data.stats.lost / data.stats.total) * 100)}%`
                  : undefined
              }
            />
            <StatCard
              icon={<TrendingUp size={14} />}
              label="ROI"
              value={isLoading ? "—" : (data?.stats.roi ?? "—")}
              tone={
                data?.stats.roi == null
                  ? "neutral"
                  : data.stats.roi.startsWith("+")
                    ? "success"
                    : "danger"
              }
              delta={
                data?.stats.roiPickCount
                  ? `${data.stats.roiPickCount} ${isCouponMode ? "coupons" : "picks"}`
                  : undefined
              }
            />
          </section>

          {/* Progression chart */}
          {!isLoading && chartData.length > 1 ? (
            <section className="rounded-2xl border border-border bg-panel-strong p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Progression
              </p>
              <EvLineChart
                data={chartData}
                xKey="date"
                lines={[
                  { key: "won", color: "#4ade80", label: "Gagnés" },
                  { key: "lost", color: "#f87171", label: "Perdus" },
                ]}
                height={200}
                showLegend
                formatY={(v) => String(v)}
              />
            </section>
          ) : null}

          {/* Item list */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {isLoading
                  ? "Chargement…"
                  : `${isCouponMode ? "Coupons" : "Picks"} résolus (${totalItems})`}
              </p>
              {!isLoading && totalItems > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSimOpen(true)}
                  className="h-7 gap-1.5 text-xs"
                >
                  <ChartNoAxesColumn size={12} />
                  Simulateur
                </Button>
              ) : null}
            </div>

            {isError ? (
              <p className="text-sm text-destructive">
                Impossible de charger le résumé investment.
              </p>
            ) : isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-2xl bg-secondary"
                  />
                ))}
              </div>
            ) : totalItems === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun résultat pour cette période.
              </p>
            ) : isCouponMode ? (
              <div className="flex flex-col gap-2">
                {wonCoupons.map((c) => (
                  <CouponItem key={c.id} row={c} />
                ))}
                {wonCoupons.length > 0 && lostCoupons.length > 0 ? (
                  <GroupDivider label="Perdus" />
                ) : null}
                {lostCoupons.map((c) => (
                  <CouponItem key={c.id} row={c} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {wonPicks.map((p) => (
                  <PickItem
                    key={p.fixtureId + p.canal + p.market + p.pick}
                    row={p}
                  />
                ))}
                {wonPicks.length > 0 && lostPicks.length > 0 ? (
                  <GroupDivider label="Perdus" />
                ) : null}
                {lostPicks.map((p) => (
                  <PickItem
                    key={p.fixtureId + p.canal + p.market + p.pick}
                    row={p}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </PageContent>

      <SimulationDrawer
        open={simOpen}
        onClose={() => setSimOpen(false)}
        picks={data?.picks ?? []}
        coupons={data?.coupons ?? []}
        isCouponMode={isCouponMode}
        isMobile={isMobile}
      />
    </Page>
  );
}
