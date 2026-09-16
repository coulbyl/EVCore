-- Réaligne les noms d'index de `coupon_generation_attempt` sur l'historique
-- de migrations.
--
-- La migration 20260914150000 les déclare en camelCase entre guillemets, mais
-- la base les porte en minuscules : ils ont été créés hors migration (un
-- `db push`, très probablement). `prisma migrate dev` voyait donc une dérive
-- et proposait un reset complet de la base — 5,5 M de cotes et tout
-- l'historique d'analyses.
--
-- La dérive est purement cosmétique : mêmes colonnes, mêmes index, seuls les
-- noms diffèrent. Ce renommage fait converger base et historique.
--
-- `IF EXISTS` rend la migration idempotente et sûre sur une base neuve, où
-- les index portent déjà le nom camelCase et où ce renommage ne fait rien.

ALTER INDEX IF EXISTS "coupon_generation_attempt_fordate_policyversion_idx"
  RENAME TO "coupon_generation_attempt_forDate_policyVersion_idx";

ALTER INDEX IF EXISTS "coupon_generation_attempt_generatedat_idx"
  RENAME TO "coupon_generation_attempt_generatedAt_idx";
