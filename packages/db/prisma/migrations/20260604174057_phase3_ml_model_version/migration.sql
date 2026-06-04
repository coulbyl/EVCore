-- CreateTable
CREATE TABLE "ml_model_version" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "segment" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "modelPath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "rollbackOfId" UUID,

    CONSTRAINT "ml_model_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ml_model_version_isActive_segment_idx" ON "ml_model_version"("isActive", "segment");

-- CreateIndex
CREATE INDEX "ml_model_version_segment_createdAt_idx" ON "ml_model_version"("segment", "createdAt");

-- CreateIndex
CREATE INDEX "model_run_analyzedAt_idx" ON "model_run"("analyzedAt");

-- AddForeignKey
ALTER TABLE "ml_model_version" ADD CONSTRAINT "ml_model_version_rollbackOfId_fkey" FOREIGN KEY ("rollbackOfId") REFERENCES "ml_model_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
