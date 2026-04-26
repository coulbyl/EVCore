const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const CURRENCY_FORMATTER = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const CURRENCY_COMPACT_FORMATTER = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const UNITS_NUMBER_FORMATTER = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
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

export function formatUnitsValue(value: string | number) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue)) {
    return typeof value === "string" ? value : String(value);
  }

  return UNITS_NUMBER_FORMATTER.format(parsedValue);
}

/**
 * Format a monetary value with EUR symbol.
 * compact=true: values ≥ 1 000 rendered as "1,2 k€" — suited for StatCard on mobile.
 */
export function formatCurrency(
  value: string | number,
  compact = false,
): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return typeof value === "string" ? value : "—";
  return compact && Math.abs(n) >= 1000
    ? CURRENCY_COMPACT_FORMATTER.format(n)
    : CURRENCY_FORMATTER.format(n);
}

export function formatSignedCurrency(
  value: string | number,
  compact = false,
): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return typeof value === "string" ? value : "—";
  const prefix = n > 0 ? "+" : "";
  return `${prefix}${formatCurrency(n, compact)}`;
}

export function formatSignedUnitsValue(value: string | number) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue)) {
    return typeof value === "string" ? value : String(value);
  }

  const prefix = parsedValue > 0 ? "+" : "";
  return `${prefix}${formatUnitsValue(parsedValue)}`;
}
