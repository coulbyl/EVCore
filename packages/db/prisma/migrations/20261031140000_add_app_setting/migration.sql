-- Les réglages d'exploitation (refonte 15-todo F3, 12-admin § 4) : une ligne
-- par clé, valeur JSON. Aucune ligne n'est écrite ici : les valeurs par
-- défaut sont en code, une table vide ne change rien au comportement.

CREATE TABLE "public"."app_setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" UUID,

    CONSTRAINT "app_setting_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "public"."app_setting"
    ADD CONSTRAINT "app_setting_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
