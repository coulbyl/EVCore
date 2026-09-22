CREATE TYPE "StatisticSource" AS ENUM ('API_FOOTBALL');
CREATE TYPE "XgSource" AS ENUM ('API_FOOTBALL', 'SHOTS_PROXY');

ALTER TABLE "fixture"
  ADD COLUMN "homeXgSource" "XgSource",
  ADD COLUMN "awayXgSource" "XgSource",
  ADD COLUMN "statisticsSyncedAt" TIMESTAMP(3),
  ADD COLUMN "statisticsUnavailable" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "fixture_seasonId_status_statisticsSyncedAt_idx"
  ON "fixture"("seasonId", "status", "statisticsSyncedAt");

CREATE TABLE "fixture_statistic" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "fixtureId" UUID NOT NULL,
  "teamId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "value" DECIMAL(8,3) NOT NULL,
  "rawValue" TEXT,
  "source" "StatisticSource" NOT NULL DEFAULT 'API_FOOTBALL',
  "observedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fixture_statistic_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fixture_statistic_fixtureId_fkey"
    FOREIGN KEY ("fixtureId") REFERENCES "fixture"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fixture_statistic_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "team"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "fixture_statistic_fixtureId_teamId_type_source_key"
  ON "fixture_statistic"("fixtureId", "teamId", "type", "source");
CREATE INDEX "fixture_statistic_fixtureId_type_idx"
  ON "fixture_statistic"("fixtureId", "type");
CREATE INDEX "fixture_statistic_teamId_type_observedAt_idx"
  ON "fixture_statistic"("teamId", "type", "observedAt");

ALTER TABLE "team_stats"
  ADD COLUMN "shotsOnTargetFor" DECIMAL(7,3),
  ADD COLUMN "shotsOnTargetAgainst" DECIMAL(7,3),
  ADD COLUMN "totalShotsFor" DECIMAL(7,3),
  ADD COLUMN "totalShotsAgainst" DECIMAL(7,3),
  ADD COLUMN "cornersFor" DECIMAL(7,3),
  ADD COLUMN "cornersAgainst" DECIMAL(7,3),
  ADD COLUMN "cardsFor" DECIMAL(7,3),
  ADD COLUMN "cardsAgainst" DECIMAL(7,3),
  ADD COLUMN "possessionFor" DECIMAL(7,3),
  ADD COLUMN "possessionAgainst" DECIMAL(7,3),
  ADD COLUMN "statisticsMatchCount" INTEGER NOT NULL DEFAULT 0;
