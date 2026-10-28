import { formatMoney } from "@evcore/analysis-core";

export type AppCurrency = "XOF" | "USD" | "EUR";

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

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

// Règles de montant partagées avec le backend (résumé du matin, messages
// d'erreur) : packages/analysis-core/src/display/money.ts.
export function formatCurrency(
  value: string | number,
  compact = false,
  currency: AppCurrency = "XOF",
): string {
  return formatMoney(value, { currency, compact });
}

export function formatSignedCurrency(
  value: string | number,
  compact = false,
  currency: AppCurrency = "XOF",
): string {
  return formatMoney(value, { currency, compact, signed: true });
}

export function formatSignedUnitsValue(value: string | number) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue)) {
    return typeof value === "string" ? value : String(value);
  }

  const prefix = parsedValue > 0 ? "+" : "";
  return `${prefix}${formatUnitsValue(parsedValue)}`;
}
