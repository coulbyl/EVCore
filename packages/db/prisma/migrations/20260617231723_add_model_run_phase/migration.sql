-- CreateEnum
CREATE TYPE "ModelRunPhase" AS ENUM ('ADVANCE', 'PRE_KICKOFF', 'LIVE');

-- AlterTable
ALTER TABLE "model_run" ADD COLUMN     "phase" "ModelRunPhase" NOT NULL DEFAULT 'PRE_KICKOFF';
