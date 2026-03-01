/**
 * EVCore email color palette — dark theme
 *
 * Based on Tailwind CSS color tokens (slate / sky / red / orange / amber / green).
 * All values are hardcoded strings for email client compatibility (no CSS variables).
 *
 * Severity scale:
 *   info     — weekly reports, neutral context   (sky)
 *   warning  — calibration alerts, brier score   (orange)
 *   caution  — hints, expiry notices             (amber)
 *   alert    — ROI threshold breach, ETL failure (red-400, moderate)
 *   critical — market suspension                  (red-500, maximum)
 */

export const palette = {
  // ─── Backgrounds ───────────────────────────────────────────────────────────
  bg: {
    page: "#0f172a", // slate-950  — email body
    surface: "#1e293b", // slate-800  — card container
    code: "#1a0a0a", // custom     — error message block
  },

  // ─── Borders ───────────────────────────────────────────────────────────────
  border: {
    default: "#334155", // slate-700
    alert: "#b91c1c", // red-700    — alert/critical badge outlines
    warning: "#d97706", // amber-600  — caution badge outlines
    success: "#16a34a", // green-600  — positive badge outlines
  },

  // ─── Text ──────────────────────────────────────────────────────────────────
  text: {
    primary: "#f1f5f9", // slate-100  — body content
    secondary: "#94a3b8", // slate-400  — secondary info
    label: "#64748b", // slate-500  — ALL-CAPS field labels
    subtle: "#475569", // slate-600  — footer, tagline
  },

  // ─── Brand ─────────────────────────────────────────────────────────────────
  brand: "#38bdf8", // sky-400    — EVCORE wordmark, report heading

  // ─── Status — heading and highlight colors ─────────────────────────────────
  status: {
    info: "#38bdf8", // sky-400    — weekly report
    warning: "#fb923c", // orange-400 — brier score alert
    caution: "#fbbf24", // amber-400  — hint text (non-urgent)
    alert: "#f87171", // red-400    — ROI alert, ETL failure
    critical: "#ef4444", // red-500    — market suspension (auto-suspension)
    success: "#4ade80", // green-400  — positive ROI, auto-apply heading
    rollback: "#facc15", // yellow-400 — weight rollback heading
  },

  // ─── Badges — (bg, text, border) tuples for inline badge components ────────
  badge: {
    alert: {
      bg: "#450a0a", // custom dark red
      text: "#fca5a5", // red-300
      border: "#b91c1c", // red-700
    },
    warning: {
      bg: "#422006", // custom dark amber
      text: "#fde68a", // yellow-200
      border: "#d97706", // amber-600
    },
    success: {
      bg: "#052e16", // custom dark green
      text: "#86efac", // green-300
      border: "#16a34a", // green-600
    },
  },
} as const;
