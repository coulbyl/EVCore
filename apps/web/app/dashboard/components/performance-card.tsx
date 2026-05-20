"use client";

import { format } from "date-fns";
import { formatCompactValue } from "@/helpers/number";
import type { PnlSummary } from "@/domains/dashboard/types/dashboard";
import { useTranslations } from "next-intl";
import { DatePicker } from "@evcore/ui";

const slotCls =
  "min-w-0 rounded-[1.15rem] border px-2.5 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3";
const labelCls =
  "text-[0.56rem] tracking-[0.16em] sm:text-[0.68rem] sm:tracking-[0.2em] font-semibold uppercase text-muted-foreground";
const valueCls =
  "mt-1 text-[0.95rem] leading-none sm:text-[1.45rem] lg:text-[1.6rem] font-semibold tabular-nums tracking-tight";
const subCls = "mt-1 text-[0.63rem] sm:mt-0.5 sm:text-xs text-muted-foreground";

export function PerformanceCard({
  pnl,
  pnlDate,
  onDateChange,
  onResetDate,
}: {
  pnl: PnlSummary;
  pnlDate?: string;
  onDateChange: (value?: string) => void;
  onResetDate: () => void;
}) {
  const t = useTranslations("performance");
  const lostBets = Math.max(0, pnl.settledBets - pnl.wonBets);
  const roiPct = Number.parseFloat(pnl.roi.replace(",", "."));
  const netUnits = Number.parseFloat(pnl.netUnits.replace(",", "."));
  const winBarPct =
    pnl.settledBets > 0 ? Math.round((pnl.wonBets / pnl.settledBets) * 100) : 0;
  const compactSettledBets = formatCompactValue(pnl.settledBets);

  const roiTone =
    Number.isFinite(roiPct) && roiPct > 0
      ? { card: "border-success/30 bg-success/10", value: "text-success" }
      : Number.isFinite(roiPct) && roiPct < 0
        ? { card: "border-danger/30 bg-danger/10", value: "text-danger" }
        : { card: "border-border bg-panel", value: "text-foreground" };

  const netTone =
    Number.isFinite(netUnits) && netUnits > 0
      ? { card: "border-success/30 bg-success/10", value: "text-success" }
      : Number.isFinite(netUnits) && netUnits < 0
        ? { card: "border-danger/30 bg-danger/10", value: "text-danger" }
        : { card: "border-border bg-panel", value: "text-foreground" };

  return (
    <section className="ev-shell-shadow rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("headline")}
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
            {t("title")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {pnl.settledBets === 0 && (
            <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
              {t("pendingResults")}
            </span>
          )}
          <DatePicker
            value={pnlDate ? new Date(pnlDate + "T12:00:00") : undefined}
            onChange={(date) =>
              onDateChange(date ? format(date, "yyyy-MM-dd") : undefined)
            }
            placeholder={t("filterByDate")}
            className="h-9 text-xs"
          />
          {pnlDate && (
            <button
              type="button"
              onClick={onResetDate}
              className="h-9 rounded-xl border border-border bg-panel px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("resetDate")}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
        {/* ROI */}
        <div className={`${slotCls} ${roiTone.card}`}>
          <p className={labelCls}>{t("roi")}</p>
          <p className={`${valueCls} ${roiTone.value}`}>{pnl.roi}</p>
          <p className={subCls}>
            <span className="sm:hidden">{t("capitalShort")}</span>
            <span className="hidden sm:inline">{t("onStakedCapital")}</span>
          </p>
        </div>

        {/* Net gain */}
        <div className={`${slotCls} ${netTone.card}`}>
          <p className={labelCls}>{t("netGain")}</p>
          <p className={`${valueCls} ${netTone.value}`}>{pnl.netUnits}</p>
          <p className={subCls}>
            <span className="sm:hidden">{t("stakeShort")}</span>
            <span className="hidden sm:inline">{t("stakeUnits")}</span>
          </p>
        </div>

        {/* Win rate */}
        <div className={`${slotCls} border-border bg-panel`}>
          <p className={labelCls}>{t("winRate")}</p>
          <p className={`${valueCls} text-foreground`}>{pnl.winRate}</p>
          <p className={subCls}>
            {compactSettledBets}{" "}
            <span className="sm:hidden">{t("settledShort")}</span>
            <span className="hidden sm:inline">{t("settledBets")}</span>
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-success">
            {pnl.wonBets} {t("won")}
          </span>
          <span className="text-xs font-semibold text-danger">
            {lostBets} {t("lost")}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-success transition-all duration-500"
            style={{ width: `${winBarPct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
