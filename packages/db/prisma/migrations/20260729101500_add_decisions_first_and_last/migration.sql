/*
  Warnings:

  - The values [DECISIONS] on the enum `subscription_channel_pick_mode` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
-- L'ancienne valeur DECISIONS désignait "premiers matchs du jour" — mappée
-- vers DECISIONS_FIRST pour préserver le comportement historique des
-- abonnements déjà créés avec ce choix, plutôt que de casser le cast.
BEGIN;
CREATE TYPE "subscription_channel_pick_mode_new" AS ENUM ('INVESTIR', 'DECISIONS_FIRST', 'DECISIONS_LAST');
ALTER TABLE "subscription" ALTER COLUMN "channelPickMode" TYPE "subscription_channel_pick_mode_new" USING (
  CASE "channelPickMode"::text
    WHEN 'DECISIONS' THEN 'DECISIONS_FIRST'
    ELSE "channelPickMode"::text
  END::"subscription_channel_pick_mode_new"
);
ALTER TYPE "subscription_channel_pick_mode" RENAME TO "subscription_channel_pick_mode_old";
ALTER TYPE "subscription_channel_pick_mode_new" RENAME TO "subscription_channel_pick_mode";
DROP TYPE "public"."subscription_channel_pick_mode_old";
COMMIT;
