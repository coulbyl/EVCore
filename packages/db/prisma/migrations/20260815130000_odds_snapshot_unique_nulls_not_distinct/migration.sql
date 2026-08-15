-- The @@unique added in 20260815120000 does not actually protect the
-- ONE_X_TWO market: `pick` is NULL for that market, and a standard unique
-- index treats every NULL as distinct from every other NULL — verified
-- empirically (two ONE_X_TWO rows with an identical key insert with zero
-- error). NULLS NOT DISTINCT (PG15+, this instance runs 18.3) makes NULL
-- values collide for uniqueness purposes, closing the race for ONE_X_TWO
-- the same way the constraint already closes it for every pick-bearing
-- market. Confirmed no residual ONE_X_TWO duplicates exist before applying.
ALTER TABLE "odds_snapshot"
  DROP CONSTRAINT "odds_snapshot_fixtureId_bookmaker_market_pick_snapshotAt_key";

ALTER TABLE "odds_snapshot"
  ADD CONSTRAINT "odds_snapshot_fixtureId_bookmaker_market_pick_snapshotAt_key"
  UNIQUE NULLS NOT DISTINCT ("fixtureId", "bookmaker", "market", "pick", "snapshotAt");
