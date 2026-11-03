-- Phase 3 of docs/plan-strategies-2026-11-03.md: eight new odds markets,
-- collected and settled before any product shows them, and the squads that
-- identify the players their odds name.
--
-- One migration is enough: Postgres (>= 12) accepts ADD VALUE inside a
-- transaction as long as nothing in that transaction uses the new value,
-- and nothing below does.

-- AlterEnum
ALTER TYPE "public"."Market" ADD VALUE IF NOT EXISTS 'CORNERS_HOME';
ALTER TYPE "public"."Market" ADD VALUE IF NOT EXISTS 'CORNERS_AWAY';
ALTER TYPE "public"."Market" ADD VALUE IF NOT EXISTS 'CORNERS_1X2';
ALTER TYPE "public"."Market" ADD VALUE IF NOT EXISTS 'GOAL_SCORER_ANYTIME';
ALTER TYPE "public"."Market" ADD VALUE IF NOT EXISTS 'GOAL_SCORER_FIRST';
ALTER TYPE "public"."Market" ADD VALUE IF NOT EXISTS 'PLAYER_SHOTS';
ALTER TYPE "public"."Market" ADD VALUE IF NOT EXISTS 'PLAYER_SHOTS_ON_TARGET';
ALTER TYPE "public"."Market" ADD VALUE IF NOT EXISTS 'MINUTE_1X2';

-- AlterTable: the last squad answer written, so the weekly sync retries only
-- what is due.
ALTER TABLE "public"."team" ADD COLUMN "squadSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."player_squad" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "teamId" UUID NOT NULL,
    "playerExternalId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER,
    "position" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_squad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_squad_playerExternalId_idx" ON "public"."player_squad"("playerExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "player_squad_teamId_playerExternalId_key" ON "public"."player_squad"("teamId", "playerExternalId");

-- AddForeignKey
ALTER TABLE "public"."player_squad" ADD CONSTRAINT "player_squad_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
