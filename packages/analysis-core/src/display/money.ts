/**
 * Montants en francs CFA, euros ou dollars, écrits pareil partout : l'écran
 * (helpers/number.ts du web), le résumé du matin et les messages d'erreur du
 * backend. Avant le 2026-10-28, trois règles coexistaient (arrondi de −x,5,
 * place du signe en dollars, « F » contre « F CFA », euro par défaut).
 *
 * Règles : français, franc CFA sans centimes, euros et dollars à deux
 * décimales au plus, espace insécable avant le symbole (dollar devant),
 * arrondi à l'unité la plus proche en éloignant la moitié de zéro, jamais
 * « -0 », « + » seulement si demandé.
 */

const SYMBOL: Readonly<Record<string, string>> = {
  XOF: "F",
  EUR: "€",
  USD: "$",
};

const WHOLE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const TWO_DIGITS = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const COMPACT = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export type FormatMoneyOptions = {
  /** Code ISO ; XOF par défaut. Un code inconnu s'écrit tel quel. */
  currency?: string | null;
  /** « + » devant un montant positif. */
  signed?: boolean;
  /** Notation compacte à partir d'un million. */
  compact?: boolean;
};

function roundHalfAwayFromZero(value: number, digits: number): number {
  const factor = 10 ** digits;
  // « + 0 » : −0 devient 0, pour ne jamais écrire « -0 F ».
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor + 0;
}

/**
 * `value` accepte un nombre ou sa chaîne (un Decimal passe par
 * `toString()`). Une valeur non numérique est rendue telle quelle, ou « — ».
 */
export function formatMoney(
  value: number | string,
  options: FormatMoneyOptions = {},
): string {
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw)) return typeof value === "string" ? value : "—";
  const code = options.currency ?? "XOF";
  const digits = code === "XOF" ? 0 : 2;
  const rounded = roundHalfAwayFromZero(raw, digits);
  const abs = Math.abs(rounded);
  const body =
    options.compact && abs >= 1_000_000
      ? COMPACT.format(abs)
      : (digits === 0 ? WHOLE : TWO_DIGITS).format(abs);
  const sign = rounded < 0 ? "-" : options.signed && rounded > 0 ? "+" : "";
  const symbol = SYMBOL[code] ?? code;
  return code === "USD"
    ? `${sign}${symbol}${body}`
    : `${sign}${body} ${symbol}`;
}
