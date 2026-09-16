CREATE TABLE "coupon_generation_attempt" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "forDate" DATE NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "pass" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "candidateCount" INTEGER NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "proposalId" UUID,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupon_generation_attempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coupon_generation_attempt_forDate_policyVersion_idx"
  ON "coupon_generation_attempt"("forDate", "policyVersion");
CREATE INDEX "coupon_generation_attempt_generatedAt_idx"
  ON "coupon_generation_attempt"("generatedAt");
