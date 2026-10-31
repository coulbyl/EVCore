-- CreateTable
CREATE TABLE "public"."product_day" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "product" TEXT NOT NULL,
    "forDate" DATE NOT NULL,
    "couponProposalId" UUID NOT NULL,
    "outcome" TEXT NOT NULL,
    "chance" DECIMAL(5,4),
    "paidOdds" DECIMAL(8,3),
    "priced" BOOLEAN NOT NULL,
    "label" TEXT NOT NULL,
    "market" TEXT,
    "pick" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_day_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_day_product_forDate_key" ON "public"."product_day"("product", "forDate");

-- CreateIndex
CREATE INDEX "product_day_forDate_idx" ON "public"."product_day"("forDate");

-- AddForeignKey
ALTER TABLE "public"."product_day" ADD CONSTRAINT "product_day_couponProposalId_fkey" FOREIGN KEY ("couponProposalId") REFERENCES "public"."coupon_proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
