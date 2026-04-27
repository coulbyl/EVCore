export const CHART_AXIS_TICK = {
  fontSize: 10,
  fill: "var(--muted-foreground)",
  fontFamily: "inherit",
  letterSpacing: "0.04em",
};

export const CHART_TOOLTIP_CONTENT_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  fontSize: 12,
  fontFamily: "inherit",
  color: "var(--foreground)",
};

export const CHART_COLORS = {
  teal: "#0f766e",
  amber: "#d97706",
  indigo: "#4f46e5",
  success: "#16a34a",
  danger: "#dc2626",
  muted: "#94a3b8",
  canal: {
    ev: "#d97706",
    sv: "#0f766e",
    conf: "#4f46e5",
  },
} as const;
