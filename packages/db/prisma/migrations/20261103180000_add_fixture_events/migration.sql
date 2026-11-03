-- Phase 2 of docs/plan-strategies-2026-11-03.md: match events, lineups and
-- per-player statistics from API-Football /fixtures?ids=, and the players
-- they name. fixture."eventsSyncedAt" records what was reported, so the
-- events backfill retries only what is still missing.

-- CreateEnum
CREATE TYPE "public"."FixtureEventType" AS ENUM ('GOAL', 'CARD', 'SUBSTITUTION', 'VAR');

-- AlterTable
ALTER TABLE "public"."fixture" ADD COLUMN     "eventsSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."player" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "externalId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "firstname" TEXT,
    "lastname" TEXT,
    "nationality" TEXT,
    "birthDate" DATE,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fixture_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "fixtureId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,
    "extraMinute" INTEGER,
    "type" "public"."FixtureEventType" NOT NULL,
    "detail" TEXT NOT NULL,
    "comments" TEXT,
    "playerExternalId" INTEGER,
    "playerName" TEXT,
    "assistExternalId" INTEGER,
    "assistName" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixture_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fixture_lineup" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "fixtureId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "playerExternalId" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "number" INTEGER,
    "position" TEXT,
    "grid" TEXT,
    "starter" BOOLEAN NOT NULL,
    "formation" TEXT,
    "coachExternalId" INTEGER,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixture_lineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fixture_player_statistic" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "fixtureId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "playerExternalId" INTEGER NOT NULL,
    "minutes" INTEGER,
    "position" TEXT,
    "rating" DECIMAL(4,2),
    "substitute" BOOLEAN,
    "shotsTotal" INTEGER,
    "shotsOn" INTEGER,
    "goals" INTEGER,
    "assists" INTEGER,
    "saves" INTEGER,
    "passesTotal" INTEGER,
    "passesKey" INTEGER,
    "tackles" INTEGER,
    "foulsCommitted" INTEGER,
    "foulsDrawn" INTEGER,
    "yellow" INTEGER,
    "red" INTEGER,
    "offsides" INTEGER,
    "penaltyScored" INTEGER,
    "penaltyMissed" INTEGER,
    "raw" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixture_player_statistic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_externalId_key" ON "public"."player"("externalId");

-- CreateIndex
CREATE INDEX "fixture_event_fixtureId_type_idx" ON "public"."fixture_event"("fixtureId", "type");

-- CreateIndex
CREATE INDEX "fixture_event_playerExternalId_type_idx" ON "public"."fixture_event"("playerExternalId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "fixture_event_fixtureId_ordinal_key" ON "public"."fixture_event"("fixtureId", "ordinal");

-- CreateIndex
CREATE INDEX "fixture_lineup_playerExternalId_idx" ON "public"."fixture_lineup"("playerExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "fixture_lineup_fixtureId_teamId_playerExternalId_key" ON "public"."fixture_lineup"("fixtureId", "teamId", "playerExternalId");

-- CreateIndex
CREATE INDEX "fixture_player_statistic_playerExternalId_idx" ON "public"."fixture_player_statistic"("playerExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "fixture_player_statistic_fixtureId_teamId_playerExternalId_key" ON "public"."fixture_player_statistic"("fixtureId", "teamId", "playerExternalId");

-- CreateIndex
CREATE INDEX "fixture_eventsSyncedAt_scheduledAt_idx" ON "public"."fixture"("eventsSyncedAt", "scheduledAt");

-- AddForeignKey
ALTER TABLE "public"."fixture_event" ADD CONSTRAINT "fixture_event_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "public"."fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fixture_event" ADD CONSTRAINT "fixture_event_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fixture_lineup" ADD CONSTRAINT "fixture_lineup_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "public"."fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fixture_lineup" ADD CONSTRAINT "fixture_lineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fixture_player_statistic" ADD CONSTRAINT "fixture_player_statistic_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "public"."fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fixture_player_statistic" ADD CONSTRAINT "fixture_player_statistic_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

