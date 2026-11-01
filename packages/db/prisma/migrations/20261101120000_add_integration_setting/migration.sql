-- Réglages › Intégrations (revue admin du 01/11): the third-party services'
-- keys and addresses, a secret encrypted with SETTINGS_ENCRYPTION_KEY.
CREATE TABLE "public"."integration_setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "secret" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" UUID,

    CONSTRAINT "integration_setting_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "public"."integration_setting" ADD CONSTRAINT "integration_setting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
