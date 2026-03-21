// Pure helpers — no React, no imports from components

type CouponStatus = "PENDING" | "WON" | "LOST";
type SelectionStatus = "PENDING" | "WON" | "LOST" | "VOID";
type Locale = "fr" | "en";

// ---------------------------------------------------------------------------
// Coupon-level
// ---------------------------------------------------------------------------

const COUPON_STATUS_LABELS: Record<
  Locale,
  {
    WON: string;
    LOST: string;
    PENDING_in_progress: string;
    PENDING_finished: string;
    PENDING_scheduled: string;
    PENDING_default: string;
  }
> = {
  fr: {
    WON: "GAGNÉ",
    LOST: "PERDU",
    PENDING_in_progress: "EN COURS",
    PENDING_finished: "EN ATTENTE",
    PENDING_scheduled: "PLANIFIÉ",
    PENDING_default: "EN COURS",
  },
  en: {
    WON: "WON",
    LOST: "LOST",
    PENDING_in_progress: "IN PROGRESS",
    PENDING_finished: "PENDING",
    PENDING_scheduled: "SCHEDULED",
    PENDING_default: "IN PROGRESS",
  },
};

export function couponStatusLabel(
  status: CouponStatus,
  selections?: Array<{ fixtureStatus: string }>,
  locale: Locale = "fr",
): string {
  const l = COUPON_STATUS_LABELS[locale];
  if (status === "WON") return l.WON;
  if (status === "LOST") return l.LOST;
  if (selections && selections.length > 0) {
    const fs = selections.map((s) => s.fixtureStatus.toLowerCase());
    if (fs.some((s) => s === "in_progress")) return l.PENDING_in_progress;
    if (fs.every((s) => s === "finished")) return l.PENDING_finished;
    return l.PENDING_scheduled;
  }
  return l.PENDING_default;
}

export function couponStatusBadgeClass(status: CouponStatus): string {
  if (status === "WON")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "LOST") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function couponStatusDotClass(status: CouponStatus): string {
  if (status === "WON") return "bg-emerald-400";
  if (status === "LOST") return "bg-rose-400";
  return "bg-amber-400";
}

export function couponStatusHeaderBadgeClass(status: CouponStatus): string {
  if (status === "WON")
    return "border-emerald-400/40 bg-emerald-400/20 text-emerald-300";
  if (status === "LOST")
    return "border-rose-400/40 bg-rose-400/20 text-rose-300";
  return "border-amber-400/40 bg-amber-400/20 text-amber-300";
}

export function couponModeLabel(legs: number, locale: Locale = "fr"): string {
  if (locale === "en") return legs > 1 ? "Combined" : "Single";
  return legs > 1 ? "Combiné" : "Simple";
}

export function combinedOdds(odds: string[]): string {
  if (odds.length === 0) return "—";
  const product = odds.reduce((acc, odd) => acc * Number.parseFloat(odd), 1);
  return Number.isFinite(product) ? product.toFixed(2) : "—";
}

// ---------------------------------------------------------------------------
// Selection-level (bet)
// ---------------------------------------------------------------------------

const SELECTION_STATUS_LABELS: Record<
  Locale,
  {
    WON: string;
    LOST: string;
    VOID: string;
    PENDING_in_progress: string;
    PENDING_finished: string;
    PENDING_scheduled: string;
    PENDING_default: string;
  }
> = {
  fr: {
    WON: "GAGNÉ",
    LOST: "PERDU",
    VOID: "VOID",
    PENDING_in_progress: "EN COURS",
    PENDING_finished: "EN ATTENTE",
    PENDING_scheduled: "PLANIFIÉ",
    PENDING_default: "EN COURS",
  },
  en: {
    WON: "WON",
    LOST: "LOST",
    VOID: "VOID",
    PENDING_in_progress: "IN PROGRESS",
    PENDING_finished: "PENDING",
    PENDING_scheduled: "SCHEDULED",
    PENDING_default: "IN PROGRESS",
  },
};

export function selectionStatusLabel(
  status: SelectionStatus,
  fixtureStatus?: string,
  locale: Locale = "fr",
): string {
  const l = SELECTION_STATUS_LABELS[locale];
  if (status === "WON") return l.WON;
  if (status === "LOST") return l.LOST;
  if (status === "VOID") return l.VOID;
  if (fixtureStatus) {
    const fs = fixtureStatus.toLowerCase();
    if (fs === "in_progress") return l.PENDING_in_progress;
    if (fs === "finished") return l.PENDING_finished;
    return l.PENDING_scheduled;
  }
  return l.PENDING_default;
}

export function selectionStatusBadgeClass(status: SelectionStatus): string {
  if (status === "WON")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "LOST") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "VOID") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function selectionCardClass(status: SelectionStatus): string {
  if (status === "WON") return "border-emerald-200 bg-emerald-50/30";
  if (status === "LOST") return "border-rose-200 bg-rose-50/30";
  if (status === "VOID") return "border-slate-200 bg-slate-50";
  return "border-border bg-white";
}

// ---------------------------------------------------------------------------
// Pick formatting
// ---------------------------------------------------------------------------

export function formatPickForDisplay(pick: string, market: string): string {
  const formatted = pick
    .replace("OVER_UNDER UNDER", "UNDER 2.5")
    .replace("OVER_UNDER OVER", "OVER 2.5")
    .replace("OVER_UNDER_25 UNDER", "UNDER 2.5")
    .replace("OVER_UNDER_25 OVER", "OVER 2.5");

  if (
    formatted === pick &&
    (market === "OVER_UNDER" || market === "OVER_UNDER_25")
  ) {
    if (pick === "UNDER") return "UNDER 2.5";
    if (pick === "OVER") return "OVER 2.5";
  }

  return formatted;
}
