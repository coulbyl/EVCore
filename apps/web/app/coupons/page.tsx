"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Page, PageContent } from "@evcore/ui";
import { AppPageHeader } from "../../components/app-page-header";
import { SettleFixtureDialog } from "../../components/settle-fixture-dialog";
import { TableCard } from "../../components/table-card";
import { useCouponsByPeriod } from "../../hooks/use-coupons-by-period";

function currentWeekInputRange(now = new Date()): { from: string; to: string } {
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const from = new Date(now);
  from.setUTCDate(now.getUTCDate() + diffToMonday);
  from.setUTCHours(0, 0, 0, 0);

  const to = new Date(from);
  to.setUTCDate(from.getUTCDate() + 6);
  to.setUTCHours(0, 0, 0, 0);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function couponStatusLabel(status: "PENDING" | "WON" | "LOST"): string {
  if (status === "WON") return "GAGNÉ";
  if (status === "LOST") return "PERDU";
  return "EN COURS";
}

function selectionStatusLabel(status: "PENDING" | "WON" | "LOST" | "VOID") {
  if (status === "WON") return "GAGNÉ";
  if (status === "LOST") return "PERDU";
  if (status === "VOID") return "VOID";
  return "EN COURS";
}

function couponStatusBadgeClass(status: "PENDING" | "WON" | "LOST") {
  if (status === "WON")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "LOST") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function selectionStatusBadgeClass(
  status: "PENDING" | "WON" | "LOST" | "VOID",
) {
  if (status === "WON")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "LOST") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "VOID") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function selectionCardClass(status: "PENDING" | "WON" | "LOST" | "VOID") {
  if (status === "WON") return "border-emerald-200 bg-emerald-50/30";
  if (status === "LOST") return "border-rose-200 bg-rose-50/30";
  if (status === "VOID") return "border-slate-200 bg-slate-50";
  return "border-border bg-white";
}

function combinedOdds(odds: string[]): string {
  if (odds.length === 0) return "—";
  const product = odds.reduce((acc, odd) => acc * Number.parseFloat(odd), 1);
  return Number.isFinite(product) ? product.toFixed(2) : "—";
}

function couponModeLabel(legs: number): "Simple" | "Combiné" {
  return legs > 1 ? "Combiné" : "Simple";
}

function formatPickForDisplay(pick: string): string {
  return pick
    .replace("OVER_UNDER UNDER", "UNDER 2.5")
    .replace("OVER_UNDER OVER", "OVER 2.5")
    .replace("OVER_UNDER_25 UNDER", "UNDER 2.5")
    .replace("OVER_UNDER_25 OVER", "OVER 2.5");
}

type CouponFilterStatus = "" | "PENDING" | "WON" | "LOST";

