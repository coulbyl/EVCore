-- Same-match combo support on coupon legs (DESIGN.md Étape 6).
-- A combo leg covers two correlated markets of one fixture; it wins only if BOTH
-- (market, pick) and (comboMarket, comboPick) hit. Null = normal single leg.
-- Both columns are nullable and backward-compatible: existing legs stay single.
ALTER TABLE "coupon_proposal_leg" ADD COLUMN "comboMarket" "Market";
ALTER TABLE "coupon_proposal_leg" ADD COLUMN "comboPick" TEXT;
