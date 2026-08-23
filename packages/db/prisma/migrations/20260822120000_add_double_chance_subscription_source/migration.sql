-- AlterEnum
-- DOUBLE_CHANCE est, avec DRAW, l'un des deux seuls canaux sur 18 dont le ROI
-- reste positif après shrinkage (+2.24%, n=1 431, audit du 2026-08-22) : il
-- devient une cible d'abonnement.
ALTER TYPE "subscription_source_type" ADD VALUE 'CHANNEL_DOUBLE_CHANCE';
