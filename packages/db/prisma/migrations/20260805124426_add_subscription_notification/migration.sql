-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_EVENTS_ADDED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_SETTLED';

-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "userId" UUID;

-- CreateIndex
CREATE INDEX "notification_userId_read_createdAt_idx" ON "notification"("userId", "read", "createdAt");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
