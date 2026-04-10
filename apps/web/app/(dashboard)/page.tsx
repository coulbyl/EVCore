"use client";

import { useState } from "react";
import { Badge, Page, PageContent, StatCard } from "@evcore/ui";
import { AppPageHeader } from "@/components/app-page-header";
import { FixtureDetailPanel } from "@/components/fixture-detail-panel";
import { OpportunitiesTable } from "@/components/opportunities-table";
import { RecentCouponsCard } from "@/components/recent-coupons-card";
import { formatCompactValue } from "@/helpers/number";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import type {
  DashboardSummary,
  FixturePanel,
  KpiDelta,
  OpportunityRow,
} from "@/types/dashboard";

function rowToFixturePanel(row: OpportunityRow): FixturePanel {
  return {
    fixtureId: row.fixtureId,
    fixture: row.fixture,
    homeLogo: row.homeLogo,
    awayLogo: row.awayLogo,
    competition: row.competition,
    startTime: row.kickoff,
    market: row.market,
    pick: row.pick,
    modelConfidence:
      "Sélection calculée à partir des dernières exécutions du modèle.",
    notes: [
      `score qualité ${row.quality}`,
      `déterministe ${row.deterministic}`,
    ],
    metrics: [
      { label: "EV", value: row.ev, tone: "accent" },
      { label: "Qualité", value: row.quality, tone: "success" },
      { label: "Déterministe", value: row.deterministic, tone: "warning" },
      { label: "Cotes", value: row.odds, tone: "neutral" },
    ],
  };
}

function renderKpiDelta(delta: KpiDelta, compact = false) {
  if (typeof delta === "object") {
    return (
      <div className={`flex items-center gap-2 ${compact ? "px-0" : "px-2"}`}>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          {delta.bet} BET
        </span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
          {delta.noBet} NO_BET
        </span>
      </div>
    );
  }

  if (
    (delta.startsWith("+") || delta.startsWith("-")) &&
    (delta.includes("vs") || delta.includes("hier"))
  ) {
    const [value, ...rest] = delta.split(" ");
    return (
      <div
        className={`flex items-center gap-2 ${compact ? "flex-wrap px-0" : "px-2"}`}
      >
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          {value}
        </span>
        <span
          className={`font-medium uppercase text-slate-500 ${compact ? "text-[0.62rem] tracking-[0.1em]" : "text-xs tracking-[0.12em]"}`}
        >
          {rest.join(" ")}
        </span>
      </div>
    );
  }

  if (
    delta.toLowerCase().includes("couverture") ||
    delta.toLowerCase().includes("coverage")
  ) {
    const percentMatch = delta.match(/(\d+(?:[.,]\d+)?)%/);
    const rawPercent = percentMatch?.[1] ?? "0";
    const percentValue = `${rawPercent.replace(",", ".")}%`;
    return (
      <div className={compact ? "space-y-1" : "flex items-center gap-2 px-2"}>
        <div className={compact ? "flex items-center gap-1.5" : "contents"}>
          <span
            className={`${compact ? "text-[0.78rem]" : "text-sm"} font-semibold text-slate-700`}
          >
            {percentValue}
          </span>
          <div
            className={`${compact ? "h-1.5 min-w-0 flex-1" : "h-2 w-20"} overflow-hidden rounded-full bg-slate-200`}
          >
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: percentValue }}
            />
          </div>
        </div>
        <span
          className={`uppercase text-slate-500 ${compact ? "block text-[0.56rem] tracking-[0.16em]" : "text-xs tracking-[0.12em]"}`}
        >
          couverture
        </span>
      </div>
    );
  }

  return (
    <p
      className={`${compact ? "px-0 text-[0.72rem]" : "px-2 text-sm"} text-slate-500`}
    >
      {delta}
    </p>
  );
}

function workerStatusLabel(status: string) {
  if (status === "healthy") return "sain";
  if (status === "watch") return "surveillance";
  if (status === "late") return "retard";
  return status;
}

