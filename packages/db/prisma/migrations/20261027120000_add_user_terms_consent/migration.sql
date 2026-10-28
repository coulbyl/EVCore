-- Consentement à l'inscription (audit du 2026-10-23, P1-1) : l'inscription
-- demande désormais de confirmer l'âge légal et d'accepter les conditions
-- d'utilisation et la politique de confidentialité. On garde la date et la
-- version des conditions acceptées, comme preuve. Colonnes nullables : les
-- comptes existants n'ont rien accepté et restent valides.
ALTER TABLE "public"."users"
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsVersion" TEXT;
