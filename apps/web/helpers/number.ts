const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("fr-FR", {
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
