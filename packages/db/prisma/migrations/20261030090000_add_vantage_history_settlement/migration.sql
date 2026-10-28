-- AlterTable
ALTER TABLE "vantage_decision_history" ADD COLUMN     "marginPaid" DECIMAL(5,4),
ADD COLUMN     "oddsBookmaker" TEXT,
ADD COLUMN     "oddsSnapshotAt" TIMESTAMP(3),
ADD COLUMN     "result" "BetStatus",
ADD COLUMN     "settledAt" TIMESTAMP(3);
