-- CreateTable
CREATE TABLE "prediction" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "fixtureId" UUID NOT NULL,
    "modelRunId" UUID NOT NULL,
    "competition" TEXT NOT NULL,
    "market" "Market" NOT NULL DEFAULT 'ONE_X_TWO',
    "pick" TEXT NOT NULL,
    "probability" DECIMAL(5,4) NOT NULL,
    "correct" BOOLEAN,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prediction_competition_createdAt_idx" ON "prediction"("competition", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "prediction_fixtureId_key" ON "prediction"("fixtureId");

-- AddForeignKey
ALTER TABLE "prediction" ADD CONSTRAINT "prediction_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction" ADD CONSTRAINT "prediction_modelRunId_fkey" FOREIGN KEY ("modelRunId") REFERENCES "model_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
