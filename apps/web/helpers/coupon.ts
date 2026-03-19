// Pure helpers — no React, no imports from components

type CouponStatus = "PENDING" | "WON" | "LOST";
type SelectionStatus = "PENDING" | "WON" | "LOST" | "VOID";

// ---------------------------------------------------------------------------
// Coupon-level
// ---------------------------------------------------------------------------

export function couponStatusLabel(
  status: CouponStatus,
  selections?: Array<{ fixtureStatus: string }>,
): string {
  if (status === "WON") return "GAGNÉ";
  if (status === "LOST") return "PERDU";
  if (selections && selections.length > 0) {
    const fs = selections.map((s) => s.fixtureStatus.toLowerCase());
    if (fs.some((s) => s === "in_progress")) return "EN COURS";
    if (fs.every((s) => s === "finished")) return "EN ATTENTE";
    return "PLANIFIÉ";
  }
  return "EN COURS";
}

export function couponStatusBadgeClass(status: CouponStatus): string {
  if (status === "WON") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "LOST") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function couponStatusDotClass(status: CouponStatus): string {
  if (status === "WON") return "bg-emerald-400";
  if (status === "LOST") return "bg-rose-400";
  return "bg-amber-400";
}

export function couponStatusHeaderBadgeClass(status: CouponStatus): string {
  if (status === "WON") return "border-emerald-400/40 bg-emerald-400/20 text-emerald-300";
  if (status === "LOST") return "border-rose-400/40 bg-rose-400/20 text-rose-300";
  return "border-amber-400/40 bg-amber-400/20 text-amber-300";
}

export function couponModeLabel(legs: number): "Simple" | "Combiné" {
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

export function selectionStatusLabel(
  status: SelectionStatus,
  fixtureStatus?: string,
): string {
  if (status === "WON") return "GAGNÉ";
  if (status === "LOST") return "PERDU";
  if (status === "VOID") return "VOID";
  if (fixtureStatus) {
    const fs = fixtureStatus.toLowerCase();
    if (fs === "in_progress") return "EN COURS";
    if (fs === "finished") return "EN ATTENTE";
    return "PLANIFIÉ";
  }
  return "EN COURS";
}

export function selectionStatusBadgeClass(status: SelectionStatus): string {
  if (status === "WON") return "border-emerald-200 bg-emerald-50 text-emerald-700";
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

  if (formatted === pick && (market === "OVER_UNDER" || market === "OVER_UNDER_25")) {
    if (pick === "UNDER") return "UNDER 2.5";
    if (pick === "OVER") return "OVER 2.5";
  }

  return formatted;
}
