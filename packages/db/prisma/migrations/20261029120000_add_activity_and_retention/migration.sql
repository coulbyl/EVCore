-- CreateEnum
CREATE TYPE "ProductEventType" AS ENUM ('NOTIFICATION_OPENED', 'TOUR_COMPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MORNING_BRIEF';
ALTER TYPE "NotificationType" ADD VALUE 'WEEKLY_STATEMENT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "morningBriefEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "weeklyStatementEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "user_activity_day" (
    "userId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activity_day_pkey" PRIMARY KEY ("userId","day")
);

-- CreateTable
CREATE TABLE "product_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "type" "ProductEventType" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "product_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_activity_day_day_idx" ON "user_activity_day"("day");

-- CreateIndex
CREATE INDEX "product_event_type_at_idx" ON "product_event"("type", "at");

-- CreateIndex
CREATE INDEX "product_event_userId_at_idx" ON "product_event"("userId", "at");

-- AddForeignKey
ALTER TABLE "user_activity_day" ADD CONSTRAINT "user_activity_day_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_event" ADD CONSTRAINT "product_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Historique des jours actifs, reconstitué depuis les tables datées
-- existantes (2026-10-29) : un jour où le joueur a vu un coupon, en a suivi
-- ou déclaré un, a lu une annonce ou une notification, a fini une fiche,
-- a parlé à Eva ou au support, ou s'est connecté. Sous-estime les visites
-- qui ne laissaient aucune trace ; les jours suivants sont écrits à chaque
-- visite par AuthSessionGuard.
INSERT INTO "user_activity_day" ("userId", "day", "firstSeenAt")
SELECT "userId", (at AT TIME ZONE 'UTC')::date, min(at)
FROM (
  SELECT "userId", "createdAt" AS at FROM "coupon_proposal_view"
  UNION ALL SELECT "userId", "createdAt" FROM "coupon_follow"
  UNION ALL SELECT "userId", "createdAt" FROM "bet_slip"
  UNION ALL SELECT "userId", "createdAt" FROM "bankroll_transaction"
    WHERE type IN ('DEPOSIT', 'BET_PLACED')
  UNION ALL SELECT "userId", "readAt" FROM "announcement_read"
  UNION ALL SELECT "userId", "readAt" FROM "user_notification_read"
  UNION ALL SELECT "userId", "completedAt" FROM "user_content_progress"
  UNION ALL SELECT "userId", "day"::timestamp FROM "chat_usage"
  UNION ALL SELECT "senderId", "createdAt" FROM "support_message"
    WHERE "senderId" IS NOT NULL
  UNION ALL SELECT "userId", "createdAt" FROM "user_session"
) traces
JOIN "users" u ON u.id = traces."userId"
GROUP BY "userId", (at AT TIME ZONE 'UTC')::date
ON CONFLICT DO NOTHING;