const EMPTY_SUMMARY: DashboardSummary = {
  dashboardKpis: [
    {
      label: "Matchs planifiés",
      value: "0",
      delta: "+0 vs hier",
      tone: "accent",
    },
    {
      label: "Matchs avec cotes",
      value: "0",
      delta: "0,0% de couverture",
      tone: "success",
    },
    {
      label: "Scorings du jour",
      value: "0",
      delta: "0 analysés",
      tone: "warning",
    },
    {
      label: "Alertes actives",
      value: "00",
      delta: "0 haute priorité",
      tone: "danger",
    },
  ],
  workerStatuses: [],
  activeAlerts: [],
  couponSnapshots: [],
  topOpportunities: [],
  selectedFixture: {
    fixtureId: "",
    fixture: "Aucun match",
    homeLogo: null,
    awayLogo: null,
    competition: "-",
    startTime: "--:--",
    market: "-",
    pick: "-",
    modelConfidence: "Aucune donnée disponible.",
    notes: ["Aucun run modèle disponible."],
    metrics: [
      { label: "EV", value: "+0.000", tone: "accent" },
      { label: "Qualité", value: "0", tone: "success" },
      { label: "Déterministe", value: "0.00", tone: "warning" },
      { label: "Cotes", value: "0.00", tone: "neutral" },
    ],
  },
  activityFeed: [],
  pnlSummary: {
    settledBets: 0,
    wonBets: 0,
    winRate: "0.0%",
    netUnits: "+0.000",
    roi: "+0.0%",
  },
};

