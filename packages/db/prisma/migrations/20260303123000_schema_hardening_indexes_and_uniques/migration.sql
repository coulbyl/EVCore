-- Schema hardening for first production:
-- 1) Add missing query-performance indexes.
-- 2) Enforce business uniqueness at DB level for active market suspensions.
-- 3) Enforce uniqueness for odds snapshots (with nullable pick split by market).
-- 4) Deduplicate legacy odds rows before creating unique indexes.

-- Fixture hot-path indexes
CREATE INDEX IF NOT EXISTS "Fixture_status_scheduledAt_idx"
  ON "Fixture" ("status", "scheduledAt");

CREATE INDEX IF NOT EXISTS "Fixture_seasonId_status_scheduledAt_idx"
  ON "Fixture" ("seasonId", "status", "scheduledAt");

CREATE INDEX IF NOT EXISTS "Fixture_homeTeamId_status_scheduledAt_idx"
  ON "Fixture" ("homeTeamId", "status", "scheduledAt");

CREATE INDEX IF NOT EXISTS "Fixture_awayTeamId_status_scheduledAt_idx"
  ON "Fixture" ("awayTeamId", "status", "scheduledAt");

-- ModelRun hot-path index (latest run by fixture)
CREATE INDEX IF NOT EXISTS "ModelRun_fixtureId_analyzedAt_idx"
  ON "ModelRun" ("fixtureId", "analyzedAt");

-- Bet hot-path indexes (risk and calibration windows)
CREATE INDEX IF NOT EXISTS "Bet_market_status_createdAt_idx"
  ON "Bet" ("market", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Bet_status_updatedAt_idx"
  ON "Bet" ("status", "updatedAt");

-- Adjustment proposal lookups
CREATE INDEX IF NOT EXISTS "AdjustmentProposal_status_appliedAt_idx"
  ON "AdjustmentProposal" ("status", "appliedAt");

CREATE INDEX IF NOT EXISTS "AdjustmentProposal_createdAt_idx"
  ON "AdjustmentProposal" ("createdAt");

-- Deduplicate legacy ONE_X_TWO rows before adding uniqueness
WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY "fixtureId", "bookmaker", "market", "snapshotAt"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "OddsSnapshot"
  WHERE "market" = 'ONE_X_TWO'
)
DELETE FROM "OddsSnapshot" o
USING ranked r
WHERE o.ctid = r.ctid
  AND r.rn > 1;

-- Deduplicate legacy non-1X2 rows before adding uniqueness
WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY "fixtureId", "bookmaker", "market", "pick", "snapshotAt"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "OddsSnapshot"
  WHERE "market" <> 'ONE_X_TWO'
    AND "pick" IS NOT NULL
)
DELETE FROM "OddsSnapshot" o
USING ranked r
WHERE o.ctid = r.ctid
  AND r.rn > 1;

-- Business uniqueness: at most one active suspension per market
CREATE UNIQUE INDEX IF NOT EXISTS "MarketSuspension_market_active_true_uniq"
  ON "MarketSuspension" ("market")
  WHERE "active" = true;

-- Business uniqueness: one ONE_X_TWO snapshot per fixture/bookmaker/timestamp
CREATE UNIQUE INDEX IF NOT EXISTS "OddsSnapshot_1x2_unique_snapshot"
  ON "OddsSnapshot" ("fixtureId", "bookmaker", "market", "snapshotAt")
  WHERE "market" = 'ONE_X_TWO';

-- Business uniqueness: one non-1X2 pick snapshot per fixture/bookmaker/market/pick/timestamp
CREATE UNIQUE INDEX IF NOT EXISTS "OddsSnapshot_market_pick_unique_snapshot"
  ON "OddsSnapshot" ("fixtureId", "bookmaker", "market", "pick", "snapshotAt")
  WHERE "market" <> 'ONE_X_TWO'
    AND "pick" IS NOT NULL;
