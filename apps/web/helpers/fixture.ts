import type { FixturePickSnapshot } from "@/domains/fixture/types/fixture";

type Locale = "fr" | "en";

const FIXTURE_STATUS_LABELS: Record<Locale, Record<string, string>> = {
  fr: {
    finished: "Terminé",
    in_progress: "En cours",
    postponed: "Reporté",
    cancelled: "Annulé",
    default: "Planifié",
  },
  en: {
    finished: "Finished",
    in_progress: "In progress",
    postponed: "Postponed",
    cancelled: "Cancelled",
    default: "Scheduled",
  },
};

export function fixtureStatusLabel(
  status: string,
  locale: Locale = "fr",
): string {
  const s = status.toLowerCase();
  const labels = FIXTURE_STATUS_LABELS[locale];
  return labels[s] ?? labels["default"] ?? s;
}

export function fixtureStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "finished") return "border-slate-200 bg-slate-100 text-slate-500";
  if (s === "in_progress") return "border-blue-200 bg-blue-50 text-blue-600";
  if (s === "postponed" || s === "cancelled")
    return "border-rose-200 bg-rose-50 text-rose-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

type LocalePickFormat = "fr" | "en";

const MARKET_LABELS: Record<LocalePickFormat, Record<string, string>> = {
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
  locale: LocalePickFormat = "fr",
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

export function formatDiagnosticPickForDisplay(
  market: string,
  pick: string,
): string {
  if (market === "ONE_X_TWO") {
    if (pick === "HOME") return "V1";
    if (pick === "DRAW") return "N";
    if (pick === "AWAY") return "V2";
  }

  if (market === "BTTS") {
    if (pick === "YES") return "BB OUI";
    if (pick === "NO") return "BB NON";
  }

  if (market === "FIRST_HALF_WINNER") {
    if (pick === "HOME") return "MT DOMICILE";
    if (pick === "DRAW") return "MT NUL";
    if (pick === "AWAY") return "MT EXTÉRIEUR";
  }

  if (market === "OVER_UNDER" || market === "OVER_UNDER_25") {
    if (pick === "OVER") return "PLUS DE 2.5";
    if (pick === "UNDER") return "MOINS DE 2.5";
    if (pick === "OVER_1_5") return "PLUS DE 1.5";
    if (pick === "UNDER_1_5") return "MOINS DE 1.5";
    if (pick === "OVER_3_5") return "PLUS DE 3.5";
    if (pick === "UNDER_3_5") return "MOINS DE 3.5";
  }

  if (market === "OVER_UNDER_HT") {
    if (pick === "OVER_0_5") return "PLUS DE 0.5 MT";
    if (pick === "UNDER_0_5") return "MOINS DE 0.5 MT";
    if (pick === "OVER_1_5") return "PLUS DE 1.5 MT";
    if (pick === "UNDER_1_5") return "MOINS DE 1.5 MT";
  }

  if (market === "HALF_TIME_FULL_TIME") {
    return pick.replace(/_/g, " / ");
  }

  return pick.replace(/_/g, " ");
}

export function formatCombinedPickForDisplay(
  snapshot: Pick<
    FixturePickSnapshot,
    "market" | "pick" | "comboMarket" | "comboPick"
  >,
): string {
  const primary = formatDiagnosticPickForDisplay(
    snapshot.market,
    snapshot.pick,
  );
  if (!snapshot.comboMarket || !snapshot.comboPick) {
    return primary;
  }

  return `${primary} + ${formatDiagnosticPickForDisplay(snapshot.comboMarket, snapshot.comboPick)}`;
}
