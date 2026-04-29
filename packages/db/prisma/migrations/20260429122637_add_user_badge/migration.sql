-- CreateTable
CREATE TABLE "badge" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badge" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "badgeCode" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "badge_code_key" ON "badge"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_badge_userId_badgeCode_key" ON "user_badge"("userId", "badgeCode");

-- AddForeignKey
ALTER TABLE "user_badge" ADD CONSTRAINT "user_badge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badge" ADD CONSTRAINT "user_badge_badgeCode_fkey" FOREIGN KEY ("badgeCode") REFERENCES "badge"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
