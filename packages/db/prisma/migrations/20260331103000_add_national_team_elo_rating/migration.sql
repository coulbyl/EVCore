CREATE TABLE "national_team_elo_rating" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "teamName" TEXT NOT NULL,
    "eloCode" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'eloratings.net',
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "national_team_elo_rating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "national_team_elo_rating_teamName_snapshotAt_key"
ON "national_team_elo_rating"("teamName", "snapshotAt");

CREATE INDEX "national_team_elo_rating_snapshotAt_idx"
ON "national_team_elo_rating"("snapshotAt");

CREATE INDEX "national_team_elo_rating_teamName_snapshotAt_idx"
ON "national_team_elo_rating"("teamName", "snapshotAt");

