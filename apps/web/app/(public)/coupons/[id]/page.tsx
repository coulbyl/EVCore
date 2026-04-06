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
import {
  combinedOdds,
  selectionStatusLabel,
  selectionStatusBadgeClass,
} from "@/helpers/coupon";
import type { CouponSnapshot } from "@/types/dashboard";
import {
  locales,
  getLocale,
  formatPickLabel,
  formatSelectionPickLabel,
  type Translations,
} from "./locales";

// ---------------------------------------------------------------------------
// Diagnostic helpers
// ---------------------------------------------------------------------------

function DiagStat({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="font-mono text-sm font-semibold text-slate-700">
        {value ?? "—"}
      </p>
    </div>
  );
}

function UnifiedPicksTable({
  candidatePicks,
  evaluatedPicks,
  t,
}: {
  candidatePicks?: NonNullable<
    CouponSnapshot["selections"][number]["candidatePicks"]
  >;
  evaluatedPicks?: NonNullable<
    CouponSnapshot["selections"][number]["evaluatedPicks"]
  >;
  t: Translations;
}) {
  const hasCandidates = candidatePicks && candidatePicks.length > 0;
  const hasEvaluated = evaluatedPicks && evaluatedPicks.length > 0;
  if (!hasCandidates && !hasEvaluated)
    return <p className="text-xs text-slate-400">{t.noPicks}</p>;

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
            <th className="pb-2 pr-3">{t.tableHeaders.status}</th>
            <th className="pb-2">{t.tableHeaders.reason}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {hasCandidates && (
            <>
              <tr>
                <td
                  colSpan={7}
                  className="pb-1 pt-3 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-400"
                >
                  {t.candidatePicks(candidatePicks.length)}
                </td>
              </tr>
              {candidatePicks.map((p, i) => {
                const pickLabel = p.comboMarket
                  ? `${formatPickLabel(p.market, p.pick, t)} + ${formatPickLabel(p.comboMarket, p.comboPick ?? "", t)}`
                  : formatPickLabel(p.market, p.pick, t);
                return (
                  <tr key={`c-${i}`} className="align-middle">
                    <td className="py-2 pr-3 font-medium text-slate-700">
                      {pickLabel}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">
                      {p.probability}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">
                      {p.odds}
                    </td>
                    <td
                      className={`py-2 pr-3 tabular-nums font-semibold ${p.ev.startsWith("+") ? "text-emerald-600" : "text-rose-500"}`}
                    >
                      {p.ev}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">
                      {p.qualityScore}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">
                      --
                    </td>
                    <td className="py-2 tabular-nums text-slate-600">--</td>
                  </tr>
                );
              })}
            </>
          )}
          {hasEvaluated && (
            <>
              <tr>
                <td
                  colSpan={7}
                  className="pb-1 pt-3 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-400"
                >
                  {t.evaluatedPicks(evaluatedPicks.length)}
                </td>
              </tr>
              {evaluatedPicks.map((p, i) => {
                const pickLabel = p.comboMarket
                  ? `${formatPickLabel(p.market, p.pick, t)} + ${formatPickLabel(p.comboMarket, p.comboPick ?? "", t)}`
                  : formatPickLabel(p.market, p.pick, t);
                const isViable = p.status === "viable";
                return (
                  <tr key={`e-${i}`} className="align-middle">
                    <td className="py-2 pr-3 font-medium text-slate-700">
                      {pickLabel}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">
                      {p.probability}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">
                      {p.odds}
                    </td>
                    <td
                      className={`py-2 pr-3 tabular-nums font-semibold ${p.ev.startsWith("+") ? "text-emerald-600" : "text-rose-500"}`}
                    >
                      {p.ev}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">
                      {p.qualityScore}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${isViable ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-600"}`}
                      >
                        {t.pickStatuses[p.status as "viable" | "rejected"] ??
                          p.status}
                      </span>
                    </td>
                    <td className="py-2 text-[0.65rem] text-slate-400">
                      {p.rejectionReason
                        ? (t.rejectionReasons[p.rejectionReason] ??
                          p.rejectionReason)
                        : "--"}
                    </td>
                  </tr>
                );
              })}
            </>
          )}
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
          <span className="font-semibold text-slate-700">
            {t.leg} {index + 1}
          </span>
          {" — "}
          {selection.fixture}
          {" · "}
          <span className="font-medium text-slate-700">
            {formatSelectionPickLabel(selection.pick, selection.market, t)}
          </span>
          {selection.score ? (
            <span className="ml-2 font-bold text-slate-600">
              {selection.score}
            </span>
          ) : null}
          {selection.htScore ? (
            <span className="ml-1 text-[0.65rem] font-medium text-slate-400">
              ({t.ht} {selection.htScore})
            </span>
          ) : null}
        </p>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${selectionStatusBadgeClass(selection.status)}`}
        >
          {selectionStatusLabel(
            selection.status,
            selection.fixtureStatus,
            locale,
          )}
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
            <DiagStat
              label={t.expectedGoals}
              value={selection.expectedTotalGoals}
            />
          </div>
        </div>

        {selection.candidatePicks?.length ||
        selection.evaluatedPicks?.length ? (
          <UnifiedPicksTable
            candidatePicks={selection.candidatePicks}
            evaluatedPicks={selection.evaluatedPicks}
            t={t}
          />
        ) : null}
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
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
      {/* Left — scrolls independently */}
      <div className="flex min-h-0 flex-col overflow-hidden">
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {t.summary}
          </p>
          <CopyButton
            getText={() => formatCouponText(coupon, t, locale)}
            label={t.copyCoupon}
            copiedLabel={t.copied}
            className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-medium text-slate-500 hover:bg-slate-50"
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-white">
          <div className="shrink-0">
            <CouponDetailHeader
              code={coupon.code}
              legs={coupon.legs}
              status={coupon.status}
              tier={coupon.tier}
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
          </div>
          <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {coupon.selections.map((selection, index) => (
              <div
                key={selection.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedIndex(index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    setSelectedIndex(index);
                }}
                className={`w-full cursor-pointer text-left transition-colors ${
                  index === selectedIndex
                    ? "border-l-2 border-l-accent bg-accent/5"
                    : "border-l-2 border-l-transparent hover:bg-slate-50"
                }`}
              >
                <CouponDetailLeg
                  selection={selection}
                  index={index}
                  onSettled={onSettled}
                  locale={locale}
                  pickLabel={formatSelectionPickLabel(
                    selection.pick,
                    selection.market,
                    t,
                  )}
                  marketLabel={
                    t.marketLabels[selection.market] ?? selection.market
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — scrolls independently */}
      <div className="flex min-h-0 flex-col overflow-hidden">
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {t.engineDiagnostics} — {t.leg} {selectedIndex + 1}
          </p>
          {activeLeg && (
            <CopyButton
              getText={() =>
                formatDiagnosticsText(activeLeg, selectedIndex, t, locale)
              }
              label={t.copyDiagnostics}
              copiedLabel={t.copied}
              className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-medium text-slate-500 hover:bg-slate-50"
            />
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeLeg ? (
            <SelectionDiagnosticsCard
              selection={activeLeg}
              index={selectedIndex}
              t={t}
              locale={locale}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy helpers
// ---------------------------------------------------------------------------

function formatLegText(
  selection: CouponSnapshot["selections"][number],
  index: number,
  t: Translations,
  locale: "fr" | "en",
): string {
  const pickLabel = formatSelectionPickLabel(
    selection.pick,
    selection.market,
    t,
  );
  const marketLabel = t.marketLabels[selection.market] ?? selection.market;
  const statusLabel = selectionStatusLabel(
    selection.status,
    selection.fixtureStatus,
    locale,
  );
  const scoreStr = selection.score
    ? ` (${selection.score}${selection.htScore ? ` · ${t.ht} ${selection.htScore}` : ""})`
    : "";
  const oddsLabel = locale === "fr" ? "Cote" : "Odds";
  return [
    `${t.leg} ${index + 1} — ${selection.fixture}`,
    `${marketLabel} · ${pickLabel}`,
    `${oddsLabel} ${selection.odds} · EV ${selection.ev}`,
    `${statusLabel}${scoreStr}`,
  ].join("\n");
}

function formatDiagnosticsText(
  selection: CouponSnapshot["selections"][number],
  index: number,
  t: Translations,
  locale: "fr" | "en",
): string {
  const pickLabel = formatSelectionPickLabel(
    selection.pick,
    selection.market,
    t,
  );
  const marketLabel = t.marketLabels[selection.market] ?? selection.market;
  const statusLabel = selectionStatusLabel(
    selection.status,
    selection.fixtureStatus,
    locale,
  );
  const scoreStr = selection.score
    ? ` · ${selection.score}${selection.htScore ? ` (${t.ht} ${selection.htScore})` : ""}`
    : "";
  const lines: string[] = [
    `EVCore — ${t.engineDiagnostics} — ${t.leg} ${index + 1}`,
    `${selection.fixture} · ${marketLabel} · ${pickLabel}`,
    `${statusLabel}${scoreStr}`,
    "",
    t.modelInputs,
    `${t.probEstimated}: ${selection.probEstimated ?? "—"}`,
    `${locale === "fr" ? "λ V1" : "λ HOME"}: ${selection.lambdaHome ?? "—"}`,
    `${locale === "fr" ? "λ V2" : "λ AWAY"}: ${selection.lambdaAway ?? "—"}`,
    `${t.expectedGoals}: ${selection.expectedTotalGoals ?? "—"}`,
  ];

  const formatPickRow = (p: {
    market: string;
    pick: string;
    comboMarket?: string;
    comboPick?: string;
    probability: string;
    odds: string;
    ev: string;
    qualityScore: string;
  }) => {
    const label = p.comboMarket
      ? `${formatPickLabel(p.market, p.pick, t)} + ${formatPickLabel(p.comboMarket, p.comboPick ?? "", t)}`
      : formatPickLabel(p.market, p.pick, t);
    return `  ${label}  ${t.tableHeaders.prob}: ${p.probability}  ${t.tableHeaders.odds}: ${p.odds}  EV: ${p.ev}  ${t.tableHeaders.quality}: ${p.qualityScore}`;
  };

  if (selection.candidatePicks?.length) {
    lines.push("", t.candidatePicks(selection.candidatePicks.length));
    for (const p of selection.candidatePicks) lines.push(formatPickRow(p));
  }

  if (selection.evaluatedPicks?.length) {
    lines.push("", t.evaluatedPicks(selection.evaluatedPicks.length));
    for (const p of selection.evaluatedPicks) {
      const statusLabel =
        t.pickStatuses[p.status as "viable" | "rejected"] ?? p.status;
      const reason = p.rejectionReason
        ? (t.rejectionReasons[p.rejectionReason] ?? p.rejectionReason)
        : "";
      lines.push(
        `${formatPickRow(p)}  ${statusLabel}${reason ? `  (${reason})` : ""}`,
      );
    }
  }

  return lines.join("\n");
}

function formatCouponText(
  coupon: NonNullable<ReturnType<typeof useCouponById>["data"]>,
  t: Translations,
  locale: "fr" | "en",
): string {
  const isCombined = coupon.selections.length > 1;
  const odds = isCombined
    ? combinedOdds(coupon.selections.map((s) => s.odds))
    : (coupon.selections[0]?.odds ?? "—");
  const modeLabel = isCombined ? t.modeCombined : t.modeSimple;
  const oddsLabel = isCombined ? t.combinedOdds : t.singleOdds;
  const header = `EVCore — ${coupon.code}\n${modeLabel} · ${oddsLabel} ${odds} · EV ${coupon.ev}`;
  const legs = coupon.selections
    .map((sel, i) => formatLegText(sel, i, t, locale))
    .join("\n\n");
  return `${header}\n\n${legs}`;
}

// ---------------------------------------------------------------------------
// CopyButton — reusable inline copy button
// ---------------------------------------------------------------------------

function CopyButton({
  getText,
  label,
  copiedLabel,
  className,
}: {
  getText: () => string;
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(getText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleCopy();
      }}
      className={
        className ??
        "cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      }
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Share button
// ---------------------------------------------------------------------------

function ShareButton({
  coupon,
  t,
}: {
  coupon: NonNullable<ReturnType<typeof useCouponById>["data"]>;
  t: Translations;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;
    const shareData = {
      title: `EVCore — ${coupon.code}`,
      text: `${coupon.selections.length > 1 ? `${coupon.selections.length}-leg combo` : "Single"} · ${coupon.ev} EV`,
      url,
    };
    if (
      typeof navigator.share === "function" &&
      navigator.canShare(shareData)
    ) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={() => void handleShare()}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
    >
      {copied ? t.copied : t.share}
    </button>
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
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
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
                <span className="font-mono text-sm font-semibold text-slate-700">
                  {coupon.code}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <LangSwitcher />
            {coupon && <ShareButton coupon={coupon} t={t} />}
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

      <main className="mx-auto min-h-0 w-full max-w-6xl flex-1 px-6 py-8">
        {isFetching && !coupon ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-400">
            {t.loading}
          </div>
        ) : isError || coupon === null ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-400">
            {t.notFound}
          </div>
        ) : coupon ? (
          <CouponPageBody
            coupon={coupon}
            onSettled={() => void refetch()}
            t={t}
            locale={getLocale(searchParams.get("lang"))}
          />
        ) : (
          <CouponDetailEmpty />
        )}
      </main>
    </div>
  );
}
