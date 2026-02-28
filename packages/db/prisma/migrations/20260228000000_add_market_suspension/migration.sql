-- CreateTable
CREATE TABLE "MarketSuspension" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "market" "Market" NOT NULL,
    "reason" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL DEFAULT 'auto',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "liftedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSuspension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketSuspension_market_active_idx" ON "MarketSuspension"("market", "active");
