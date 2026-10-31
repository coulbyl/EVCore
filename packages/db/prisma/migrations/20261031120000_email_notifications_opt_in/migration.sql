-- « Par e-mail aussi » devient un choix du joueur (refonte 09 § 5, décidé le
-- 2026-10-31) : il envoie désormais la matinée et la semaine par e-mail,
-- ce qu'aucun joueur n'a accepté. L'ancien interrupteur ne couvrait que les
-- réponses du support et était activé par défaut, sans choix : tout le monde
-- repart éteint, chacun l'allume depuis Compte.
ALTER TABLE "public"."users" ALTER COLUMN "emailNotificationsEnabled" SET DEFAULT false;
UPDATE "public"."users" SET "emailNotificationsEnabled" = false;
