// ─────────────────────────────────────────────
// CONSENSUS (meta) — reports, in reasonDetails, when >= minLevel INDEPENDENT
// primary strategy classes agree on the same (market, pick). Calibrated
// GLOBALLY, not per-league: the agreement mechanism is league-agnostic and
// per-league volume is far too thin to calibrate.
//
// ⚠️ `enabled: true` means "compute and report the agreement level". It has
// NOT meant "emit a selection" since 2026-08-22 — see the long comment in
// decideConsensus for why the published pick was removed (pure duplication,
// plus a `maxProbability` biased upward by construction).
//
// The numbers that used to justify this config measured the ROI of those
// published selections, so they no longer describe anything the strategy
// does; they are kept here only as the historical reason the agreement signal
// was believed to carry information:
//   validated 2026-06-23 on settled channel_selection, 1X2 level-2 vs level-1
//   baseline — 2023-24 +7.6% (n80) | 2024-25 +18.7% (n129) | 2025-26 +9.3%
//   (n63), against a level-1 baseline net-losing every season.
// Read them as a dated observation on a small sample, not as a validation:
// the same shape of result (a positive slice retained because it was
// positive) is exactly what the 2026-08-22 audit invalidated elsewhere.
//
// v1 restricts to ONE_X_TWO (BTTS/OVER_UNDER level-2 too thin).
// ─────────────────────────────────────────────

export const CONSENSUS_CONFIG = {
  enabled: true,
  // Minimum number of distinct independence classes that must agree on a pick.
  minLevel: 2,
} as const;
