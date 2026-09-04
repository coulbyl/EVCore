-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "phoneNumberConsentGiven" BOOLEAN NOT NULL DEFAULT false;
