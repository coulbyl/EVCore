-- CreateEnum
CREATE TYPE "public"."EmailCodePurpose" AS ENUM ('VERIFY', 'CHANGE_EMAIL');

-- AlterTable
ALTER TABLE "public"."email_verification_code" ADD COLUMN     "purpose" "public"."EmailCodePurpose" NOT NULL DEFAULT 'VERIFY',
ADD COLUMN     "targetEmail" TEXT;
