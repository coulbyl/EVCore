-- CreateEnum
CREATE TYPE "FormationContentType" AS ENUM ('ARTICLE', 'VIDEO');

-- CreateTable
CREATE TABLE "user_content_progress" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "contentType" "FormationContentType" NOT NULL,
    "slug" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_content_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_content_progress_userId_idx" ON "user_content_progress"("userId");

-- CreateIndex
CREATE INDEX "user_content_progress_completedAt_idx" ON "user_content_progress"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_content_progress_userId_contentType_slug_key" ON "user_content_progress"("userId", "contentType", "slug");

-- AddForeignKey
ALTER TABLE "user_content_progress" ADD CONSTRAINT "user_content_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

