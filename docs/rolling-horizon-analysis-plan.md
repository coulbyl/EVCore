# Rolling Horizon Analysis Plan

## Objective

Allow the backend to pre-analyze upcoming fixtures on a rolling horizon:

- `J+1` remains the primary daily target and is always refreshed
- `J+2`, `J+3`, `J+4` are preloaded and pre-analyzed for product visibility
- future days never block the regular `J+1` rerun

This is designed for the current ETL model where odds move over time and the latest analysis should remain the source of truth.

## Desired Behavior

Example on Tuesday, June 2, 2026:

- normal daily run for Wednesday, June 3, 2026 (`J+1`)
- additional warm runs for:
  - Thursday, June 4, 2026 (`J+2`)
  - Friday, June 5, 2026 (`J+3`)
  - Saturday, June 6, 2026 (`J+4`)

Then on Wednesday, June 3, 2026:

- rerun Thursday, June 4, 2026 as fresh `J+1`
- warm-run Friday, June 5, 2026 through Sunday, June 7, 2026

This creates a sliding window rather than a fixed weekly snapshot.

## Why This Model

### Benefits

- gives users early visibility over the week
- preserves the current daily `J+1` workflow
- keeps odds refresh compatible with line movement
- avoids treating early-week analyses as final

### Constraints

- odds are not always available several days early
- bookmaker coverage is uneven, especially for `FRI`
- analysis itself is cheap; data loading is the expensive part

## Current State

Relevant existing pieces:

- [etl.service.ts](/home/fannancoulibaly/lab/EVCore/apps/backend/src/modules/etl/etl.service.ts)
- [odds-prematch-sync.worker.ts](/home/fannancoulibaly/lab/EVCore/apps/backend/src/modules/etl/workers/odds-prematch-sync.worker.ts)
- [betting-engine-analysis.worker.ts](/home/fannancoulibaly/lab/EVCore/apps/backend/src/modules/etl/workers/betting-engine-analysis.worker.ts)
- [betting-engine.service.ts](/home/fannancoulibaly/lab/EVCore/apps/backend/src/modules/betting-engine/betting-engine.service.ts)

Current behavior:

- `odds-prematch-sync` supports one target date
- `betting-engine-analysis` supports one target date
- ETL scheduling runs only for `J+1`

## Non-Goals

- no rewrite of the betting model
- no attempt to freeze a whole week of picks on Monday
- no change to bookmaker priority policy
- no mandatory backfill of injuries or stats for future days beyond current behavior

## Proposed Architecture

Add a new orchestration layer for a rolling horizon.

### New Concept

Introduce a `rolling horizon` ETL operation that enqueues:

1. `odds-prematch-sync(date)`
2. `betting-engine-analysis(date)`

for a configurable list of dates:

- default horizon: `1..4`
- ordered from nearest to farthest

### Important Rule

The system must treat each day independently:

- `J+1` is always rerun even if it was already analyzed yesterday as `J+2`
- each new run may create a fresher `modelRun`
- the latest run is the current operational truth

## Implementation Plan

### Phase 1: Add a Range-Orchestrator in ETL

Add a new ETL service method, for example:

```ts
triggerRollingHorizonAnalysis(options?: {
  startOffsetDays?: number;
  horizonDays?: number;
})
```

Default behavior:

- `startOffsetDays = 1`
- `horizonDays = 4`

This method should enqueue, in order:

1. `odds-prematch-sync` for `J+1`
2. `betting-engine-analysis` for `J+1`
3. `odds-prematch-sync` for `J+2`
4. `betting-engine-analysis` for `J+2`
5. ...
6. up to `J+4`

This should be implemented in:

- [etl.service.ts](/home/fannancoulibaly/lab/EVCore/apps/backend/src/modules/etl/etl.service.ts)

### Phase 2: Add Explicit ETL Endpoint

Expose a dedicated route such as:

- `POST /etl/sync/analysis-horizon`

Body example:

```json
{
  "startOffsetDays": 1,
  "horizonDays": 4
}
```

This keeps the feature operator-friendly and testable without changing current routes.

Target file:

