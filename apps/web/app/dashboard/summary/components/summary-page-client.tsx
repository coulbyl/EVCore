"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChartNoAxesColumn,
  CheckCircle2,
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
  type FilterDef,
  type FilterState,
} from "@evcore/ui";
import { useSummary } from "@/domains/summary/use-cases/get-summary";
import { EvLineChart } from "@/components/charts/ev-line-chart";
import { CanalBadge } from "@/components/canal-badge";
import { Amount } from "@/components/amount";
import {
  formatCombinedPickForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import { formatKickoff } from "@/domains/fixture/helpers/fixture";
import { useIsMobile } from "@/hooks/use-mobile";
import type {
  SummaryChannel,
  SummaryPeriod,
  SummaryPickRow,
} from "@/domains/summary/types/summary";

// ── simulation ────────────────────────────────────────────────────────────────

type SimResult = {
  count: number;
  totalStaked: number;
  totalReturned: number;
  net: number;
  roi: number;
};

function runSimulation(picks: SummaryPickRow[], stake: number): SimResult {
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

function SimulationDrawer({
  open,
  onClose,
  picks,
  isMobile,
}: {
  open: boolean;
  onClose: () => void;
  picks: SummaryPickRow[];
  isMobile: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stakeInput, setStakeInput] = useState("");
  const [result, setResult] = useState<SimResult | null>(null);

  function handleSimulate() {
    const stake = parseFloat(stakeInput.replace(",", "."));
    if (!isFinite(stake) || stake <= 0) return;
    setResult(runSimulation(picks, stake));
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
            ? "z-50 flex min-h-[55dvh] max-h-[92dvh] flex-col rounded-t-[1.5rem] border-t border-border bg-panel outline-none"
            : "z-50 inset-y-4 right-4 flex h-[calc(100dvh-2rem)] w-[380px] flex-col rounded-[1.5rem] border border-border bg-panel shadow-[0_24px_80px_rgba(15,23,42,0.18)] outline-none"
        }
      >
        <DrawerTitle className="sr-only">Simulation de gains</DrawerTitle>

        {/* Header */}
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

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
          <p className="text-sm text-muted-foreground">
            Si tu avais misé la même somme sur chacun des{" "}
            <span className="font-semibold text-foreground">
              {picks.length} picks
            </span>{" "}
            de la période filtrée, voici ce que tu aurais gagné ou perdu.
          </p>

          {/* Input */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Mise par pick
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

          {/* Results */}
          {result !== null ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Résultat
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-secondary/50 p-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                    Picks
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
                  className={`rounded-xl p-3 ${
                    result.net >= 0 ? "bg-success/10" : "bg-destructive/10"
                  }`}
                >
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                    Gain net
                  </p>
                  <p
                    className={`mt-1 text-xl font-bold ${
                      result.net >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    <Amount value={result.net} signed />
                  </p>
                  <p
                    className={`mt-0.5 text-xs tabular-nums ${
                      result.roi >= 0 ? "text-success" : "text-destructive"
                    }`}
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

// ── constants ─────────────────────────────────────────────────────────────────

const CANAL_COLOR: Record<SummaryChannel, string> = {
  EV: "var(--canal-ev)",
  SV: "var(--canal-sv)",
  CONF: "var(--canal-conf)",
  DRAW: "var(--canal-draw)",
  BTTS: "var(--canal-btts)",
};

const DEFAULT_CHANNEL: SummaryChannel = "SV";
const DEFAULT_PERIOD: SummaryPeriod = "7d";

const FILTER_DEFS: FilterDef[] = [
  {
    key: "channel",
    label: "Canal",
    type: "select",
    options: [
      { value: "EV", label: "EV" },
      { value: "SV", label: "SV" },
      { value: "CONF", label: "Confiance" },
      { value: "DRAW", label: "NUL" },
      { value: "BTTS", label: "BB" },
    ],
  },
  {
    key: "period",
    label: "Période",
    type: "select",
    options: [
      { value: "7d", label: "7 derniers jours" },
      { value: "30d", label: "30 derniers jours" },
      { value: "3m", label: "3 derniers mois" },
    ],
  },
];

// ── helpers ───────────────────────────────────────────────────────────────────

const PRED_PICK_LABEL: Record<string, string> = {
  HOME: "DOM",
  AWAY: "EXT",
  DRAW: "NUL",
  YES: "BB OUI",
  NO: "BB NON",
};

function buildPickLabel(row: SummaryPickRow): string {
  if (row.channel === "EV" || row.channel === "SV") {
    return formatCombinedPickForDisplay({
      market: row.market,
      pick: row.pick,
      comboMarket: row.comboMarket ?? undefined,
      comboPick: row.comboPick ?? undefined,
    });
  }
  return (
    PRED_PICK_LABEL[row.pick] ?? formatPickForDisplay(row.pick, row.market)
  );
}

function formatChartDate(iso: string): string {
  return `${iso.slice(8)}/${iso.slice(5, 7)}`;
}

// ── subcomponents ─────────────────────────────────────────────────────────────

function TeamLogos({
  homeLogo,
  awayLogo,
}: {
  homeLogo: string | null;
  awayLogo: string | null;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {homeLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={homeLogo} alt="" className="size-5 object-contain" />
      ) : (
        <div className="size-5 rounded-full bg-secondary" />
      )}
      {awayLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={awayLogo} alt="" className="size-5 object-contain" />
      ) : (
        <div className="size-5 rounded-full bg-secondary" />
      )}
    </div>
  );
}

function SummaryPickItem({ row }: { row: SummaryPickRow }) {
  const pickLabel = buildPickLabel(row);

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-panel-strong px-3 py-3">
      <TeamLogos homeLogo={row.homeLogo} awayLogo={row.awayLogo} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-foreground">
            {row.fixture}
          </p>
          <CanalBadge canal={row.channel} />
        </div>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {row.competition}
          {" · "}
          {formatKickoff(row.scheduledAt)}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {pickLabel ? (
            <Badge variant="secondary" className="text-[0.68rem]">
              {pickLabel}
            </Badge>
          ) : null}
          {row.odds ? (
            <Badge variant="outline" className="text-[0.68rem] tabular-nums">
              {row.odds}
            </Badge>
          ) : null}
          {row.ev ? (
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: CANAL_COLOR[row.channel] }}
            >
              {row.ev}
            </span>
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

// ── main ──────────────────────────────────────────────────────────────────────

export function SummaryPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const channel =
    (searchParams.get("channel") as SummaryChannel) ?? DEFAULT_CHANNEL;
  const period =
    (searchParams.get("period") as SummaryPeriod) ?? DEFAULT_PERIOD;

  const [filters, setFilters] = useState<FilterState>({ channel, period });
  const [simOpen, setSimOpen] = useState(false);

  const { data, isLoading, isError } = useSummary({ channel, period });

  const chartData = useMemo(
    () =>
      (data?.progression ?? []).map((p) => ({
        date: formatChartDate(p.date),
        won: p.won,
        lost: p.lost,
      })),
    [data],
  );

  const won = useMemo(
    () => (data?.picks ?? []).filter((p) => p.result === "WON"),
    [data],
  );
  const lost = useMemo(
    () => (data?.picks ?? []).filter((p) => p.result === "LOST"),
    [data],
  );

  function handleFiltersChange(next: FilterState) {
    setFilters(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.channel) params.set("channel", next.channel as string);
    else params.delete("channel");
    if (next.period) params.set("period", next.period as string);
    else params.delete("period");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleReset() {
    setFilters({ channel: DEFAULT_CHANNEL, period: DEFAULT_PERIOD });
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
            />
          </section>

          {/* Stats */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <StatCard
              compact={isMobile}
              icon={<LayoutList size={14} />}
              label="Total"
              value={isLoading ? "—" : String(data?.stats.total ?? 0)}
              tone="neutral"
            />
            <StatCard
              compact={isMobile}
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
              compact={isMobile}
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
              compact={isMobile}
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
                  ? `${data.stats.roiPickCount} picks`
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

          {/* Pick list */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {isLoading
                  ? "Chargement…"
                  : `Picks résolus (${data?.stats.total ?? 0})`}
              </p>
              {!isLoading && (data?.stats.total ?? 0) > 0 ? (
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
                Impossible de charger le résumé.
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
            ) : (data?.stats.total ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun résultat pour cette période.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {won.map((row) => (
                  <SummaryPickItem
                    key={row.fixtureId + row.channel}
                    row={row}
                  />
                ))}
                {won.length > 0 && lost.length > 0 ? (
                  <GroupDivider label="Perdus" />
                ) : null}
                {lost.map((row) => (
                  <SummaryPickItem
                    key={row.fixtureId + row.channel}
                    row={row}
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
        isMobile={isMobile}
      />
    </Page>
  );
}
