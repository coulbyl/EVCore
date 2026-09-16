-- Canal des jambes produites par le compositeur déterministe par le prix.
--
-- Les jambes des deux générateurs cohabitent dans `coupon_proposal_leg` ; sans
-- valeur distincte, toute mesure de calibration par canal les mélangerait.
-- Séparé de la migration `source` sur `coupon_proposal` à dessein : une valeur
-- d'enum ajoutée n'est pas utilisable dans la transaction qui l'ajoute.
ALTER TYPE "public"."StrategyChannel" ADD VALUE IF NOT EXISTS 'PRICE';
