-- Compteur anonyme des tickets vérifiés (refonte 07 § 7) : ni joueur, ni
-- heure, ni contenu ; id v4 pour ne pas porter l'instant d'écriture.
CREATE TABLE "public"."verified_ticket" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "day" DATE NOT NULL,
    "legCount" INTEGER NOT NULL,
    "totalOdds" DECIMAL(14,3) NOT NULL,
    "chance" DECIMAL(12,10) NOT NULL,

    CONSTRAINT "verified_ticket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "verified_ticket_day_idx" ON "public"."verified_ticket"("day");
