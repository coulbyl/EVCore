// ─────────────────────────────────────────────
// CONSENSUS (meta) — emits a 1X2 selection only when ≥ minLevel INDEPENDENT
// primary strategy classes agree on the same (market, pick). Calibrated
// GLOBALLY, not per-league: the agreement mechanism is league-agnostic and
// per-league volume is far too thin to calibrate.
//
// Validated 2026-06-23 on settled channel_selection (3 seasons). 1X2 level-2
// (two independent classes agree) vs level-1 baseline:
//   2023-24: +7.6% (n80) | 2024-25: +18.7% (n129) | 2025-26: +9.3% (n63)
//   baseline (1 class): -5.5% / -10.7% / -9.8% every season.
// Positive across all 3 seasons, baseline net-losing → the agreement filter
// carries the edge. v1 restricts to ONE_X_TWO (BTTS/OVER_UNDER level-2 too thin).
// ─────────────────────────────────────────────

export const CONSENSUS_CONFIG = {
  enabled: true,
  // Minimum number of distinct independence classes that must agree on a pick.
  minLevel: 2,
} as const;
