export type AppCurrency = "XOF" | "USD" | "EUR";

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function makeCurrencyFormatter(currency: AppCurrency) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function makeCurrencyCompactFormatter(currency: AppCurrency) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

const formatterCache = new Map<
  AppCurrency,
  ReturnType<typeof makeCurrencyFormatter>
>();
const compactFormatterCache = new Map<
  AppCurrency,
  ReturnType<typeof makeCurrencyCompactFormatter>
>();

function getCurrencyFormatter(currency: AppCurrency) {
  if (!formatterCache.has(currency)) {
    formatterCache.set(currency, makeCurrencyFormatter(currency));
  }
  return formatterCache.get(currency)!;
}

function getCompactCurrencyFormatter(currency: AppCurrency) {
  if (!compactFormatterCache.has(currency)) {
    compactFormatterCache.set(currency, makeCurrencyCompactFormatter(currency));
  }
  return compactFormatterCache.get(currency)!;
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
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return typeof value === "string" ? value : "—";
  const formatter =
    compact && Math.abs(n) >= 1_000_000
      ? getCompactCurrencyFormatter(currency)
      : getCurrencyFormatter(currency);
  return formatter.format(n);
}

export function formatSignedCurrency(
  value: string | number,
  compact = false,
  currency: AppCurrency = "XOF",
): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return typeof value === "string" ? value : "—";
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
