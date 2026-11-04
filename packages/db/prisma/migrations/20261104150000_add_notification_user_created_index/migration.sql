-- The bell reads its broadcasts as userId IS NULL AND createdAt >= the
-- window, read or not: notification_userId_read_createdAt_idx puts `read`
-- between the two columns.

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "public"."notification"("userId", "createdAt");
