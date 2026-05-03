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
  if (s === "finished")
    return "border-border bg-secondary text-muted-foreground";
  if (s === "in_progress") return "border-accent/20 bg-accent-soft text-accent";
  if (s === "postponed" || s === "cancelled")
    return "border-destructive/20 bg-destructive/10 text-destructive";
  return "border-warning/20 bg-warning/12 text-warning";
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
  // Normalise : retire le préfixe marché si concaténé (ex: "OVER_UNDER OVER_1_5" → "OVER_1_5")
  const p = pick.includes(" ") ? pick.split(" ").slice(1).join("_") : pick;

  if (market === "ONE_X_TWO" || market === "MATCH_WINNER") {
    if (p === "HOME") return "Domicile";
    if (p === "DRAW") return "Nul";
    if (p === "AWAY") return "Extérieur";
  }

  if (market === "BTTS") {
    if (p === "YES") return "Oui";
    if (p === "NO") return "Non";
  }

  if (market === "OVER_UNDER" || market === "OVER_UNDER_25") {
    if (p === "OVER_1_5") return "Plus de 1.5";
    if (p === "UNDER_1_5") return "Moins de 1.5";
    if (p === "OVER") return "Plus de 2.5";
    if (p === "UNDER") return "Moins de 2.5";
    if (p === "OVER_3_5") return "Plus de 3.5";
    if (p === "UNDER_3_5") return "Moins de 3.5";
  }

  if (market === "OVER_UNDER_HT") {
    if (p === "OVER_0_5") return "Plus de 0.5 MT";
    if (p === "UNDER_0_5") return "Moins de 0.5 MT";
    if (p === "OVER_1_5") return "Plus de 1.5 MT";
    if (p === "UNDER_1_5") return "Moins de 1.5 MT";
  }

  if (market === "FIRST_HALF_WINNER") {
    if (p === "HOME") return "Domicile MT";
    if (p === "DRAW") return "Nul MT";
    if (p === "AWAY") return "Extérieur MT";
  }

  if (market === "HALF_TIME_FULL_TIME") {
    const htftLabels: Record<string, string> = {
      HOME_HOME: "Dom. / Dom.",
      HOME_DRAW: "Dom. / Nul",
      HOME_AWAY: "Dom. / Ext.",
      DRAW_HOME: "Nul / Dom.",
      DRAW_DRAW: "Nul / Nul",
      DRAW_AWAY: "Nul / Ext.",
      AWAY_HOME: "Ext. / Dom.",
      AWAY_DRAW: "Ext. / Nul",
      AWAY_AWAY: "Ext. / Ext.",
    };
    return htftLabels[p] ?? p;
  }

  return p;
}

export function formatDiagnosticPickForDisplay(
  market: string,
  pick: string,
): string {
  if (market === "ONE_X_TWO" || market === "MATCH_WINNER") {
    if (pick === "HOME") return "V1";
    if (pick === "DRAW") return "Nul";
    if (pick === "AWAY") return "V2";
  }

  if (market === "BTTS") {
    if (pick === "YES") return "BB OUI";
    if (pick === "NO") return "BB NON";
  }

  if (market === "FIRST_HALF_WINNER") {
    if (pick === "HOME") return "Dom. MT";
    if (pick === "DRAW") return "Nul MT";
    if (pick === "AWAY") return "Ext. MT";
  }

  if (market === "OVER_UNDER" || market === "OVER_UNDER_25") {
    if (pick === "OVER") return "Plus de 2.5";
    if (pick === "UNDER") return "Moins de 2.5";
    if (pick === "OVER_1_5") return "Plus de 1.5";
    if (pick === "UNDER_1_5") return "Moins de 1.5";
    if (pick === "OVER_3_5") return "Plus de 3.5";
    if (pick === "UNDER_3_5") return "Moins de 3.5";
  }

  if (market === "OVER_UNDER_HT") {
    if (pick === "OVER_0_5") return "Plus de 0.5 MT";
    if (pick === "UNDER_0_5") return "Moins de 0.5 MT";
    if (pick === "OVER_1_5") return "Plus de 1.5 MT";
    if (pick === "UNDER_1_5") return "Moins de 1.5 MT";
  }

  if (market === "HALF_TIME_FULL_TIME") {
    const htftLabels: Record<string, string> = {
      HOME_HOME: "V1 / V1",
      HOME_DRAW: "V1 / Nul",
      HOME_AWAY: "V1 / V2",
      DRAW_HOME: "Nul / V1",
      DRAW_DRAW: "Nul / Nul",
      DRAW_AWAY: "Nul / V2",
      AWAY_HOME: "V2 / V1",
      AWAY_DRAW: "V2 / Nul",
      AWAY_AWAY: "V2 / V2",
    };
    return htftLabels[pick] ?? pick;
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
