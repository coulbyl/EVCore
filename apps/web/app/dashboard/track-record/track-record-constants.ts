import type {
  ChannelHealthItem,
  ChannelStatsItem,
} from "@/domains/dashboard/types/dashboard";

export type PeriodKey = "30" | "90" | "all";

export const PERIODS: { key: PeriodKey; label: string; days: number | null }[] =
  [
    { key: "30", label: "30 jours", days: 30 },
    { key: "90", label: "90 jours", days: 90 },
    { key: "all", label: "Depuis juillet 2026", days: null },
  ];

// Premier pronostic réel émis avant le coup d'envoi : le 2026-07-01 (relevé
// sur le dump de production du 2026-10-24). « Tout l'historique » affichait
// « du 1er janvier 2023 », alors que tout ce qui précède juillet 2026 est de
// la ré-analyse après coup, exclue de la cohorte : le titre promettait trois
// ans et demi d'historique qui n'existent pas.
const EARLIEST_DATA_DATE = "2026-07-01";

export function resolvePeriod(value: string | undefined): PeriodKey {
  return value === "30" || value === "90" || value === "all" ? value : "90";
}

export function dateRangeForPeriod(period: PeriodKey): {
  from: string;
  to: string;
} {
  const to = new Date().toISOString().slice(0, 10);
  const config = PERIODS.find((p) => p.key === period);
  if (!config || config.days === null) {
    return { from: EARLIEST_DATA_DATE, to };
  }
  const from = new Date(Date.now() - config.days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

/**
 * Ordre d'affichage — purement cosmétique.
 *
 * Ce n'est PAS un filtre, et c'est la correction du 2026-08-22 : cette liste
 * en contenait 10 et servait de `filter()`, ce qui rendait 8 canaux
 * invisibles sur la page de performance malgré leurs résultats réglés —
 * DOUBLE_CHANCE le premier, alors qu'il est le mieux mesuré du système. Les
 * canaux absents d'ici sont désormais affichés à la suite, jamais masqués
 * (voir mergedChannelRows).
 */
export const CHANNEL_DISPLAY_ORDER: ChannelStatsItem["channel"][] = [
  "DOUBLE_CHANCE",
  "DRAW",
  "DOMINANT",
  "TEAM_TOTAL",
  "DRAW_NO_BET",
  "BTTS",
  "GOALS",
  "FIRST_HALF",
  "OVER_UNDER_HT",
  "CLEAN_SHEET",
  "WIN_EITHER_HALF",
  "WIN_TO_NIL",
  "RESULT_TOTAL_GOALS",
  "RESULT_BTTS",
  "HALF_TIME_FULL_TIME",
  "CORRECT_SCORE",
];

/** Canaux reçus, classés selon CHANNEL_DISPLAY_ORDER, inconnus à la fin. */
export function orderChannels<
  T extends { channel: ChannelStatsItem["channel"] },
>(items: readonly T[]): T[] {
  const rank = (channel: ChannelStatsItem["channel"]) => {
    const i = CHANNEL_DISPLAY_ORDER.indexOf(channel);
    return i === -1 ? CHANNEL_DISPLAY_ORDER.length : i;
  };
  return [...items].sort((a, b) => rank(a.channel) - rank(b.channel));
}

export type MergedChannelRow = ChannelStatsItem & {
  status: ChannelHealthItem["status"];
  calibrationRatio: ChannelHealthItem["calibrationRatio"];
};

/**
 * Fusionne stats et santé, pour TOUS les canaux renvoyés par le serveur.
 *
 * On part de `stats`, pas d'une liste locale : c'est le serveur qui sait
 * quels canaux existent. La version précédente itérait sur
 * CHANNEL_DISPLAY_ORDER, ce qui transformait un ordre d'affichage en filtre —
 * un canal absent de la liste locale disparaissait de la page même quand le
 * serveur renvoyait ses résultats.
 */
export function mergeChannelData(
  stats: ChannelStatsItem[],
  health: ChannelHealthItem[],
): MergedChannelRow[] {
  const healthByChannel = new Map(health.map((h) => [h.channel, h]));
  return orderChannels(
    stats.map((row) => ({
      ...row,
      status: healthByChannel.get(row.channel)?.status ?? "INSUFFICIENT_DATA",
      calibrationRatio:
        healthByChannel.get(row.channel)?.calibrationRatio ?? null,
    })),
  );
}

function numberLocale(locale: string): string {
  return locale === "en" ? "en-GB" : "fr-FR";
}

/** 0,459 → « 45,9 % » : toujours une décimale, pour que « 48,0 % » et
 * « 45,9 % » s'alignent et se comparent d'un coup d'œil. */
export function formatRate(rate: number | null, locale: string): string {
  if (rate === null) return "—";
  return new Intl.NumberFormat(numberLocale(locale), {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rate);
}

/** −0,094 → « −9,4 % », avec le vrai signe moins. Les ROI du backend sont en
 * points (−9,4 pour −9,4 %, voir `flatBetRoi`) : diviser par 100 avant. */
export function formatSignedRate(
  fraction: number | null,
  locale: string,
): string {
  if (fraction === null) return "—";
  return new Intl.NumberFormat(numberLocale(locale), {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  })
    .format(fraction)
    .replace("-", "\u2212");
}

export function formatCount(value: number, locale: string): string {
  return value.toLocaleString(numberLocale(locale));
}

/** Bornes d'une tranche de cote → « Cote sous 1,45 », « Cote de 1,45 à
 * 1,80 », « Cote de 1,80 et plus ». */
export function formatOddsBand(
  band: { minOdds: number | null; maxOdds: number | null },
  locale: string,
): string {
  const odds = (value: number) =>
    value.toLocaleString(numberLocale(locale), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (band.minOdds === null && band.maxOdds !== null)
    return `Cote sous ${odds(band.maxOdds)}`;
  if (band.minOdds !== null && band.maxOdds === null)
    return `Cote de ${odds(band.minOdds)} et plus`;
  if (band.minOdds !== null && band.maxOdds !== null)
    return `Cote de ${odds(band.minOdds)} à ${odds(band.maxOdds)}`;
  return "Toutes cotes";
}

/**
 * Canaux hors de la page, mêmes exclusions que l'en-tête côté backend
 * (SUMMARY_EXCLUDED_CHANNELS, dashboard.service.ts) : la somme des réglés du
 * tableau égale ainsi le total affiché en haut.
 * - VALUE et SAFE re-sélectionnent des pronostics d'autres canaux, et ne sont
 *   plus montrés nulle part ailleurs depuis le 2026-09-03.
 * - VANTAGE (avis IA) reprend des matchs déjà comptés : une ligne à part,
 *   sous le tableau, hors total.
 */
export const OUT_OF_TOTAL_CHANNELS: ReadonlySet<ChannelStatsItem["channel"]> =
  new Set(["VALUE", "SAFE", "VANTAGE"]);
