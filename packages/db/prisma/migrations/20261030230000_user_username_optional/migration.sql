-- Le nom d'utilisateur devient facultatif (refonte, 11 § 2) : inscription
-- et connexion par e-mail. L'index unique reste ; Postgres y admet plusieurs NULL.
ALTER TABLE "public"."users" ALTER COLUMN "username" DROP NOT NULL;
