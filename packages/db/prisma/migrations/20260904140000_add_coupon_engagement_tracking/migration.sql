-- CreateTable
CREATE TABLE "coupon_proposal_view" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "couponProposalId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_proposal_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_proposal_placement" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "couponProposalId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "betSlipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_proposal_placement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupon_proposal_view_couponProposalId_idx" ON "coupon_proposal_view"("couponProposalId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_proposal_view_couponProposalId_userId_key" ON "coupon_proposal_view"("couponProposalId", "userId");

-- CreateIndex
CREATE INDEX "coupon_proposal_placement_couponProposalId_idx" ON "coupon_proposal_placement"("couponProposalId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_proposal_placement_betSlipId_key" ON "coupon_proposal_placement"("betSlipId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_proposal_placement_couponProposalId_userId_key" ON "coupon_proposal_placement"("couponProposalId", "userId");

-- AddForeignKey
ALTER TABLE "coupon_proposal_view" ADD CONSTRAINT "coupon_proposal_view_couponProposalId_fkey" FOREIGN KEY ("couponProposalId") REFERENCES "coupon_proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_proposal_view" ADD CONSTRAINT "coupon_proposal_view_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_proposal_placement" ADD CONSTRAINT "coupon_proposal_placement_couponProposalId_fkey" FOREIGN KEY ("couponProposalId") REFERENCES "coupon_proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_proposal_placement" ADD CONSTRAINT "coupon_proposal_placement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_proposal_placement" ADD CONSTRAINT "coupon_proposal_placement_betSlipId_fkey" FOREIGN KEY ("betSlipId") REFERENCES "bet_slip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
