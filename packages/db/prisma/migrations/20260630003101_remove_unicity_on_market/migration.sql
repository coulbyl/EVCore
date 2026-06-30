-- DropIndex
DROP INDEX "bet_slip_item_betSlipId_fixtureId_key";

-- CreateIndex
CREATE INDEX "bet_slip_item_betSlipId_idx" ON "bet_slip_item"("betSlipId");
