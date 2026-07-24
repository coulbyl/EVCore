-- CreateTable
CREATE TABLE "coach_tenure" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "teamId" UUID NOT NULL,
    "coachName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_tenure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_tenure_teamId_startDate_idx" ON "coach_tenure"("teamId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "coach_tenure_teamId_coachName_startDate_key" ON "coach_tenure"("teamId", "coachName", "startDate");

-- AddForeignKey
ALTER TABLE "coach_tenure" ADD CONSTRAINT "coach_tenure_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
