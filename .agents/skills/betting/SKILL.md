---
name: betting
description: Audit odds conversion, de-vig, expected value, Kelly, arbitrage and independent parlays offline. Use for EVCore betting mathematics checks with supplied odds and probabilities; never for fetching live odds or forecasting a match.
---

# Betting mathematics for EVCore

Use the reviewed Machina Sports computation module as an **offline diagnostic**.
Keep `packages/analysis-core` as the production source of truth. Read root
`AGENTS.md`; never read secret files. No API key, pip install or network is needed.

Run from the repository root with Python 3.10+:

```bash
python3 .agents/skills/betting/scripts/calculate.py devig <<'JSON'
{"odds":[2.0,3.5,4.0],"format":"decimal"}
JSON
python3 .agents/skills/betting/scripts/calculate.py find_edge <<'JSON'
{"fair_prob":0.6,"market_prob":0.5}
JSON
```

Read [parameters](references/upstream-api-reference.md) for the six supported
commands: `convert_odds`, `devig`, `find_edge`, `kelly_criterion`,
`find_arbitrage`, `parlay_analysis`. Send a JSON params object on stdin; check
the exit code and `status`. The wrapper deliberately omits upstream trading,
data fetching, BPI, line-movement and all-in-one evaluation workflows.

1. Identify event, market, line, period, settlement rules, bookmaker and quote
   time. Accept only actual supplied prices. Require a complete, mutually
   exclusive outcome set for de-vig and arbitrage; include DRAW for football 1X2.
   Do not normalize overlapping double-chance selections.
2. Keep `pModel`, `pMarketFair` and `1/offeredDecimalOdds` separate.
   Compute model-market edge as `pModel - pMarketFair` using EVCore.
   For this diagnostic's `find_edge` / `kelly_criterion`, pass **pModel as
   fair_prob and 1/offeredDecimalOdds as market_prob**. Its returned edge is
   the difference versus the raw offered price, not EVCore's de-vig edge.
   EV is `pModel * offeredDecimalOdds - 1`; never substitute a fair price for
   the actual payout. This equivalence only covers binary win/loss settlement.
3. Use EVCore settlement math for voids, pushes and Asian handicap partial
   wins/losses. Do not apply the binary formula to those markets blindly.
4. Use `parlay_analysis` only as an explicitly independent-legs illustration.
   The wrapper rejects nonzero correlation: the upstream scalar correction is
   a heuristic, not a fitted joint distribution. Use EVCore guardrails and
   calibration for real coupons. Five 70% independent legs win together only
   about 16.8% of the time.
5. Treat Kelly as a theoretical output, not a stake instruction. Negative
   Kelly means no bet; do not turn it into a negative stake. Any simulation
   must state bankroll, fraction, caps and exposure assumptions.
6. Label arbitrage output theoretical before fees, limits, rounding and
   execution changes. Verify matching settlement rules across bookmakers.
   A price move alone does not prove informed money. Never place bets.

Report supplied data, assumptions, computed values, missing information and
the relevant EVCore function. Do not claim verified profitability from a skill.

Read [provenance](references/provenance.json) for the exact upstream commit and
hashes. [Original instructions](references/upstream-skill.md) are retained for
traceability, not as the EVCore operating procedure. Preserve `LICENSE` and
byte-exact upstream files on updates; review changes before refreshing pins.
