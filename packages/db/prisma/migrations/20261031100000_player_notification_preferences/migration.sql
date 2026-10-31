-- Les quatre interrupteurs et « Par e-mail aussi » de Compte (refonte 09 § 5).
-- L'interrupteur e-mail existant couvre désormais la matinée et la semaine en
-- plus des réponses de l'équipe : renommé, les choix des joueurs sont gardés.
ALTER TABLE "public"."users"
  RENAME COLUMN "emailSupportNotificationsEnabled" TO "emailNotificationsEnabled";

ALTER TABLE "public"."users"
  ADD COLUMN "followedResultEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "teamRepliesEnabled" BOOLEAN NOT NULL DEFAULT true;
