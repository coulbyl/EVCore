-- Remove the same-match synthetic combo system (COMBO_WHITELIST /
-- estimateComboOdds). Replaced by real bookmaker-priced pre-combined markets
-- (RESULT_TOTAL_GOALS, RESULT_BTTS). Does not touch BetSlipType.COMBO, which
-- is the unrelated user multi-pick bet slip feature.

ALTER TABLE "bet" DROP COLUMN "comboMarket";
ALTER TABLE "bet" DROP COLUMN "comboPick";

ALTER TABLE "channel_selection" DROP COLUMN "comboMarket";
ALTER TABLE "channel_selection" DROP COLUMN "comboPick";

ALTER TABLE "coupon_proposal_leg" DROP COLUMN "comboMarket";
ALTER TABLE "coupon_proposal_leg" DROP COLUMN "comboPick";