export default function Home() {
  const isMobile = useIsMobile();
  const { data, refetch, isFetching, isError } = useDashboardSummary();
  const {
    dashboardKpis: kpis,
    topOpportunities: opportunities,
    couponSnapshots: coupons,
    selectedFixture: apiFixture,
    workerStatuses: workers,
    activeAlerts: alerts,
    pnlSummary: pnl,
  } = data ?? EMPTY_SUMMARY;

  const [selectedRow, setSelectedRow] = useState<OpportunityRow | null>(null);
  const fixture =
    selectedRow !== null ? rowToFixturePanel(selectedRow) : apiFixture;
  const lostBets = Math.max(0, pnl.settledBets - pnl.wonBets);
  const netUnits = Number.parseFloat(pnl.netUnits.replace(",", "."));
  const roiPct = Number.parseFloat(pnl.roi.replace(",", "."));
  const winBarPct =
    pnl.settledBets > 0 ? Math.round((pnl.wonBets / pnl.settledBets) * 100) : 0;
  const compactSettledBets = formatCompactValue(pnl.settledBets);
  const compactRoi = isMobile ? formatCompactValue(pnl.roi) : pnl.roi;
  const compactNetUnits = isMobile
    ? formatCompactValue(pnl.netUnits)
    : pnl.netUnits;

  return (
    <Page className="flex h-full flex-col">
      <AppPageHeader
        currentPageLabel="Tableau de bord"
        subtitle="Tableau de bord"
        backendLabel={isError ? "indisponible" : "OK"}
        onRefresh={() => void refetch()}
        isRefreshing={isFetching}
      />

      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="space-y-5">
          <section className="rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Performance globale
                </p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                  Gains &amp; pertes
                </h2>
              </div>
              {pnl.settledBets === 0 && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  En attente de résultats
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
              <div
                className={`min-w-0 rounded-[1.15rem] border ${isMobile ? "px-2.5 py-2.5" : "rounded-2xl px-4 py-3"} ${Number.isFinite(roiPct) && roiPct > 0 ? "border-emerald-200 bg-emerald-50" : Number.isFinite(roiPct) && roiPct < 0 ? "border-rose-200 bg-rose-50" : "border-border bg-slate-50"}`}
              >
                <p
                  className={`${isMobile ? "text-[0.56rem] tracking-[0.16em]" : "text-[0.68rem] tracking-[0.2em]"} font-semibold uppercase text-slate-500`}
                >
                  ROI
                </p>
                <p
                  className={`${isMobile ? "mt-1 text-[0.95rem] leading-none" : "mt-1 text-[1.45rem] sm:text-[1.6rem]"} font-semibold tabular-nums tracking-tight ${Number.isFinite(roiPct) && roiPct > 0 ? "text-emerald-700" : Number.isFinite(roiPct) && roiPct < 0 ? "text-rose-700" : "text-slate-700"}`}
                >
                  {compactRoi}
                </p>
                <p
                  className={`${isMobile ? "mt-1 text-[0.63rem]" : "mt-0.5 text-xs"} text-slate-400`}
                >
                  {isMobile ? "capital" : "sur capital misé"}
                </p>
              </div>

              <div
                className={`min-w-0 rounded-[1.15rem] border ${isMobile ? "px-2.5 py-2.5" : "rounded-2xl px-4 py-3"} ${Number.isFinite(netUnits) && netUnits > 0 ? "border-emerald-200 bg-emerald-50" : Number.isFinite(netUnits) && netUnits < 0 ? "border-rose-200 bg-rose-50" : "border-border bg-slate-50"}`}
              >
                <p
                  className={`${isMobile ? "text-[0.56rem] tracking-[0.16em]" : "text-[0.68rem] tracking-[0.2em]"} font-semibold uppercase text-slate-500`}
                >
                  Gain net
                </p>
                <p
                  className={`${isMobile ? "mt-1 text-[0.95rem] leading-none" : "mt-1 text-[1.45rem] sm:text-[1.6rem]"} font-semibold tabular-nums tracking-tight ${Number.isFinite(netUnits) && netUnits > 0 ? "text-emerald-700" : Number.isFinite(netUnits) && netUnits < 0 ? "text-rose-700" : "text-slate-700"}`}
                >
                  {compactNetUnits}
                </p>
                <p
                  className={`${isMobile ? "mt-1 text-[0.63rem]" : "mt-0.5 text-xs"} text-slate-400`}
                >
                  {isMobile ? "stake" : "unités de stake"}
                </p>
              </div>

              <div
                className={`min-w-0 rounded-[1.15rem] border border-border bg-slate-50 ${isMobile ? "px-2.5 py-2.5" : "rounded-2xl px-4 py-3"}`}
              >
                <p
                  className={`${isMobile ? "text-[0.56rem] tracking-[0.16em]" : "text-[0.68rem] tracking-[0.2em]"} font-semibold uppercase text-slate-500`}
                >
                  Réussite
                </p>
                <p
                  className={`${isMobile ? "mt-1 text-[0.95rem] leading-none" : "mt-1 text-[1.45rem] sm:text-[1.6rem]"} font-semibold tabular-nums tracking-tight text-slate-700`}
                >
                  {pnl.winRate}
                </p>
                <p
                  className={`${isMobile ? "mt-1 text-[0.63rem]" : "mt-0.5 text-xs"} text-slate-400`}
                >
                  {compactSettledBets} {isMobile ? "settlés" : "bets settlés"}
                </p>
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-emerald-600">
                  {pnl.wonBets} gagnés
                </span>
                <span className="text-xs font-semibold text-rose-500">
                  {lostBets} perdus
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-rose-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${winBarPct}%` }}
                />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {kpis.map((item) => (
              <StatCard
                key={item.label}
                label={item.label}
                value={isMobile ? formatCompactValue(item.value) : item.value}
                tone={item.tone}
                delta={renderKpiDelta(item.delta, isMobile)}
                compact={isMobile}
              />
            ))}
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.72fr)_minmax(330px,0.88fr)]">
            <section className="space-y-5">
              <OpportunitiesTable
                rows={opportunities}
                selectedId={selectedRow?.id ?? null}
                onSelectAction={setSelectedRow}
              />
              <RecentCouponsCard snapshots={coupons} />
            </section>
            <aside className="space-y-5">
              {!isMobile ? <FixtureDetailPanel fixture={fixture} /> : null}

              {/* Pipeline */}
              <div className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      État du pipeline
                    </p>
                    <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                      ETL et scoring
                    </h2>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  {workers.map((worker) => (
                    <div
                      key={worker.worker}
                      className="rounded-2xl border border-border bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800">
                          {worker.worker}
                        </p>
                        <Badge
                          tone={
                            worker.status === "healthy"
                              ? "success"
                              : worker.status === "watch"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {workerStatusLabel(worker.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                        Dernière exécution {worker.lastRun}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {worker.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alertes */}
              <div className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Alertes actives
                    </p>
                    <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                      Points d&apos;attention
                    </h2>
                  </div>
                  <Badge tone="danger">{alerts.length} ouvertes</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-[1.2rem] border border-border bg-slate-50/90 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-800">
                          {alert.title}
                        </p>
                        <Badge
                          tone={
                            alert.severity === "high"
                              ? "danger"
                              : alert.severity === "medium"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {alert.severity === "high"
                            ? "élevée"
                            : alert.severity === "medium"
                              ? "moyenne"
                              : "faible"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {alert.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
