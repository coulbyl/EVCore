"use client";

import { use, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCouponById } from "@/hooks/use-coupon-by-id";
import {
  CouponDetailEmpty,
  CouponDetailHeader,
  CouponDetailStats,
  CouponDetailLeg,
} from "@/components/coupon-detail";
import { combinedOdds, formatPickForDisplay, selectionStatusLabel, selectionStatusBadgeClass } from "@/helpers/coupon";
import type { CouponSnapshot } from "@/types/dashboard";
import { locales, getLocale, type Translations } from "./locales";

// ---------------------------------------------------------------------------
// Diagnostic helpers
// ---------------------------------------------------------------------------

function DiagStat({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="font-mono text-sm font-semibold text-slate-700">{value ?? "—"}</p>
    </div>
  );
}

function PicksTable({
  picks,
  showStatus,
  t,
}: {
  picks: NonNullable<CouponSnapshot["selections"][number]["evaluatedPicks"]>;
  showStatus: boolean;
  t: Translations;
}) {
  if (picks.length === 0) return <p className="text-xs text-slate-400">{t.noPicks}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[0.6rem] font-semibold uppercase tracking-widest text-slate-400">
            <th className="pb-2 pr-3">{t.tableHeaders.marketPick}</th>
            <th className="pb-2 pr-3">{t.tableHeaders.prob}</th>
            <th className="pb-2 pr-3">{t.tableHeaders.odds}</th>
            <th className="pb-2 pr-3">{t.tableHeaders.ev}</th>
            <th className="pb-2 pr-3">{t.tableHeaders.quality}</th>
            {showStatus && <th className="pb-2">{t.tableHeaders.status}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {picks.map((p, i) => {
            const pickLabel = p.comboMarket
              ? `${p.market} ${p.pick} + ${p.comboMarket} ${p.comboPick ?? ""}`
              : formatPickForDisplay(p.pick, p.market);
            const isViable = !showStatus || ("status" in p && p.status === "viable");
            return (
              <tr key={i} className="align-middle">
                <td className="py-2 pr-3 font-medium text-slate-700">{pickLabel}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{p.probability}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{p.odds}</td>
                <td className={`py-2 pr-3 tabular-nums font-semibold ${p.ev.startsWith("+") ? "text-emerald-600" : "text-rose-500"}`}>
                  {p.ev}
                </td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{p.qualityScore}</td>
                {showStatus && (
                  <td className="py-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${
                        isViable
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-600"
                      }`}
                    >
                      {"status" in p ? (t.pickStatuses[p.status as "viable" | "rejected"] ?? p.status) : ""}
                    </span>
                    {"rejectionReason" in p && p.rejectionReason ? (
                      <span className="ml-1.5 text-slate-400">
                        {t.rejectionReasons[p.rejectionReason] ?? p.rejectionReason}
                      </span>
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

function SelectionDiagnosticsCard({
  selection,
  index,
  t,
  locale,
}: {
  selection: CouponSnapshot["selections"][number];
  index: number;
  t: Translations;
  locale: "fr" | "en";
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <p className="min-w-0 truncate text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{t.leg} {index + 1}</span>
          {" — "}{selection.fixture}
          {" · "}<span className="font-medium text-slate-700">{formatPickForDisplay(selection.pick, selection.market)}</span>
          {selection.score ? <span className="ml-2 font-bold text-slate-600">{selection.score}</span> : null}
        </p>
        <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${selectionStatusBadgeClass(selection.status)}`}>
          {selectionStatusLabel(selection.status, selection.fixtureStatus, locale)}
        </span>
      </div>

      <div className="space-y-5 px-4 py-4">
        <div>
          <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {t.modelInputs}
          </p>
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 sm:grid-cols-4">
            <DiagStat label={t.probEstimated} value={selection.probEstimated} />
            <DiagStat label={t.lambdaHome} value={selection.lambdaHome} />
            <DiagStat label={t.lambdaAway} value={selection.lambdaAway} />
            <DiagStat label={t.expectedGoals} value={selection.expectedTotalGoals} />
          </div>
        </div>

        {selection.candidatePicks && selection.candidatePicks.length > 0 && (
          <div>
            <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {t.candidatePicks(selection.candidatePicks.length)}
            </p>
            <PicksTable
              picks={selection.candidatePicks as NonNullable<CouponSnapshot["selections"][number]["evaluatedPicks"]>}
              showStatus={false}
              t={t}
            />
          </div>
        )}

        {selection.evaluatedPicks && selection.evaluatedPicks.length > 0 && (
          <div>
            <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {t.evaluatedPicks(selection.evaluatedPicks.length)}
            </p>
            <PicksTable picks={selection.evaluatedPicks} showStatus={true} t={t} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive body
// ---------------------------------------------------------------------------

function CouponPageBody({
  coupon,
  onSettled,
  t,
  locale,
}: {
  coupon: NonNullable<ReturnType<typeof useCouponById>["data"]>;
  onSettled: () => void;
  t: Translations;
  locale: "fr" | "en";
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const isCombined = coupon.selections.length > 1;
  const odds = isCombined
    ? combinedOdds(coupon.selections.map((s) => s.odds))
    : (coupon.selections[0]?.odds ?? "—");
  const activeLeg = coupon.selections[selectedIndex];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {t.summary}
        </p>
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <CouponDetailHeader
            code={coupon.code}
            legs={coupon.legs}
            status={coupon.status}
            selections={coupon.selections}
            locale={locale}
          />
          <CouponDetailStats
            selectionCount={coupon.selections.length}
            isCombined={isCombined}
            odds={odds}
            ev={coupon.ev}
            locale={locale}
          />
          <div className="divide-y divide-border">
            {coupon.selections.map((selection, index) => (
              <button
                key={selection.id}
                onClick={() => setSelectedIndex(index)}
                className={`w-full cursor-pointer text-left transition-colors ${
                  index === selectedIndex
                    ? "border-l-2 border-l-accent bg-accent/5"
                    : "border-l-2 border-l-transparent hover:bg-slate-50"
                }`}
              >
                <CouponDetailLeg selection={selection} index={index} onSettled={onSettled} locale={locale} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {t.engineDiagnostics} — {t.leg} {selectedIndex + 1}
        </p>
        {activeLeg ? (
          <SelectionDiagnosticsCard selection={activeLeg} index={selectedIndex} t={t} locale={locale} />
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Language switcher
// ---------------------------------------------------------------------------

function LangSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = getLocale(searchParams.get("lang"));

  function switchTo(lang: "fr" | "en") {
    const params = new URLSearchParams(searchParams.toString());
    if (lang === "fr") {
      params.delete("lang");
    } else {
      params.set("lang", lang);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
      {(["fr", "en"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => switchTo(lang)}
          className={`rounded-md px-2.5 py-1 uppercase transition-colors ${
            current === lang
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {lang}
        </button>
      ))}
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
  const searchParams = useSearchParams();
  const t = locales[getLocale(searchParams.get("lang"))];
  const { data: coupon, isFetching, isError, refetch } = useCouponById(id);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-500">
              EVCore
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-500">{t.coupon}</span>
            {coupon && (
              <>
                <span className="text-slate-300">/</span>
                <span className="font-mono text-sm font-semibold text-slate-700">{coupon.code}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <LangSwitcher />
            <button
              onClick={() => void refetch()}
              disabled={isFetching}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {isFetching ? t.loading : t.refresh}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {isFetching && !coupon ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-400">
            {t.loading}
          </div>
        ) : isError || coupon === null ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-400">
            {t.notFound}
          </div>
        ) : coupon ? (
          <CouponPageBody coupon={coupon} onSettled={() => void refetch()} t={t} locale={getLocale(searchParams.get("lang"))} />
        ) : (
          <CouponDetailEmpty />
        )}
      </main>
    </div>
  );
}
