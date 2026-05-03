-- CreateEnum
CREATE TYPE "UnitMode" AS ENUM ('FIXED', 'PCT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "unitAmount" DECIMAL(12,2),
ADD COLUMN     "unitMode" "UnitMode",
ADD COLUMN     "unitPercent" DECIMAL(5,4);
