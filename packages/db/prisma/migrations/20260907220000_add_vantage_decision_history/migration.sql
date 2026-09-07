-- CreateTable
CREATE TABLE "vantage_decision_history" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "fixtureId" UUID NOT NULL,
    "modelRunId" UUID NOT NULL,
    "status" "ChannelDecisionStatus" NOT NULL,
    "reasonCode" TEXT,
    "reasonDetails" JSONB,
    "configVersion" TEXT,
    "market" "Market",
    "pick" TEXT,
    "probability" DECIMAL(5,4),
    "odds" DECIMAL(6,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vantage_decision_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vantage_decision_history_fixtureId_createdAt_idx" ON "vantage_decision_history"("fixtureId", "createdAt");

-- CreateIndex
CREATE INDEX "vantage_decision_history_modelRunId_idx" ON "vantage_decision_history"("modelRunId");

-- AddForeignKey
ALTER TABLE "vantage_decision_history" ADD CONSTRAINT "vantage_decision_history_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vantage_decision_history" ADD CONSTRAINT "vantage_decision_history_modelRunId_fkey" FOREIGN KEY ("modelRunId") REFERENCES "model_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateView: convenience read for comparing VANTAGE's successive reads on
-- the same fixture over time (one row per vantage_decision_history entry,
-- already denormalized with team/competition/kickoff/ModelRun context) —
-- not modeled in Prisma (analysis-only, no application code reads it), plain
-- SQL for ad hoc querying. Not managed by Prisma migrate diff; edit this file
-- directly (DROP + CREATE) if the shape needs to change later.
CREATE VIEW "vantage_decision_timeline" AS
SELECT
  h."fixtureId",
  f."scheduledAt" AS "kickoff",
  ht.name AS "homeTeam",
  awt.name AS "awayTeam",
  comp.code AS "competitionCode",
  h."modelRunId",
  mr."analyzedAt",
  mr.phase AS "modelRunPhase",
  h.status,
  h.market,
  h.pick,
  h.probability,
  h.odds,
  h."reasonCode",
  h."reasonDetails"->>'text' AS "reasonText",
  h."configVersion",
  h."createdAt" AS "attemptAt"
FROM "vantage_decision_history" h
JOIN "fixture" f ON f.id = h."fixtureId"
JOIN "team" ht ON ht.id = f."homeTeamId"
JOIN "team" awt ON awt.id = f."awayTeamId"
JOIN "season" s ON s.id = f."seasonId"
JOIN "competition" comp ON comp.id = s."competitionId"
JOIN "model_run" mr ON mr.id = h."modelRunId"
ORDER BY h."fixtureId", h."createdAt";
