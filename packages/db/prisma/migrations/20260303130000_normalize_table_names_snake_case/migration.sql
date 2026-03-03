-- Normalize physical table names to snake_case.
-- Safe for current state (pre-prod) and keeps all existing data/constraints/indexes.

ALTER TABLE "Competition" RENAME TO "competition";
ALTER TABLE "Season" RENAME TO "season";
ALTER TABLE "Team" RENAME TO "team";
ALTER TABLE "Fixture" RENAME TO "fixture";
ALTER TABLE "TeamStats" RENAME TO "team_stats";
ALTER TABLE "ModelRun" RENAME TO "model_run";
ALTER TABLE "Bet" RENAME TO "bet";
ALTER TABLE "AdjustmentProposal" RENAME TO "adjustment_proposal";
ALTER TABLE "MarketSuspension" RENAME TO "market_suspension";
ALTER TABLE "OddsSnapshot" RENAME TO "odds_snapshot";
