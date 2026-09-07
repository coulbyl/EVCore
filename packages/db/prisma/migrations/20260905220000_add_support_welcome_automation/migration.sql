-- DropIndex
DROP INDEX "support_conversation_userId_idx";

-- CreateIndex
-- One conversation per user, enforced at the DB level — previously only a
-- plain index, which let a socket-reconnect race create a second row.
CREATE UNIQUE INDEX "support_conversation_userId_key" ON "support_conversation"("userId");

-- AlterTable
-- An AUTOMATED message has no human sender.
ALTER TABLE "support_message" ALTER COLUMN "senderId" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "SupportMessageKind" AS ENUM ('STANDARD', 'AUTOMATED');

-- AlterTable
ALTER TABLE "support_message"
ADD COLUMN     "kind" "SupportMessageKind" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "automationKey" TEXT;

-- CreateIndex
-- The idempotence guarantee for automated messages (welcome, future
-- reminders…): at most one row per (conversationId, automationKey).
-- Postgres treats multiple NULLs as distinct, so this never constrains
-- ordinary STANDARD messages (automationKey always null there).
CREATE UNIQUE INDEX "support_message_conversationId_automationKey_key" ON "support_message"("conversationId", "automationKey");