export default function CouponsPage() {
  const defaultRange = useMemo(() => currentWeekInputRange(), []);
  const defaultFilters = useMemo(
    () => ({ ...defaultRange, query: "", status: "" as CouponFilterStatus }),
    [defaultRange],
  );
  const [formFilters, setFormFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);

  const { data, isFetching, isError, refetch } = useCouponsByPeriod({
    from: appliedFilters.from,
    to: appliedFilters.to,
    query: appliedFilters.query,
    status: appliedFilters.status || undefined,
  });
  const coupons = data?.coupons ?? [];
  const selectedCoupon =
    coupons.find((coupon) => coupon.id === selectedCouponId) ?? null;
  const isCombined = (selectedCoupon?.selections.length ?? 0) > 1;
  const selectedCombinedOdds = selectedCoupon
    ? combinedOdds(selectedCoupon.selections.map((s) => s.odds))
    : "—";

  function applyPeriodFilter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAppliedFilters(formFilters);
    setSelectedCouponId(null);
  }

  return (
    <Page className="flex h-full flex-col">
      <AppPageHeader
        currentPageLabel="Coupons"
        subtitle="Gestion des coupons et suivi des résultats"
        backendLabel={isError ? "indisponible" : "OK"}
        onRefresh={() => void refetch()}
        isRefreshing={isFetching}
      />

      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-5 ev-shell-shadow">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
          <div className="space-y-5">
            <section className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Filtres
              </p>
              <form
                className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr_1fr_auto]"
                onSubmit={applyPeriodFilter}
              >
                <label className="rounded-lg border border-border bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                  <span className="mb-0.5 block text-[0.62rem] uppercase tracking-[0.12em] text-slate-400">
                    Du
                  </span>
                  <input
                    type="date"
                    value={formFilters.from}
                    onChange={(e) =>
                      setFormFilters((prev) => ({
                        ...prev,
                        from: e.target.value,
                      }))
                    }
                    className="w-full bg-transparent outline-none"
                  />
                </label>
                <label className="rounded-lg border border-border bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                  <span className="mb-0.5 block text-[0.62rem] uppercase tracking-[0.12em] text-slate-400">
                    Au
                  </span>
                  <input
                    type="date"
                    value={formFilters.to}
                    onChange={(e) =>
                      setFormFilters((prev) => ({
                        ...prev,
                        to: e.target.value,
                      }))
                    }
                    className="w-full bg-transparent outline-none"
                  />
                </label>
                <label className="rounded-lg border border-border bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                  <span className="mb-0.5 block text-[0.62rem] uppercase tracking-[0.12em] text-slate-400">
                    Recherche
                  </span>
                  <input
                    type="text"
                    value={formFilters.query}
                    onChange={(e) =>
                      setFormFilters((prev) => ({
                        ...prev,
                        query: e.target.value,
                      }))
                    }
                    placeholder="Equipe, code, pick..."
                    className="w-full bg-transparent outline-none placeholder:text-slate-400"
                  />
                </label>
                <label className="rounded-lg border border-border bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                  <span className="mb-0.5 block text-[0.62rem] uppercase tracking-[0.12em] text-slate-400">
                    Statut
                  </span>
                  <select
                    value={formFilters.status}
                    onChange={(e) =>
                      setFormFilters((prev) => ({
                        ...prev,
                        status: e.target.value as CouponFilterStatus,
                      }))
                    }
                    className="w-full bg-transparent outline-none"
                  >
                    <option value="">Tous</option>
                    <option value="PENDING">En cours</option>
                    <option value="WON">Gagné</option>
                    <option value="LOST">Perdu</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-50"
                >
                  Appliquer
                </button>
              </form>
              <p className="mt-2 text-xs text-slate-400">
                Période active (backend):{" "}
                {data?.period.from ?? appliedFilters.from} →{" "}
                {data?.period.to ?? appliedFilters.to}
                {appliedFilters.query.trim() ? (
                  <span> • recherche: “{appliedFilters.query.trim()}”</span>
                ) : null}
                {appliedFilters.status ? (
                  <span>
                    {" "}
                    • statut:{" "}
                    {appliedFilters.status === "PENDING"
                      ? "En cours"
                      : appliedFilters.status === "WON"
                        ? "Gagné"
                        : "Perdu"}
                  </span>
                ) : null}
              </p>
            </section>

            <TableCard
              title="Liste des coupons"
              subtitle="Coupons de la période sélectionnée."
              action={
                <span className="rounded-full border border-border px-3 py-1 text-xs text-slate-500">
                  {coupons.length} coupon{coupons.length > 1 ? "s" : ""}
                </span>
              }
            >
              {coupons.length === 0 ? (
                <div className="bg-white px-4 py-8 text-center text-sm text-slate-400">
                  Aucun coupon sur cette période.
                </div>
              ) : (
                <div className="max-h-105 overflow-y-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-slate-500">
                      <tr>
                        <th className="px-5 py-3.5 font-medium">Code</th>
                        <th className="px-5 py-3.5 font-medium">Legs</th>
                        <th className="px-5 py-3.5 font-medium">Statut</th>
                        <th className="px-5 py-3.5 font-medium">EV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-white">
                      {coupons.map((coupon) => (
                        <tr
                          key={coupon.id}
                          onClick={() => setSelectedCouponId(coupon.id)}
                          className={`cursor-pointer transition-colors ${
                            selectedCouponId === coupon.id
                              ? "bg-accent/8 ring-1 ring-inset ring-accent/20"
                              : "hover:bg-[#f5f7fb]"
                          }`}
                        >
                          <td className="px-5 py-4.5 font-mono text-slate-600">
                            {coupon.code}
                          </td>
                          <td className="px-5 py-4.5 text-slate-500">
                            {coupon.legs}
                          </td>
                          <td className="px-5 py-4.5 text-slate-500">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${couponStatusBadgeClass(coupon.status)}`}
                            >
                              {couponStatusLabel(coupon.status)}
                            </span>
                          </td>
                          <td className="px-5 py-4.5 font-semibold text-slate-700">
                            {coupon.ev}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TableCard>

            <section className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Historique
              </p>
              <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-slate-400">
                Zone réservée aux métriques d&apos;historique des coupons.
              </div>
            </section>
          </div>

          <aside className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow xl:sticky xl:top-0 xl:self-start">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Détail coupon
            </p>
            {!selectedCoupon ? (
              <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-slate-400">
                Sélectionnez un coupon pour afficher le détail.
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white">
                <div className="border-b border-border bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs text-slate-500">
                      {selectedCoupon.code}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full border border-slate-900 bg-slate-900 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.06em] text-white">
                        {couponModeLabel(selectedCoupon.legs)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${couponStatusBadgeClass(selectedCoupon.status)}`}
                      >
                        {couponStatusLabel(selectedCoupon.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 border-b border-border bg-slate-50 px-3 py-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Sélections</p>
                    <p className="font-semibold text-slate-700">
                      {selectedCoupon.selections.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">
                      {isCombined ? "Cote combinée" : "Cote"}
                    </p>
                    <p className="font-semibold text-slate-700">
                      {isCombined
                        ? selectedCombinedOdds
                        : (selectedCoupon.selections[0]?.odds ?? "—")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">EV coupon</p>
                    <p className="font-semibold text-slate-700">
                      {selectedCoupon.ev}
                    </p>
                  </div>
                </div>

                <div className="max-h-140 divide-y divide-border overflow-y-auto">
                  {selectedCoupon.selections.map((selection, index) => (
                    <div key={selection.id} className="px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Leg {index + 1}
                        </p>
                        <div className="flex items-center gap-2">
                          {selection.status === "PENDING" &&
                          selection.fixtureId ? (
                            <SettleFixtureDialog
                              fixtureId={selection.fixtureId}
                              fixtureName={selection.fixture}
                              onSettled={() => void refetch()}
                              triggerSize="xs"
                            />
                          ) : null}
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${selectionStatusBadgeClass(selection.status)}`}
                          >
                            {selectionStatusLabel(selection.status)}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`mt-2 rounded-xl border px-3 py-2 ${selectionCardClass(selection.status)}`}
                      >
                        <p className="text-sm font-semibold text-slate-800">
                          {selection.fixture}
                        </p>
                        <p className="mt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          {selection.scheduledAt} • {selection.market}
                        </p>
                        <div className="mt-2 flex items-start justify-between gap-3">
                          <p className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            {formatPickForDisplay(selection.pick)}
                          </p>
                          <div className="text-right">
                            <p
                              className={`text-base font-bold tabular-nums ${
                                selection.status === "LOST"
                                  ? "text-rose-500 line-through"
                                  : selection.status === "WON"
                                    ? "text-emerald-600"
                                    : "text-slate-700"
                              }`}
                            >
                              {selection.odds}
                            </p>
                            <p className="text-[0.7rem] font-semibold text-slate-500">
                              EV {selection.ev}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </PageContent>
    </Page>
  );
}
