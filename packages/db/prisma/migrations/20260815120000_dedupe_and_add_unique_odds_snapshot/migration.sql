-- Dedupe odds_snapshot before enforcing uniqueness.
--
-- Context: an ETL insert bug (fixed 2026-08-13, no new duplicates created
-- since 2026-08-14) let the same (fixtureId, bookmaker, market, pick,
-- snapshotAt) key get inserted more than once. As of 2026-08-15 this affects
-- 510,028 groups / 1,307,872 rows (~41% of the table). In 501,749 of those
-- groups every copy has identical odds (pure insert duplication). In 8
-- groups (all Unibet/DOUBLE_CHANCE) the snapshotAt bucket was reused across
-- distinct real ETL fetches and the odds genuinely moved between them.
--
-- Keeping the row with the latest createdAt per key is safe for both cases:
-- a no-op where values are identical, and the most current real price where
-- they differ.
DELETE FROM odds_snapshot os USING (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY "fixtureId", bookmaker, market, pick, "snapshotAt"
      ORDER BY "createdAt" DESC, id DESC
    ) AS rn
  FROM odds_snapshot
) dupes
WHERE os.id = dupes.id
  AND dupes.rn > 1;

-- AlterTable
ALTER TABLE "odds_snapshot"
  ADD CONSTRAINT "odds_snapshot_fixtureId_bookmaker_market_pick_snapshotAt_key"
  UNIQUE ("fixtureId", "bookmaker", "market", "pick", "snapshotAt");

-- DropIndex
-- Superseded by the unique index above (same leading columns, still serves
-- any query that filtered on a prefix of this key).
DROP INDEX IF EXISTS "odds_snapshot_fixtureId_bookmaker_market_pick_snapshotAt_idx";
