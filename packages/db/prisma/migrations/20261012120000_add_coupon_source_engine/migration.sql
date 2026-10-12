-- Troisième générateur de coupon : le combiné du jour composé sur les
-- sélections du moteur (canaux calibrés sur la compétition, cote courte,
-- classement par le prix). Ni LLM ni compositeur par le prix : une source à
-- part, pour que l'écran et les rapports par source ne le confondent avec
-- aucun des deux.
ALTER TYPE "coupon_source" ADD VALUE 'ENGINE';
