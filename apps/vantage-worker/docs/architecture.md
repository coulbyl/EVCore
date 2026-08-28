# VANTAGE — architecture & rationale

This document is the "why", not the "how to run it" (that's the [README](../README.md)). It exists so a future reader — including a future you — doesn't have to reconstruct the reasoning from a chat log.

## What VANTAGE is, precisely

VANTAGE is a 20th `StrategyChannel`. Like GOALS or DOMINANT, it can produce a `ChannelDecision` with a `ChannelSelection` (market, pick, probability) that the coupon composer can pick up, and it is tracked on Historique vérifiable exactly like every other channel — same ROI, same hit rate, same "a negative channel stays displayed as negative."

What makes it different is only its _source_: every other channel computes its pick from Poisson/statistical math over structured data. VANTAGE's pick — when it has one — comes from an LLM reading the other 19 channels' decisions on one match, plus their measured reliability on that competition.

**What VANTAGE explicitly does not do:**

- It never changes another channel's score, pick, or probability. It only ever proposes its own selection, under its own channel name.
- It never influences the deterministic scoring loop. `ModelRun.llmDelta`/`ModelRun.openclawRaw` (the fields EVCORE.md §14.3 reserved for a scoring-loop LLM integration) are untouched — VANTAGE writes to `ChannelDecision`/`ChannelSelection` only, the same tables every channel writes to.
- It never picks by default. The common case — reading a match and finding nothing worth flagging — is `verdict: "no_play"`, stored as `status: REJECTED`, same as any other channel passing on a match.
- It never invents a market. Its output is validated against the exact same `Market` enum every strategy in `@evcore/analysis-core` uses, plus a second check that the _pick_ is a legal value for that specific market (see `src/vantage/known-picks.ts`) — a hallucinated pick like `{ market: "BTTS", pick: "Home wins comfortably" }` cannot reach the database.

## Why a channel, not a scoring-loop LLM

EVCORE.md §14.3 already describes an "OpenClaw" component: an LLM that refines the deterministic score by up to 30%, gated behind a "not before MVP validation, needs a deterministic ROI/Brier baseline first" rule, and constrained to emit "un delta numérique... jamais un raisonnement narratif que le système interpréterait librement."

VANTAGE deliberately does not go through that door. Two reasons:

1. **It doesn't need to.** The scoring-loop integration exists to _blend_ an LLM opinion into an existing pick. VANTAGE doesn't blend — it proposes its own, separately tracked pick. That sidesteps the 30% cap, the "not before MVP" gate, and the human-approval requirement for introducing an LLM into the scoring loop entirely, because none of those rules are about _this_.
2. **A channel is the honest unit of trust this system already has.** "Read the data, propose a pick, get measured against real outcomes, earn (or lose) trust over time via calibration, never ROI" is exactly the admission process every channel already goes through (see project memory: _admission par calibration_ — ratio réel/annoncé, never ROI, every non-meta channel is admitted and the composer chooses). Wrapping VANTAGE in a new, bespoke trust mechanism would just be reinventing that.

VANTAGE is **not** added to `META_STRATEGY_CHANNELS` (CONSENSUS/CONTRARIAN/AVOID) even though, like them, it reads `previousDecisions` before running — because unlike them, it emits a real, slippable pick. It is a normal channel that happens to run after every other channel has decided, and happens to be computed by an LLM instead of a formula.

## Why a match-first read, not a market-first scan

Every existing channel is market-first: GOALS scans _every_ match for one fixed market (goals over/under); DOMINANT scans every match for the match-winner market. VANTAGE is match-first: for _one_ match, it reads everything available and only then decides _if_ there's a play and _which_ market it's on. Its `allowedMarkets` is effectively the whole `Market` enum, not one fixed lane — the market is part of its per-match conclusion, not its identity.

Concrete example that motivated this shape: on a real fixture, `RESULT_BTTS` had picked "Away + BTTS No" (lost, final score 2-1 — both teams scored, home won). VANTAGE's job is exactly to notice, from the _other_ channels' own numbers, that the home team's defensive channels (`CLEAN_SHEET_HOME` at 32%, `WIN_TO_NIL_HOME` at 22%) were themselves unconvinced — and propose `RESULT_BTTS: HOME_YES` as its own, separate line, next to (not replacing) `RESULT_BTTS`'s own pick. Both lines stay visible. The match becomes a real data point for whether VANTAGE is worth trusting.

## The two-layer validation VANTAGE's output must pass

1. **Zod schema** (`src/vantage/response-schema.ts`) — a discriminated union on `verdict` (`"no_play" | "play"`), with `market` restricted to the `Market` enum and `probability` bounded to `(0.01, 0.99)`. This is the hard boundary CLAUDE.md requires for any LLM output: a non-conforming response is rejected outright, never partially trusted.
2. **Pick legality** (`src/vantage/known-picks.ts`) — Zod alone proves "this string is a real market", not "this pick is real for _that_ market". A second, market-aware check (fixed lists for simple markets, regex patterns for combinatorial ones like `RESULT_BTTS` or `CORRECT_SCORE`) closes that gap.

Both checks fail closed: anything that doesn't pass is logged with the raw response and dropped, never persisted half-formed.

`temperature: 0` on every call, per EVCORE.md's reproducibility guardrail — every VANTAGE decision should be replayable from its logged input.

## What the research says (and why the model choice matters less than you'd think)

Three 2026 benchmarks specifically evaluate LLMs as football forecasters (WC2026-Agents on 104 World Cup matches, LLM-SoccerArena across seven frontier models, AI World Cup 2026). The findings, bluntly:

- **No model is a "sports betting specialist."** Seven frontier LLMs (GPT-5.5, Claude Opus 4.8, Gemini 3.1 Pro, Grok 4.3, DeepSeek V4, Qwen 3.7 Max, Mistral Large) produced statistically indistinguishable calibration (Brier 0.506–0.546, no pairwise difference survives correction).
- **The betting market beats every LLM agent tested** (market Brier 0.4688 vs. 0.4706–0.4828 for the four agents in the World Cup benchmark). "Fading the market is unprofitable for every agent" is the paper's own phrase.
- **Calibration and profitability are not the same thing.** Two agents with near-identical Brier scores (Grok, Claude) landed at +10.3% and −18.1% ROI respectively — the gap was in how each turned a probability into a stake, not in the probability itself. This is the exact failure mode this project already measured on its own channels (claimed edge is anti-predictive) — now confirmed independently, on LLMs, by outside research.
- **Search/context access mattered more than model choice** — open-book forecasting (real web access to news) improved Brier scores by 4.3%, a bigger effect than any model-vs-model difference measured.

Practical consequence: VANTAGE runs on `openai/gpt-oss-120b` (Groq) not because it's "the best" model for this — no such thing was found to exist — but because it's cheap, fast, and Groq-hosted (the project's only sanctioned LLM provider). The effort that matters is the quality of the context VANTAGE receives and the discipline of measuring it afterward, not the model name.

## Cost

**Verdict call only** (the always-on path) — estimated ~1400 input tokens (context) + ~250 output tokens (verdict + reasoning), on `gpt-oss-120b` ($0.15/$0.60 per M tokens) ≈ $0.0004/match:

| Scope                                                                        | Matches/day (12-month avg) | Cost/month  |
| ---------------------------------------------------------------------------- | -------------------------- | ----------- |
| All 68 active competitions (`VANTAGE_COMPETITION_CODES` empty — the default) | ~68–130                    | ~$0.75–1.40 |

Budget is not a constraint at this scope, which is why VANTAGE runs on every active competition from day one — there is no separate "pilot league list" to configure. See Situational research below for the one thing that _does_ change the math.

## Situational research (the "ouverture à internet" lever)

`VANTAGE_ENABLE_RESEARCH=true` adds one `groq/compound-mini` call per fixture, before the verdict call, giving VANTAGE real web search (Groq's native web-search tool, backed by Tavily) for team news, injuries, and match context the deterministic pipeline can never see by construction (`ETL rules: never infer or fill missing data`).

**Why it's a second, separate call rather than one combined call.** Groq's documentation does not confirm that `groq/compound`'s autonomous web search can be combined with `response_format: json_object` in the same request. Rather than gamble on an undocumented combination for the one part of the pipeline that must never emit malformed output, VANTAGE composes two well-documented calls: `groq/compound-mini` researches and returns a summary + citations (`src/groq/research.ts`), then that summary is handed to the _existing_, unchanged verdict call (`gpt-oss-120b`, `response_format: json_object`, Zod-validated) as extra context. If research fails or returns nothing, it degrades to `null` silently — the verdict call still runs on channel data alone, exactly as it did before this feature existed.

**Why it defaults to OFF, and why it has its own league list.** Unlike the verdict call, Groq bills web search **per request** ($5–8 per 1000 searches), on top of token costs — a flat fee that does not shrink to negligible at scale the way per-token pricing does. At full 68-league volume that alone would run ~$10–20/month, consuming the entire stated budget before token costs even enter the picture. So research is scoped independently from the verdict pipeline via `VANTAGE_RESEARCH_COMPETITION_CODES`, defaulting to "les grands championnats" — Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, Europa League, Europa Conference League (`PL,LL,BL1,SA,L1,UCL,UEL,UECL`) — rather than to every league VANTAGE covers:

| Scope                                                         | Matches/day (est.) | Cost/month (search fee, 1 search/match, Basic tier) |
| ------------------------------------------------------------- | ------------------ | --------------------------------------------------- |
| 8 "grands championnats" (the default)                         | ~8-12              | ~$1.50-2                                            |
| All 68 leagues (`VANTAGE_RESEARCH_COMPETITION_CODES` widened) | 68-130             | ~$10-20                                             |

VANTAGE still writes a verdict on every fixture across all 68 competitions either way — `VANTAGE_COMPETITION_CODES` (verdict scope) and `VANTAGE_RESEARCH_COMPETITION_CODES` (research scope) are two independent lists, not the same knob. A match outside the research list simply gets the channel-only verdict, exactly as if research were off entirely for that match.

**Audit.** Every citation VANTAGE's research step returns is stored in `ChannelDecision.reasonDetails.researchCitations` alongside the verdict's own reasoning — never inferred or summarized away. The prompt explicitly tells the model that research is supplementary and must never stand in for a channel citation (`prompt.ts` — "un article de presse ne suffit jamais à lui seul à justifier un verdict"), so the audit trail should always show a citation to a _measured channel_, with research citations present only when they actually mattered.

## Rollout

**Phase 1 — verdict everywhere, research on the grands championnats, read narrowly.** VANTAGE writes a verdict on all 68 active competitions from day one (see Cost — no budget reason to restrict it). `VANTAGE_ENABLE_RESEARCH=true` with the default `VANTAGE_RESEARCH_COMPETITION_CODES` (Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, Europa League, Europa Conference League) adds real web search on those leagues only, for ~$1.50-2/month. What stays narrow beyond that is _human attention_: actually reading `reasonDetails` on those same well-known leagues first, where a bad call is recognizable without needing to trust the number blindly.

**Phase 2 — admission review.** Once VANTAGE has enough settled selections (the same 50-bet minimum every channel needs before any weight decision), run it through the exact same calibration audit as every other channel: ratio réel/annoncé, never ROI. No shortcut, no "it's an LLM so it gets a grace period." Compare the grands-championnats (research-assisted) selections against the rest (channel-only) — this is the natural A/B to check whether research is actually earning its cost.

**Phase 3 — widen research, or don't.** Grow `VANTAGE_RESEARCH_COMPETITION_CODES` past the default six only once Phase 2's A/B shows research measurably improves calibration over the channel-only baseline — not on a timer, not because the budget allows it. If VANTAGE underperforms anywhere, the fix is the same as any other channel: recalibrate, don't disable (project convention — a channel that loses is a channel to tune, not switch off).

**Never in scope without a separate, explicit decision:** feeding VANTAGE's output back into the deterministic score (the EVCORE.md §14.3 scoring-loop door), or letting it drive automatic staking. Both require the human-approval step CLAUDE.md already reserves for "introducing OpenClaw into the scoring loop" — VANTAGE existing as a channel does not imply that door is now open.
