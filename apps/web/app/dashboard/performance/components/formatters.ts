import type { NumericLike } from "@/domains/backtest/types/backtest";

export function toNumber(value: NumericLike | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = value.replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatPercent(
  value: NumericLike | null | undefined,
  digits = 2,
): string {
  if (typeof value === "string" && value.includes("%")) {
    return value;
  }

  const parsed = toNumber(value);
  if (parsed === null) return "—";
  return `${parsed > 0 ? "+" : ""}${parsed.toFixed(digits)}%`;
}

export function formatDecimal(
  value: NumericLike | null | undefined,
  digits = 2,
): string {
  const parsed = toNumber(value);
  if (parsed === null) return "—";
  return parsed.toFixed(digits);
}

export function formatUnits(
  value: NumericLike | null | undefined,
  digits = 2,
): string {
  const parsed = toNumber(value);
  if (parsed === null) return "—";
  return `${parsed > 0 ? "+" : ""}${parsed.toFixed(digits)} u`;
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}
