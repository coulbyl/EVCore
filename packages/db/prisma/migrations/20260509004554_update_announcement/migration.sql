/*
  Warnings:

  - Made the column `description` on table `announcement` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "announcement" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "href" DROP NOT NULL;
