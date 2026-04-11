"use client";

import { Suspense } from "react";
import { Badge, Page, PageContent } from "@evcore/ui";
import { AppPageHeader } from "@/components/app-page-header";
import { formatCompactValue } from "@/helpers/number";
import { useAuditOverview } from "@/hooks/use-audit-overview";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AuditOverview } from "@/types/audit";

// ---------------------------------------------------------------------------
// Overview section
// ---------------------------------------------------------------------------

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-slate-50 px-4 py-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-[1.6rem] font-semibold tabular-nums tracking-tight text-slate-800">
        {formatCompactValue(value)}
      </p>
    </div>
  );
}

function AuditOverviewSection({
  overview,
  isMobile,
}: {
  overview: AuditOverview;
  isMobile: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Counts */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CountCard label="Fixtures" value={overview.counts.fixtures} />
        <CountCard label="Model runs" value={overview.counts.modelRuns} />
        <CountCard label="Bets" value={overview.counts.bets} />
        <CountCard label="Coupons" value={overview.counts.coupons} />
      </div>

      {/* League breakdown */}
      {isMobile ? (
        <div className="space-y-3">
          {overview.leagueBreakdown.map((league) => (
            <div
              key={league.code}
              className="rounded-[1.2rem] border border-border bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[0.7rem] text-slate-600">
                      {league.code}
                    </span>
                    <span className="text-sm text-slate-500">
                      {league.name}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    league.isActive ? "text-emerald-600" : "text-slate-300"
                  }`}
                >
                  {league.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="uppercase tracking-[0.12em] text-slate-400">
                    Fixtures
                  </p>
                  <p className="mt-1 font-semibold text-slate-700">
                    {formatCompactValue(league.fixtures)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="uppercase tracking-[0.12em] text-slate-400">
                    Terminées
                  </p>
                  <p className="mt-1 font-semibold text-slate-700">
                    {formatCompactValue(league.finished)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="uppercase tracking-[0.12em] text-slate-400">
                    Cotes
                  </p>
                  <p className="mt-1 font-semibold text-slate-700">
                    {formatCompactValue(league.withOdds)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="uppercase tracking-[0.12em] text-slate-400">
                    Stats
                  </p>
                  <p className="mt-1 font-semibold text-slate-700">
                    {formatCompactValue(league.teamStats)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`tabular-nums font-semibold ${
                    league.xgCoveragePct >= 80
                      ? "text-emerald-600"
                      : league.xgCoveragePct >= 50
                        ? "text-amber-600"
                        : "text-rose-500"
                  }`}
                >
                  {league.xgCoveragePct}%
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${
                      league.xgCoveragePct >= 80
                        ? "bg-emerald-500"
                        : league.xgCoveragePct >= 50
                          ? "bg-amber-400"
                          : "bg-rose-400"
                    }`}
                    style={{ width: `${league.xgCoveragePct}%` }}
                  />
                </div>
                <span className="text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
                  xG
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.3rem] border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Ligue</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium">Fixtures</th>
                <th className="px-4 py-3 font-medium">Terminées</th>
                <th className="px-4 py-3 font-medium">Couv. xG</th>
                <th className="px-4 py-3 font-medium">Cotes</th>
                <th className="px-4 py-3 font-medium">Stats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {overview.leagueBreakdown.map((league) => (
                <tr key={league.code} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <span className="font-mono text-[0.7rem] text-slate-600">
                      {league.code}
                    </span>
                    <span className="ml-2 text-slate-500">{league.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    {league.isActive ? (
                      <span className="text-emerald-600">✓</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {league.fixtures.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {league.finished.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`tabular-nums font-semibold ${
                          league.xgCoveragePct >= 80
                            ? "text-emerald-600"
                            : league.xgCoveragePct >= 50
                              ? "text-amber-600"
                              : "text-rose-500"
                        }`}
                      >
                        {league.xgCoveragePct}%
                      </span>
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${
                            league.xgCoveragePct >= 80
                              ? "bg-emerald-500"
                              : league.xgCoveragePct >= 50
                                ? "bg-amber-400"
                                : "bg-rose-400"
                          }`}
                          style={{ width: `${league.xgCoveragePct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {league.withOdds.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {league.teamStats.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bets & coupons breakdown */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.3rem] border border-border bg-white p-4">
          <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Bets par statut
          </p>
          <div className="space-y-1.5">
            {overview.betsByStatus.map((r) => (
              <div key={r.status} className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-500">
                  {r.status}
                </span>
                <span className="font-semibold tabular-nums text-slate-700">
                  {r.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.3rem] border border-border bg-white p-4">
          <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Bets par marché
          </p>
          <div className="space-y-1.5">
            {overview.betsByMarket.map((r) => (
              <div key={r.market} className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-500">
                  {r.market}
                </span>
                <span className="font-semibold tabular-nums text-slate-700">
                  {r.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.3rem] border border-border bg-white p-4">
          <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Coupons &amp; boucle
          </p>
          <div className="space-y-1.5">
            {overview.couponsByStatus.map((r) => (
              <div key={r.status} className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-500">
                  coupon {r.status}
                </span>
                <span className="font-semibold tabular-nums text-slate-700">
                  {r.count.toLocaleString()}
                </span>
              </div>
            ))}
            <div className="mt-2 border-t border-border pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Bets settlés</span>
                <span
                  className={`font-semibold tabular-nums ${overview.settledBets >= 50 ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {overview.settledBets}
                  {overview.settledBets < 50 && (
                    <span className="ml-1 text-[0.65rem] font-normal text-slate-400">
                      / 50
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Proposals</span>
                <span className="font-semibold tabular-nums text-slate-700">
                  {overview.adjustmentProposals}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Suspensions actives
                </span>
                <span
                  className={`font-semibold tabular-nums ${overview.activeSuspensions > 0 ? "text-rose-600" : "text-slate-700"}`}
                >
                  {overview.activeSuspensions}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function AuditPageContent() {
  const isMobile = useIsMobile();
  const {
    data: overview,
    isFetching: overviewFetching,
    isError,
    refetch,
  } = useAuditOverview();

  return (
    <Page className="flex h-full flex-col">
      <AppPageHeader
        currentPageLabel="Audit"
        subtitle="Traçabilité des runs et snapshot DB"
        backendLabel={isError ? "indisponible" : "OK"}
        onRefresh={() => void refetch()}
        isRefreshing={overviewFetching}
      />

      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <section className="rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Vue d&apos;ensemble
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                Snapshot DB
              </h2>
            </div>
            {overview && (
              <Badge tone="neutral">
                {new Date(overview.generatedAt).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "UTC",
                })}{" "}
                UTC
              </Badge>
            )}
          </div>
          <div className="mt-4">
            {overview ? (
              <AuditOverviewSection overview={overview} isMobile={isMobile} />
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-slate-400">
                Chargement…
              </div>
            )}
          </div>
        </section>
      </PageContent>
    </Page>
  );
}

export default function AuditPage() {
  return (
    <Suspense>
      <AuditPageContent />
    </Suspense>
  );
}