- [etl.controller.ts](/home/fannancoulibaly/lab/EVCore/apps/backend/src/modules/etl/etl.controller.ts)

### Phase 3: Add Scheduler Support

After manual validation, add a scheduler entry that runs daily and triggers the rolling horizon orchestrator.

Recommended initial pattern:

- keep existing `J+1` schedulers unchanged during rollout
- add horizon orchestration behind a feature flag or env toggle

Suggested toggle:

- `ETL_ENABLE_ROLLING_HORIZON=true`

Suggested horizon config:

- `ETL_ROLLING_HORIZON_DAYS=4`

Target files:

- [etl.constants.ts](/home/fannancoulibaly/lab/EVCore/apps/backend/src/config/etl.constants.ts)
- [etl.service.ts](/home/fannancoulibaly/lab/EVCore/apps/backend/src/modules/etl/etl.service.ts)

### Phase 4: Preserve Idempotent Daily Refresh

Do not deduplicate future-day analysis too aggressively.

Allowed behavior:

- multiple analyses for the same fixture before kickoff
- latest `modelRun` supersedes previous ones operationally

Not allowed:

- skipping `J+1` because the same fixture was already analyzed yesterday

This likely requires no schema change if current `modelRun` history is already retained.

### Phase 5: Improve Observability

Add structured logs around horizon execution:

- target date
- queue step (`odds` vs `analysis`)
- job order
- elapsed duration
- analyzed count
- skipped count

Add dashboard visibility later if useful:

- horizon dates attempted
- dates with no odds yet
- dates with zero analyzed fixtures

## Data Freshness Policy

Use two operational categories:

### Warm Analysis

Used for `J+2..J+4`

- may lack odds
- may produce `NO_BET`
- useful for early previews and monitoring

### Fresh Analysis

Used for `J+1`

- must always rerun
- uses latest available odds
- becomes the decision-grade run

## API Budget Impact

### Key Point

The expensive part is not analysis.

Analysis reads the database.

The quota impact comes mainly from:

- `fixtures-sync`
- `stats-sync`
- `injuries-sync`
- `odds-prematch-sync`

`elo-sync` is effectively fixed-cost and negligible in comparison.

### Expected Additional Cost

The main new cost is multi-day `odds-prematch-sync`.

Approximation:

- `1 API call` per scheduled fixture per target date

So a horizon of 4 days costs approximately:

- `sum of scheduled fixtures across J+1..J+4`

This is usually manageable under `7500 req/day`, but should still be monitored.

### Safety Rules

- keep horizon length configurable
- log per-date fixture counts before enqueueing
- allow operators to reduce horizon from `4` to `2` quickly if needed

## Suggested Rollout

### Step 1

Implement manual endpoint only.

### Step 2

Test with:

- `J+1..J+2`
- one quiet weekday
- one heavy matchday

### Step 3

Extend to `J+1..J+4`.

### Step 4

Enable scheduler automation.

## Testing Plan

### Unit Tests

Add tests in:

- [etl.service.spec.ts](/home/fannancoulibaly/lab/EVCore/apps/backend/src/modules/etl/etl.service.spec.ts)
- [etl.controller.spec.ts](/home/fannancoulibaly/lab/EVCore/apps/backend/src/modules/etl/etl.controller.spec.ts)

Test cases:

- enqueues `odds-prematch-sync` then `analysis` for each date
- preserves ordering from nearest to farthest date
- honors custom horizon length
- honors custom start offset

### Integration Expectations

Verify on a real run:

- `J+1` gets rerun the next day even if already analyzed
- `J+2..J+4` create warm model runs
- missing odds do not break the orchestration

## Open Questions

1. Should `injuries-sync` also be extended to the same horizon for future fixtures?
2. Should AI coupon generation run only for `J+1`, or for all horizon dates?
3. Should the UI distinguish warm vs fresh runs explicitly?

## Recommendation

Start with:

- rolling horizon on `odds-prematch-sync + betting-engine-analysis` only
- horizon `J+1..J+4`
- manual trigger first
- daily rerun of `J+1` always preserved

This delivers the requested user behavior with minimal architectural risk and no major pressure on the current API plan.
