-- The admin's lights (docs/refonte-ui/12-admin.md § 1): one row per light,
-- its last state, when it changed, when the red e-mail left.
CREATE TABLE "public"."console_light" (
    "light" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "console_light_pkey" PRIMARY KEY ("light")
);
