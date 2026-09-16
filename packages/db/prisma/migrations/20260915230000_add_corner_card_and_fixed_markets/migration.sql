-- Chantier A du plan de rentabilité, tâches A-10 à A-15.
--
-- Huit marchés servis par l'API et jamais collectés. Quatre portent une ligne
-- (second-half over/under, corners plein match et mi-temps, cartons) et
-- s'appuient sur la colonne `line` créée par la migration 20260915220000 ;
-- quatre ont des issues fixes (pair/impair plein match et mi-temps, mi-temps
-- la plus prolifique, première équipe à marquer).
--
-- Les lignes de corners sont parfois ENTIÈRES côté API (« Over 9 »,
-- « Over 4 ») : c'est précisément ce que l'encodage historique de la ligne
-- dans `pick` (`OVER_1_5`, découpé par `right(pick, 3)`) ne savait pas
-- représenter.
--
-- Migration légère : ajout de valeurs d'enum uniquement, ni réécriture de
-- table ni reconstruction d'index.

ALTER TYPE "Market" ADD VALUE IF NOT EXISTS 'OVER_UNDER_2H';
ALTER TYPE "Market" ADD VALUE IF NOT EXISTS 'CORNERS';
ALTER TYPE "Market" ADD VALUE IF NOT EXISTS 'CORNERS_HT';
ALTER TYPE "Market" ADD VALUE IF NOT EXISTS 'CARDS';
ALTER TYPE "Market" ADD VALUE IF NOT EXISTS 'ODD_EVEN';
ALTER TYPE "Market" ADD VALUE IF NOT EXISTS 'ODD_EVEN_HT';
ALTER TYPE "Market" ADD VALUE IF NOT EXISTS 'HIGHEST_SCORING_HALF';
ALTER TYPE "Market" ADD VALUE IF NOT EXISTS 'TEAM_TO_SCORE_FIRST';
