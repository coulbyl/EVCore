# API Comparison (<= $30/month) — EVCore

Updated: February 27, 2026  
Scope: EVCore MVP/Mois 2 (fixtures, results, pre-match odds snapshots, no live betting).

## Decision context

You set a hard budget of **max $30/month** and a workflow where coupons are generated before 05:00 (no live betting loop all day).  
This heavily favors providers with broad endpoint coverage and predictable quotas.

## Official pricing snapshot

### 1) API-FOOTBALL (API-SPORTS)

- **Pro**: **$19/month**, **7,500 requests/day**
- **Ultra**: **$29/month**, **75,000 requests/day**
- Includes fixtures, livescore, standings, injuries, **pre-match odds**, in-play odds (not required now).
- Note: free plan has season limits.

Fit for EVCore:

- Strong fit if you want **one provider** for core football + odds.
- Under budget with `Pro` or `Ultra`.

### 2) football-data.org (+ odds add-on route)

- **Free w/ Livescores**: **€12/month**, 20 calls/minute (fixtures/schedules/tables/livescores)
- **Odds Add-On**: **€15/month** (pre-match 1X2 odds add-on)
- Combined can land around **€27/month** (before VAT/fees; depends on exact base plan/add-on constraints).

Fit for EVCore:

- Good for fixtures/results quality and stable football feed.
- Odds are add-on based, less unified than API-FOOTBALL.
- Still generally within a ~30 USD/EUR budget band, but watch add-on limits and VAT.

### 3) The Odds API

- **20K plan**: **$30/month**, 20,000 credits/month, includes historical odds.
- Strong odds product, but this is **odds-only**; you still need another football data source for fixtures/results.

Fit for EVCore:

- Great odds fallback/secondary source.
- As primary single-provider strategy, not enough (you still need another API).

## Practical recommendation for EVCore

### Recommended primary choice under $30/month

1. **API-FOOTBALL Pro ($19)** for MVP/Mois 2 (selected baseline).
2. **API-FOOTBALL Ultra ($29)** as direct upgrade path when quota pressure appears.

Why:

- One integration surface (lower complexity).
- Includes odds + football core endpoints in the same plan family.
- Matches your non-live workflow (scheduled snapshots before coupon generation).
- Keeps cost headroom while preserving a straightforward scaling path (`Pro -> Ultra`).

### When to choose a dual-provider setup instead

Choose dual-provider only if you explicitly want redundancy/quality cross-checks:

- `football-data.org` for fixtures/results authority
- plus a dedicated odds provider (API-FOOTBALL or The Odds API)

This improves resilience but increases integration cost and ops complexity.

## Suggested usage model (with your 05:00 cutoff)

- Fixtures/schedules: cache locally, refresh a few times/day.
- Results: refresh around match windows.
- Odds: 1-2 snapshots in pre-coupon window (e.g., 04:30 + 04:55), then freeze coupon generation.
- Read from local DB for app logic; avoid querying external APIs per user request.

## Sources (official pages)

- API-FOOTBALL pricing: https://www.api-football.com/pricing/
- API-SPORTS football product page: https://api-sports.io/sports/football
- football-data.org pricing: https://www.football-data.org/pricing
- The Odds API pricing: https://the-odds-api.com/
- The Odds API historical docs: https://the-odds-api.com/historical-odds-data/
