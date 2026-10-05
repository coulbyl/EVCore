---
name: evcore-forecast-audit
description: Audit EVCore football forecasts, calibration, model-market divergence and top-N ranking with point-in-time replay. Use when investigating overrated picks, proposing probability changes, testing new signals or evaluating forecast quality and profitability.
---

# EVCore forecast audit

Read root `AGENTS.md`, [repository map](references/repository-map.md) and
`docs/backtest-harness-architecture.md`. Reuse existing code; do not start a
parallel prediction engine. Never read secrets or load them through a command.
Use an already configured development environment or a sanitized export.
If no data is available, produce a runnable audit plan and label results unknown.

1. Freeze the question, comparison baseline, model commit, channels, markets,
   competitions, decision time, selection/calibration/validation windows,
   ranking objective and minimum sample before inspecting validation results.
   Separate hit rate, probability accuracy, EV and realized ROI.
2. Inventory fixture IDs, kickoff, source IDs, stats, odds `snapshotAt` and
   `createdAt`, model `analyzedAt`, version and coverage. Exclude observations
   unavailable at decision time. Preserve exclusions and their denominators.
   Distinguish a reconstructed forecast from a genuinely recorded forecast.
   Audit timestamp limitations even when using `PointInTimeLoader`.
3. Reuse `@evcore/analysis-core` probabilities, pricing and strategies; trace
   backend assembly and worker inputs. Treat fallback/default ratings as
   missing evidence, not observed strength. If investigating injuries or
   lineups, record source, publication time, observed time and fixture identity.
   Keep unverified web intelligence outside numerical forecasts. Do not allow
   a new LLM adjustment without a versioned, backtested rule.
4. Inspect calibration by channel, market, competition and odds/probability
   bucket. Report Brier/log-loss definitions, reliability, sample count and
   uncertainty. Fit corrections only on information already settled/known at
   each prediction time. Never fit on the entire evaluation history.
5. Compare raw, calibrated and market probabilities on the same cohort.
   Reuse `computeMarketFair` only for supported complete outcome partitions.
   Label unsupported/missing fair probabilities unavailable. Keep EV from
   offered odds distinct from model minus de-vig market edge. Trace any
   market blend already in EVCore; compare independent and market-informed
   baselines explicitly rather than prohibiting blending categorically.
6. Investigate Top-N by replaying candidate eligibility, reduction and ranking
   at the original decision time. Compare equal dates, exposure and candidate
   universe; freeze N before validation. Inspect rank buckets, large edges,
   data-poor competitions and calibration drift. Do not select a ranking
   solely because it wins on historical ROI.
7. Use `runValidationProtocol` for frozen-grid selection then untouched
   chronological validation. Include all attempted configurations and
   selection versus validation measures. Reserve a further holdout when
   developing calibration as well as ranking. Use sensitivity checks and
   bootstrap blocks by day/fixture for clustered observations; do not treat
   multiple picks from a match as independent evidence.
8. After settlement, compare pre-recorded forecasts to actual outcomes,
   account for voids/partial payouts, and review aggregate patterns. Convert
   retrospective hypotheses into a new validation cycle; never edit the
   original forecast or tune on a losing match alone.

Deliver a concise report: hypothesis; exact data window and provenance;
baseline/candidate configuration; coverage and exclusions; calibration,
ranking and return metrics with sample sizes; reproducible commands; verdict
(`unsupported`, `insufficient_data`, `rejected`, or `candidate_for_shadow`).
Prefer a shadow experiment until out-of-sample evidence supports promotion.
Do not claim a profitable model or change production thresholds from a skill.
