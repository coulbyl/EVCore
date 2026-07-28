import { palette } from "./palette";

/**
 * Shared style tokens for the email templates — every template previously
 * redefined its own heading/label/value/badge objects (near-identical
 * copies, one per file). Centralised here so the light-theme redesign
 * (2026-07-28) lives in one place instead of 11.
 */

export function headingStyle(color: string = palette.text.primary) {
  return {
    color,
    fontSize: "20px",
    fontWeight: "700",
    letterSpacing: "-0.2px",
    margin: "0 0 14px",
  } as const;
}

export const label = {
  color: palette.text.label,
  fontSize: "11px",
  fontWeight: "600",
  letterSpacing: "0.6px",
  margin: "0 0 2px",
  textTransform: "uppercase" as const,
};

export const value = {
  color: palette.text.primary,
  fontSize: "15px",
  fontWeight: "600",
  margin: "0 0 12px",
};

export const metric = {
  color: palette.text.secondary,
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 6px",
};

export const intro = {
  color: palette.text.secondary,
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 20px",
};

export const hint = {
  color: palette.text.subtle,
  fontSize: "12px",
  lineHeight: "18px",
  margin: "16px 0 0",
};

export const note = {
  color: palette.text.secondary,
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 16px",
};

/** Inset block for monospace/preformatted content (codes, IDs, error text). */
export const insetBlock = {
  backgroundColor: palette.bg.subtle,
  border: `1px solid ${palette.border.default}`,
  borderRadius: "6px",
  color: palette.text.primary,
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  fontSize: "12px",
  lineHeight: "20px",
  margin: "0",
  padding: "10px 12px",
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-all" as const,
};

export const button = {
  backgroundColor: palette.brand,
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block" as const,
  fontSize: "14px",
  fontWeight: "600",
  padding: "12px 26px",
  textDecoration: "none",
};

export const buttonSection = {
  margin: "4px 0 20px",
  textAlign: "center" as const,
};

export type BadgeTone = "alert" | "warning" | "success";

export function badgeStyle(tone: BadgeTone) {
  const t = palette.badge[tone];
  return {
    backgroundColor: t.bg,
    border: `1px solid ${t.border}`,
    borderRadius: "4px",
    color: t.text,
    display: "inline-block" as const,
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.6px",
    margin: "0 0 16px",
    padding: "3px 9px",
    textTransform: "uppercase" as const,
  };
}
