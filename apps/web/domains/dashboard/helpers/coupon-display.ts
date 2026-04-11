type CouponStatus = "PENDING" | "WON" | "LOST";
type CouponTier = "PREMIUM" | "STANDARD" | "SPECULATIF" | "SAFE";
type SelectionStatus = "PENDING" | "WON" | "LOST" | "VOID";
type Locale = "fr" | "en";

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

export function couponModeLabel(legs: number, locale: Locale = "fr"): string {
  if (locale === "en") return legs > 1 ? "Combined" : "Single";
  return legs > 1 ? "Combiné" : "Simple";
}

export function couponTierLabel(
  tier: CouponTier,
  locale: Locale = "fr",
): string {
  if (tier === "SPECULATIF")
    return locale === "en" ? "SPECULATIVE" : "SPÉCULATIF";
  if (tier === "SAFE") return "SAFE";
  return tier;
}

export function couponTierBadgeClass(tier: CouponTier): string {
  if (tier === "PREMIUM")
    return "border-violet-200 bg-violet-50 text-violet-700";
  if (tier === "STANDARD") return "border-sky-200 bg-sky-50 text-sky-700";
  if (tier === "SAFE")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function combinedOdds(odds: string[]): string {
  if (odds.length === 0) return "—";
  const product = odds.reduce((acc, odd) => acc * Number.parseFloat(odd), 1);
  return Number.isFinite(product) ? product.toFixed(2) : "—";
}

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

const MARKET_LABELS: Record<Locale, Record<string, string>> = {
  fr: {
    ONE_X_TWO: "Résultat",
    MATCH_WINNER: "Vainqueur",
    BTTS: "Les deux marquent",
    OVER_UNDER: "Plus/Moins",
    OVER_UNDER_25: "Plus/Moins",
    HALF_TIME_FULL_TIME: "Mi-temps / Fin de match",
    OVER_UNDER_HT: "Plus/Moins MT",
    FIRST_HALF_WINNER: "Résultat MT",
  },
  en: {
    ONE_X_TWO: "Result",
    MATCH_WINNER: "Match Winner",
    BTTS: "Both Teams Score",
    OVER_UNDER: "Over/Under",
    OVER_UNDER_25: "Over/Under",
    HALF_TIME_FULL_TIME: "Half Time / Full Time",
    OVER_UNDER_HT: "Over/Under HT",
    FIRST_HALF_WINNER: "HT Result",
  },
};

export function formatMarketForDisplay(
  market: string,
  locale: Locale = "fr",
): string {
  return (
    MARKET_LABELS[locale][market] ??
    market.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

export function formatPickForDisplay(pick: string, market: string): string {
  const formatted = pick
    .replace("OVER_UNDER UNDER_1_5", "UNDER 1.5")
    .replace("OVER_UNDER OVER_1_5", "OVER 1.5")
    .replace("OVER_UNDER UNDER_3_5", "UNDER 3.5")
    .replace("OVER_UNDER OVER_3_5", "OVER 3.5")
    .replace("OVER_UNDER UNDER", "UNDER 2.5")
    .replace("OVER_UNDER OVER", "OVER 2.5")
    .replace("OVER_UNDER_25 UNDER", "UNDER 2.5")
    .replace("OVER_UNDER_25 OVER", "OVER 2.5");

  if (
    formatted === pick &&
    (market === "OVER_UNDER" || market === "OVER_UNDER_25")
  ) {
    if (pick === "UNDER_1_5") return "UNDER 1.5";
    if (pick === "OVER_1_5") return "OVER 1.5";
    if (pick === "UNDER") return "UNDER 2.5";
    if (pick === "OVER") return "OVER 2.5";
    if (pick === "UNDER_3_5") return "UNDER 3.5";
    if (pick === "OVER_3_5") return "OVER 3.5";
  }

  if (formatted === pick && market === "OVER_UNDER_HT") {
    if (pick === "OVER_0_5") return "OVER 0.5 HT";
    if (pick === "UNDER_0_5") return "UNDER 0.5 HT";
    if (pick === "OVER_1_5") return "OVER 1.5 HT";
    if (pick === "UNDER_1_5") return "UNDER 1.5 HT";
  }

  if (formatted === pick && market === "FIRST_HALF_WINNER") {
    if (pick === "HOME") return "MT DOMICILE";
    if (pick === "DRAW") return "MT NUL";
    if (pick === "AWAY") return "MT EXTÉRIEUR";
  }

  if (formatted === pick && market === "HALF_TIME_FULL_TIME") {
    const htftLabels: Record<string, string> = {
      HOME_HOME: "HOME / HOME",
      HOME_DRAW: "HOME / DRAW",
      HOME_AWAY: "HOME / AWAY",
      DRAW_HOME: "DRAW / HOME",
      DRAW_DRAW: "DRAW / DRAW",
      DRAW_AWAY: "DRAW / AWAY",
      AWAY_HOME: "AWAY / HOME",
      AWAY_DRAW: "AWAY / DRAW",
      AWAY_AWAY: "AWAY / AWAY",
    };
    return htftLabels[pick] ?? pick;
  }

  return formatted;
}
