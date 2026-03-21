"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Page, PageContent } from "@evcore/ui";
import { AppPageHeader } from "@/components/app-page-header";
import { TableCard } from "@/components/table-card";
import { CouponDetail, CouponDetailEmpty } from "@/components/coupon-detail";
import { couponStatusBadgeClass, couponStatusLabel } from "@/helpers/coupon";
import { useCouponsByPeriod } from "@/hooks/use-coupons-by-period";

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

type CouponFilterStatus = "" | "PENDING" | "WON" | "LOST";

function CouponsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultRange = useMemo(() => currentWeekInputRange(), []);

  const activeFilters = useMemo(() => ({
    from: searchParams.get("from") ?? defaultRange.from,
    to: searchParams.get("to") ?? defaultRange.to,
    query: searchParams.get("query") ?? "",
    status: (searchParams.get("status") ?? "") as CouponFilterStatus,
  }), [searchParams, defaultRange]);

  const [formFilters, setFormFilters] = useState(activeFilters);
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);

  const { data, isFetching, isError, refetch } = useCouponsByPeriod({
    from: activeFilters.from,
    to: activeFilters.to,
    query: activeFilters.query,
    status: activeFilters.status || undefined,
  });
  const coupons = data?.coupons ?? [];
  const selectedCoupon =
    coupons.find((coupon) => coupon.id === selectedCouponId) ?? null;

  function applyPeriodFilter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("from", formFilters.from);
    params.set("to", formFilters.to);
    if (formFilters.query.trim()) params.set("query", formFilters.query);
    if (formFilters.status) params.set("status", formFilters.status);
    setSelectedCouponId(null);
    router.replace(`/coupons?${params.toString()}`);
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
                {data?.period.from ?? activeFilters.from} →{" "}
                {data?.period.to ?? activeFilters.to}
                {activeFilters.query.trim() ? (
                  <span> • recherche: “{activeFilters.query.trim()}”</span>
                ) : null}
                {activeFilters.status ? (
                  <span>
                    {" "}
                    • statut:{" "}
                    {activeFilters.status === "PENDING"
                      ? "En cours"
                      : activeFilters.status === "WON"
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
                            <Link
                              href={`/coupons/${coupon.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-accent hover:underline"
                            >
                              {coupon.code}
                            </Link>
                          </td>
                          <td className="px-5 py-4.5 text-slate-500">
                            {coupon.legs}
                          </td>
                          <td className="px-5 py-4.5 text-slate-500">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${couponStatusBadgeClass(coupon.status)}`}
                            >
                              {couponStatusLabel(coupon.status, coupon.selections)}
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
          </div>

          <aside className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow xl:sticky xl:top-0">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Détail coupon
            </p>
            {!selectedCoupon ? (
              <CouponDetailEmpty />
            ) : (
              <CouponDetail
                coupon={selectedCoupon}
                onSettled={() => void refetch()}
              />
            )}
          </aside>
        </div>
      </PageContent>
    </Page>
  );
}

export default function CouponsPage() {
  return (
    <Suspense>
      <CouponsPageContent />
    </Suspense>
  );
}
