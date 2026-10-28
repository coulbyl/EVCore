export type AppCurrency = "XOF" | "USD" | "EUR";

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const CURRENCY_SYMBOL: Record<AppCurrency, string> = {
  XOF: "F",
  USD: "$",
  EUR: "€",
};

const PLAIN_FORMATTER = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// Le franc CFA n'a pas de centimes : « −462,4 F » n'existe sur aucun ticket
// (revue UX du 2026-10-27).
const WHOLE_FORMATTER = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

const PLAIN_COMPACT_FORMATTER = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function applySymbol(numStr: string, currency: AppCurrency): string {
  const sym = CURRENCY_SYMBOL[currency];
  return currency === "USD" ? `${sym}${numStr}` : `${numStr}\u00A0${sym}`;
}

const UNITS_NUMBER_FORMATTER = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const UNITS_COMPACT_FORMATTER = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCompactValue(value: string | number) {
  const rawValue = typeof value === "number" ? String(value) : value.trim();
  const match = rawValue.match(/^([+-]?)(\d+(?:[.,]\d+)?)(.*)$/);

  if (!match) {
    return rawValue;
  }

  const sign = match[1] ?? "";
  const numericPart = match[2];
  const suffix = match[3] ?? "";

  if (!numericPart) {
    return rawValue;
  }

  const parsedValue = Number.parseFloat(numericPart.replace(",", "."));

  if (!Number.isFinite(parsedValue) || Math.abs(parsedValue) < 1000) {
    return rawValue;
  }

  return `${sign}${COMPACT_NUMBER_FORMATTER.format(parsedValue)}${suffix}`;
}

export function formatUnitsValue(value: string | number, compact = false) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue)) {
    return typeof value === "string" ? value : String(value);
  }

  if (compact && Math.abs(parsedValue) >= 1_000_000) {
    return UNITS_COMPACT_FORMATTER.format(parsedValue);
  }

  return UNITS_NUMBER_FORMATTER.format(parsedValue);
}

export function formatCurrency(
  value: string | number,
  compact = false,
  currency: AppCurrency = "XOF",
): string {
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw)) return typeof value === "string" ? value : "—";
  // « + 0 » évite d'écrire « -0 F » pour −0,4 arrondi.
  const n = currency === "XOF" ? Math.round(raw) + 0 : raw;
  const numStr =
    compact && Math.abs(n) >= 1_000_000
      ? PLAIN_COMPACT_FORMATTER.format(n)
      : currency === "XOF"
        ? WHOLE_FORMATTER.format(n)
        : PLAIN_FORMATTER.format(n);
  return applySymbol(numStr, currency);
}

export function formatSignedCurrency(
  value: string | number,
  compact = false,
  currency: AppCurrency = "XOF",
): string {
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw)) return typeof value === "string" ? value : "—";
  const n = currency === "XOF" ? Math.round(raw) + 0 : raw;
  const prefix = n > 0 ? "+" : "";
  return `${prefix}${formatCurrency(n, compact, currency)}`;
}

export function formatSignedUnitsValue(value: string | number) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue)) {
    return typeof value === "string" ? value : String(value);
  }

  const prefix = parsedValue > 0 ? "+" : "";
  return `${prefix}${formatUnitsValue(parsedValue)}`;
}
