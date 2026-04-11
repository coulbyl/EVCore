-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "bio" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_session" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_slip" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "unitStake" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bet_slip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_slip_item" (
    "betSlipId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "betId" UUID NOT NULL,
    "fixtureId" UUID NOT NULL,
    "stakeOverride" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bet_slip_item_pkey" PRIMARY KEY ("betSlipId","betId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_session_tokenHash_key" ON "user_session"("tokenHash");

-- CreateIndex
CREATE INDEX "user_session_userId_expiresAt_idx" ON "user_session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "bet_slip_userId_createdAt_idx" ON "bet_slip"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "bet_slip_item_betId_idx" ON "bet_slip_item"("betId");

-- CreateIndex
CREATE INDEX "bet_slip_item_fixtureId_idx" ON "bet_slip_item"("fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "bet_slip_item_userId_betId_key" ON "bet_slip_item"("userId", "betId");

-- CreateIndex
CREATE UNIQUE INDEX "bet_slip_item_betSlipId_fixtureId_key" ON "bet_slip_item"("betSlipId", "fixtureId");

-- AddForeignKey
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_slip" ADD CONSTRAINT "bet_slip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_slip_item" ADD CONSTRAINT "bet_slip_item_betSlipId_fkey" FOREIGN KEY ("betSlipId") REFERENCES "bet_slip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_slip_item" ADD CONSTRAINT "bet_slip_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_slip_item" ADD CONSTRAINT "bet_slip_item_betId_fkey" FOREIGN KEY ("betId") REFERENCES "bet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_slip_item" ADD CONSTRAINT "bet_slip_item_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
