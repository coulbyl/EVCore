-- CreateTable
CREATE TABLE "announcement" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "href" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcement_published_publishedAt_idx" ON "announcement"("published", "publishedAt");

-- CreateIndex
CREATE INDEX "announcement_createdAt_idx" ON "announcement"("createdAt");

-- CreateIndex
CREATE INDEX "prediction_fixtureId_channel_createdAt_idx" ON "prediction"("fixtureId", "channel", "createdAt");

-- AddForeignKey
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
