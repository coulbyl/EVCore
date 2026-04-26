-- AddForeignKey
ALTER TABLE "bankroll_transaction" ADD CONSTRAINT "bankroll_transaction_betId_fkey" FOREIGN KEY ("betId") REFERENCES "bet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
