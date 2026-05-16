-- CreateTable
CREATE TABLE "standing" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "competitionId" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "teamApiId" INTEGER NOT NULL,
    "teamName" TEXT NOT NULL,
    "teamLogo" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "played" INTEGER NOT NULL,
    "win" INTEGER NOT NULL,
    "draw" INTEGER NOT NULL,
    "lose" INTEGER NOT NULL,
    "goalsFor" INTEGER NOT NULL,
    "goalsAgainst" INTEGER NOT NULL,
    "goalsDiff" INTEGER NOT NULL,
    "form" TEXT,
    "description" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "standing_competitionId_seasonId_teamApiId_key" ON "standing"("competitionId", "seasonId", "teamApiId");

-- AddForeignKey
ALTER TABLE "standing" ADD CONSTRAINT "standing_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standing" ADD CONSTRAINT "standing_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
