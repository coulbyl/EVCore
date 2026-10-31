/**
 * Les nombres, les chances, les heures du tableau d'affichage, écrits pareil
 * sur chaque écran (10-transverse.md § 6, 13-style.md § 3).
 *
 * Sans dépendance : testé par `pnpm --filter web test:unit` avec le lanceur
 * de Node. Les montants passent par `formatCurrency` (helpers/number.ts), la
 * règle partagée avec le backend.
 */

export type DisplayLocale = "fr" | "en";

const INTL_LOCALE: Record<DisplayLocale, string> = {
  fr: "fr-FR",
  en: "en-GB",
};

/** Le fuseau quand l'appareil ne l'a pas encore dit : Abidjan (GMT). */
export const DEFAULT_TIME_ZONE = "Africa/Abidjan";

/**
 * Arrondi à l'entier, la moitié vers le haut, sans le bruit des flottants :
 * 0,35 × 10 vaut 3,4999999999999996 en JavaScript et doit donner 4.
 */
export function roundHalfUp(value: number): number {
  return Math.floor(Number(value.toPrecision(12)) + 0.5);
}

/**
 * Une chance telle qu'un écran la dit (PRODUCT.md : « une fois sur N »),
 * même règle que `frequencyOf` (lib/frequency.ts) pour qu'une même
 * probabilité se lise pareil partout :
 *
 * - à partir de 50 % : « k sur 10 », plafonné à 9, jamais « 10 sur 10 » ;
 * - en dessous : « 1 sur N », N = 1 / p arrondi, au moins 2 ;
 * - à partir de 1 sur 200 : « moins de 1 sur 200 » (le ticket, 07 § 4).
 *
 * Une probabilité hors de [0, 1] ou illisible donne `null` : une chance
 * inconnue ne s'affiche pas, elle ne devient pas zéro.
 */
export type Chance =
  | { kind: "outOfTen"; count: number; total: 10 }
  | { kind: "oneIn"; total: number }
  | { kind: "rarerThan"; total: 200 };

export const RAREST_SHOWN = 200;
/** Au-delà de 20 diodes, le nombre se lit seul (07 § 4). */
export const MAX_LEDS = 20;

export function chanceOf(probability: number): Chance | null {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    return null;
  }
  if (probability >= 0.5) {
    return {
      kind: "outOfTen",
      count: Math.min(9, roundHalfUp(probability * 10)),
      total: 10,
    };
  }
  if (probability === 0) return { kind: "rarerThan", total: RAREST_SHOWN };
  const total = Math.max(2, roundHalfUp(1 / probability));
  if (total >= RAREST_SHOWN) return { kind: "rarerThan", total: RAREST_SHOWN };
  return { kind: "oneIn", total };
}

/** Les diodes à allumer pour une chance, ou `null` s'il y en aurait trop. */
export function ledsOf(chance: Chance): { lit: number; total: number } | null {
  if (chance.kind === "outOfTen") return { lit: chance.count, total: 10 };
  if (chance.kind === "oneIn" && chance.total <= MAX_LEDS) {
    return { lit: 1, total: chance.total };
  }
  return null;
}

/**
 * Une cote : deux décimales sous 10 (1,28), une jusqu'à 100 (10,6, la cote
 * d'un ticket), aucune au-delà. Virgule en français, point en anglais.
 */
export function formatOdds(odds: number, locale: DisplayLocale): string {
  const digits = odds < 10 ? 2 : odds < 100 ? 1 : 0;
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(odds);
}

/** Le jour court d'une ligne de semaine : « lun. 22 ». */
export function formatShortWeekdayDay(
  date: Date,
  locale: DisplayLocale,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "short",
    day: "numeric",
    timeZone,
  }).format(date);
}

/**
 * Un montant en francs CFA, sans décimale : « 14 000 F » (08 § 2, la ligne
 * de mise fixe). Une perte s'écrit avec le même poids qu'un gain.
 */
export function formatFrancs(amount: number, locale: DisplayLocale): string {
  return `${new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits: 0,
  }).format(amount)} F`;
}

/** L'heure sur 24 heures, dans le fuseau de l'appareil : « 19:00 ». */
export function formatTime(
  date: Date,
  locale: DisplayLocale,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

/** La date courte des listes : « 28/10 ». Jamais l'année. */
export function formatShortDate(
  date: Date,
  locale: DisplayLocale,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "2-digit",
    month: "2-digit",
    timeZone,
  }).format(date);
}

/** La date du jour en tête d'Aujourd'hui : « Samedi 31 octobre ». */
export function formatLongDay(
  date: Date,
  locale: DisplayLocale,
  timeZone: string,
): string {
  const text = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Le jour dans la journée : « mardi 28 », « Tuesday 28 ». */
export function formatWeekdayDay(
  date: Date,
  locale: DisplayLocale,
  timeZone: string,
): string {
  const parts = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "long",
    day: "numeric",
    timeZone,
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${weekday} ${day}`.trim();
}

/** Vrai si le navigateur connaît ce fuseau (« Africa/Douala »). */
export function isValidTimeZone(value: string | null | undefined): boolean {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** La langue d'affichage à partir de la langue de l'application. */
export function displayLocaleOf(locale: string): DisplayLocale {
  return locale.startsWith("en") ? "en" : "fr";
}
