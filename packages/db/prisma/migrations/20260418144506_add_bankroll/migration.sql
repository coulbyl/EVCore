-- CreateEnum
CREATE TYPE "BankrollTransactionType" AS ENUM ('DEPOSIT', 'BET_PLACED', 'BET_WON', 'BET_VOID');

-- CreateTable
CREATE TABLE "bankroll_transaction" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "type" "BankrollTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "betId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bankroll_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bankroll_transaction_userId_createdAt_idx" ON "bankroll_transaction"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "bankroll_transaction" ADD CONSTRAINT "bankroll_transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
