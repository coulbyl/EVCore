"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, LayoutList, XCircle } from "lucide-react";
import {
  Badge,
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
  return PRED_PICK_LABEL[row.pick] ?? formatPickForDisplay(row.pick, row.market);
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
          <section className="grid grid-cols-3 gap-3 sm:gap-4">
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
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {isLoading
                ? "Chargement…"
                : `Picks résolus (${data?.stats.total ?? 0})`}
            </p>

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
                  <SummaryPickItem key={row.fixtureId + row.channel} row={row} />
                ))}
                {won.length > 0 && lost.length > 0 ? (
                  <GroupDivider label="Perdus" />
                ) : null}
                {lost.map((row) => (
                  <SummaryPickItem key={row.fixtureId + row.channel} row={row} />
                ))}
              </div>
            )}
          </section>
        </div>
      </PageContent>
    </Page>
  );
}
