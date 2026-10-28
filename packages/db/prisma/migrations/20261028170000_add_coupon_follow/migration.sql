-- CreateTable
CREATE TABLE "coupon_follow" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "couponProposalId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_follow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupon_follow_userId_idx" ON "coupon_follow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_follow_couponProposalId_userId_key" ON "coupon_follow"("couponProposalId", "userId");

-- AddForeignKey
ALTER TABLE "coupon_follow" ADD CONSTRAINT "coupon_follow_couponProposalId_fkey" FOREIGN KEY ("couponProposalId") REFERENCES "coupon_proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_follow" ADD CONSTRAINT "coupon_follow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

