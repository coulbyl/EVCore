/**
 * EVCore email color palette — dark theme, matching the actual dashboard
 * tokens (packages/ui/src/styles/theme.css, `.dark` block) instead of an
 * invented palette: background/panel/foreground/accent/success/warning/
 * destructive all come straight from there, so the email and the app read
 * as the same product. (A light-theme pass was tried first for email-client
 * safety, but the brand is dark — reverted 2026-07-28 per direct feedback.)
 *
 * Severity scale:
 *   info     — weekly reports, neutral context   (accent teal)
 *   warning  — calibration alerts, brier score   (amber, --warning)
 *   caution  — hints, expiry notices             (amber, softer)
 *   alert    — ROI threshold breach, ETL failure (red, --destructive)
 *   critical — market suspension                  (red, deeper)
 *   success  — positive ROI, auto-apply heading   (green, --success)
 *   rollback — weight/model rollback heading      (amber)
 */

export const palette = {
  // ─── Backgrounds ───────────────────────────────────────────────────────────
  bg: {
    page: "#0d1520", // --background
    surface: "#162033", // --panel-strong (card container)
    subtle: "#111e2e", // --panel (inset blocks — code/id lists)
  },

  // ─── Borders ───────────────────────────────────────────────────────────────
  border: {
    // --border is a translucent rgba(226,232,240,0.08) over #0d1520 in the
    // app; email clients render translucent borders inconsistently, so this
    // is the opaque equivalent instead.
    default: "#22314a",
    alert: "#7f1d1d", // red-900    — alert/critical badge outlines
    warning: "#78350f", // amber-900  — caution badge outlines
    success: "#14532d", // green-900  — positive badge outlines
  },

  // ─── Text ──────────────────────────────────────────────────────────────────
  text: {
    primary: "#e2e8f0", // --foreground
    secondary: "#8ca0b8", // --muted-foreground
    label: "#64748b", // --muted     — ALL-CAPS field labels
    subtle: "#64748b", // --muted     — footer, tagline
  },

  // ─── Brand ─────────────────────────────────────────────────────────────────
  brand: "#14b8a6", // --accent (dark theme)

  // ─── Status — heading and highlight colors ─────────────────────────────────
  status: {
    info: "#14b8a6", // --accent   — weekly report
    warning: "#eab308", // --warning  — brier score alert
    caution: "#facc15", // amber-400  — hint text (non-urgent)
    alert: "#f87171", // red-400    — ROI alert, ETL failure
    critical: "#ef4444", // --destructive — market suspension (auto-suspension)
    success: "#22c55e", // --success  — positive ROI, auto-apply heading
    rollback: "#facc15", // amber-400  — weight/model rollback heading
  },

  // ─── Badges — (bg, text, border) tuples for inline badge components ────────
  badge: {
    alert: {
      bg: "#2a0f14", // dark red
      text: "#fca5a5", // red-300
      border: "#7f1d1d", // red-900
    },
    warning: {
      bg: "#2a2008", // dark amber
      text: "#fde68a", // amber-200
      border: "#78350f", // amber-900
    },
    success: {
      bg: "#08251a", // dark green
      text: "#86efac", // green-300
      border: "#14532d", // green-900
    },
  },
} as const;
