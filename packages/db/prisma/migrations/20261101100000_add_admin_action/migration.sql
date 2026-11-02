-- The admin's journal of human actions (docs/refonte-ui/12-admin.md § 4).
CREATE TABLE "public"."admin_action" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" UUID,
    "actorName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,

    CONSTRAINT "admin_action_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_action_createdAt_idx" ON "public"."admin_action"("createdAt");
CREATE INDEX "admin_action_actorId_idx" ON "public"."admin_action"("actorId");
