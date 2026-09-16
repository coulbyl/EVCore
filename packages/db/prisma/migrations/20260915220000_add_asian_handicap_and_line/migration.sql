-- Chantier A du plan de rentabilité (docs/plan-rentabilite.md), tâches A-8,
-- A-9 et A-16.
--
-- 1. Deux marchés : le handicap asiatique plein match et mi-temps. Marge
--    Pinnacle mesurée sur 40 rencontres : 4,11 % contre 4,52 % sur ONE_X_TWO.
--    C'est le marché le moins taxé du carnet, jusqu'ici non collecté.
--
-- 2. Une colonne `line`. Un même `pick` (HOME/AWAY) existe à plusieurs
--    handicaps sur la même rencontre : sans la ligne dans la contrainte
--    d'unicité, le second handicap écraserait le premier. Les marchés
--    antérieurs encodent leur ligne dans `pick` (`OVER_1_5`) et gardent
--    `line` à NULL — leur unicité est donc inchangée.
--
-- ATTENTION — durée. `odds_snapshot` fait 5,5 M lignes pour 1,27 Go. La
-- reconstruction de la contrainte d'unicité prend de l'ordre de la minute et
-- pose un ACCESS EXCLUSIVE LOCK : à lancer hors fenêtre d'ingestion de cotes.
-- La clause NULLS NOT DISTINCT est indispensable et n'est pas générée par
-- Prisma : `pick` et `line` sont NULL sur ONE_X_TWO, et un index unique
-- ordinaire traite chaque NULL comme distinct, ce qui rouvrirait la course
-- aux doublons corrigée par la migration 20260815130000.

ALTER TYPE "Market" ADD VALUE IF NOT EXISTS 'ASIAN_HANDICAP';
ALTER TYPE "Market" ADD VALUE IF NOT EXISTS 'ASIAN_HANDICAP_HT';

ALTER TABLE "odds_snapshot" ADD COLUMN IF NOT EXISTS "line" DECIMAL(5,2);

ALTER TABLE "odds_snapshot"
  DROP CONSTRAINT IF EXISTS "odds_snapshot_fixtureId_bookmaker_market_pick_snapshotAt_key";

ALTER TABLE "odds_snapshot"
  ADD CONSTRAINT "odds_snapshot_fixtureId_bookmaker_market_pick_line_snapshotAt_key"
  UNIQUE NULLS NOT DISTINCT ("fixtureId", "bookmaker", "market", "pick", "line", "snapshotAt");
