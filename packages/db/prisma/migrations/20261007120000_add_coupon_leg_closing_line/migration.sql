-- Ligne de clôture par jambe de coupon (plan de rentabilité, chantier E, E-2).
--
-- Le CLV (E-1, `closingValue` dans analysis-core) est le seul indicateur qui
-- dise en semaines, et non en années, si un prix pris avait de la valeur. Il
-- n'était alimenté par rien : la jambe ne gardait que sa cote de proposition.
-- Le règlement écrit désormais, pour chaque jambe sur une rencontre terminée,
-- la cote de clôture du choix, le book retenu, l'heure d'observation de ce
-- prix et la valeur prise sur la clôture. Colonnes nullables, aucune ligne
-- réécrite : un re-règlement (`settleRange`) remplit l'historique là où une
-- clôture existe.

ALTER TABLE "coupon_proposal_leg"
  ADD COLUMN "closingOdds" DECIMAL(6,3),
  ADD COLUMN "closingBookmaker" TEXT,
  ADD COLUMN "closingObservedAt" TIMESTAMP(3),
  ADD COLUMN "closingLineValue" DECIMAL(6,4);
