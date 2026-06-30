/*
  Warnings:

  - You are about to drop the column `isBackfill` on the `model_run` table. All the data in the column will be lost.
  - You are about to drop the `prediction` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `canal` on the `coupon_proposal_leg` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "prediction" DROP CONSTRAINT "prediction_fixtureId_fkey";

-- DropForeignKey
ALTER TABLE "prediction" DROP CONSTRAINT "prediction_modelRunId_fkey";

-- AlterTable
ALTER TABLE "coupon_proposal_leg" DROP COLUMN "canal",
ADD COLUMN     "canal" "StrategyChannel" NOT NULL;

-- AlterTable
ALTER TABLE "model_run" DROP COLUMN "isBackfill";

-- DropTable
DROP TABLE "prediction";

-- DropEnum
DROP TYPE "PredictionChannel";

-- DropEnum
DROP TYPE "coupon_leg_canal";
