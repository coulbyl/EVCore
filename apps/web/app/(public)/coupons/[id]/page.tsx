"use client";

import { use } from "react";
import { Page, PageContent } from "@evcore/ui";
import { AppPageHeader } from "@/components/app-page-header";
import {
  CouponDetail,
  CouponDetailEmpty,
  CouponDetailHeader,
} from "@/components/coupon-detail";
import { useCouponById } from "@/hooks/use-coupon-by-id";
import type { CouponSnapshot } from "@/types/dashboard";

// ---------------------------------------------------------------------------
// Diagnostic helpers
// ---------------------------------------------------------------------------

function DiagStat({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-slate-700">{value ?? "—"}</p>
    </div>
  );
}

function PicksTable({
  picks,
  showStatus,
}: {
  picks: NonNullable<CouponSnapshot["selections"][number]["evaluatedPicks"]>;
  showStatus: boolean;
}) {
  if (picks.length === 0) return <p className="text-xs text-slate-400">Aucun pick.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[0.62rem] font-semibold uppercase tracking-widest text-slate-400">
            <th className="pb-1.5 pr-3">Marché / Pick</th>
            <th className="pb-1.5 pr-3">Prob.</th>
            <th className="pb-1.5 pr-3">Cote</th>
            <th className="pb-1.5 pr-3">EV</th>
            <th className="pb-1.5 pr-3">Qualité</th>
            {showStatus && <th className="pb-1.5">Statut</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {picks.map((p, i) => {
            const pickLabel = p.comboMarket
              ? `${p.market} ${p.pick} + ${p.comboMarket} ${p.comboPick ?? ""}`
              : `${p.market} ${p.pick}`;
            const isViable = !showStatus || ("status" in p && p.status === "viable");
            return (
              <tr key={i} className="align-middle">
                <td className="py-1.5 pr-3 font-medium text-slate-700">{pickLabel}</td>
                <td className="py-1.5 pr-3 tabular-nums text-slate-600">{p.probability}</td>
                <td className="py-1.5 pr-3 tabular-nums text-slate-600">{p.odds}</td>
                <td
                  className={`py-1.5 pr-3 tabular-nums font-semibold ${
                    p.ev.startsWith("+") ? "text-emerald-600" : "text-rose-500"
                  }`}
                >
                  {p.ev}
                </td>
                <td className="py-1.5 pr-3 tabular-nums text-slate-600">{p.qualityScore}</td>
                {showStatus && (
                  <td className="py-1.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${
                        isViable
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-600"
                      }`}
                    >
                      {"status" in p ? p.status : ""}
                    </span>
                    {"rejectionReason" in p && p.rejectionReason ? (
                      <span className="ml-1.5 text-slate-400">{p.rejectionReason}</span>
                    ) : null}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SelectionDiagnostics({
  selection,
  index,
}: {
  selection: CouponSnapshot["selections"][number];
  index: number;
}) {
  const hasDiag =
    selection.probEstimated !== undefined ||
    selection.lambdaHome !== undefined ||
    selection.candidatePicks !== undefined ||
    selection.evaluatedPicks !== undefined;

  if (!hasDiag) return null;

  return (
    <div className="border-t border-dashed border-slate-200 px-4 pb-4 pt-3">
      <p className="mb-3 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Diagnostics — Leg {index + 1}
      </p>

      {/* Model inputs */}
      <div className="mb-4 grid grid-cols-4 gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
        <DiagStat label="Prob. estimée" value={selection.probEstimated} />
        <DiagStat label="λ Home" value={selection.lambdaHome} />
        <DiagStat label="λ Away" value={selection.lambdaAway} />
        <DiagStat label="E[Buts]" value={selection.expectedTotalGoals} />
      </div>

      {/* Candidate picks */}
      {selection.candidatePicks && selection.candidatePicks.length > 0 && (
        <div className="mb-3">
          <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Picks candidats ({selection.candidatePicks.length})
          </p>
          <PicksTable
            picks={selection.candidatePicks as NonNullable<CouponSnapshot["selections"][number]["evaluatedPicks"]>}
            showStatus={false}
          />
        </div>
      )}

      {/* Evaluated picks */}
      {selection.evaluatedPicks && selection.evaluatedPicks.length > 0 && (
        <div>
          <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Picks évalués ({selection.evaluatedPicks.length})
          </p>
          <PicksTable picks={selection.evaluatedPicks} showStatus={true} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CouponDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: coupon, isFetching, isError, refetch } = useCouponById(id);

  return (
    <Page className="flex h-full flex-col">
      <AppPageHeader
        currentPageLabel="Coupons"
        subtitle={coupon ? `Détail — ${coupon.code}` : "Détail coupon"}
        backendLabel={isError ? "indisponible" : "OK"}
        onRefresh={() => void refetch()}
        isRefreshing={isFetching}
      />
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-5 ev-shell-shadow">
        <div className="max-w-2xl">
          {isFetching && !coupon ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-slate-400">
              Chargement…
            </div>
          ) : isError || coupon === null ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-slate-400">
              Coupon introuvable.
            </div>
          ) : coupon ? (
            <>
              {/* Summary card — same as aside */}
              <CouponDetail coupon={coupon} onSettled={() => void refetch()} />

              {/* Enriched diagnostics per leg */}
              <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white">
                <CouponDetailHeader
                  code={coupon.code}
                  legs={coupon.legs}
                  status={coupon.status}
                  selections={coupon.selections}
                />
                <div className="divide-y divide-border">
                  {coupon.selections.map((selection, index) => (
                    <SelectionDiagnostics
                      key={selection.id}
                      selection={selection}
                      index={index}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <CouponDetailEmpty />
          )}
        </div>
      </PageContent>
    </Page>
  );
}
