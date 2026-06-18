/*
  Warnings:

  - You are about to drop the column `decision` on the `model_run` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "model_run" DROP COLUMN "decision";

-- DropEnum
DROP TYPE "Decision";
