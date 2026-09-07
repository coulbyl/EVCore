-- AlterTable
-- A voice note or a file sent with no caption has an attachment and no
-- text — the service layer rejects a message with neither.
ALTER TABLE "support_message" ALTER COLUMN "content" DROP NOT NULL;

-- CreateIndex
-- id is a uuidv7 (time-ordered by construction) — "load older messages"
-- pagination filters/orders by id, kept alongside the existing createdAt
-- index still used by the unread-count watermark queries.
CREATE INDEX "support_message_conversationId_id_idx" ON "support_message"("conversationId", "id");

-- CreateEnum
CREATE TYPE "SupportAttachmentKind" AS ENUM ('IMAGE', 'AUDIO', 'FILE');

-- CreateTable
CREATE TABLE "support_attachment" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "messageId" UUID NOT NULL,
    "kind" "SupportAttachmentKind" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileName" TEXT,
    "durationMs" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_attachment_messageId_key" ON "support_attachment"("messageId");

-- AddForeignKey
ALTER TABLE "support_attachment" ADD CONSTRAINT "support_attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "support_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
