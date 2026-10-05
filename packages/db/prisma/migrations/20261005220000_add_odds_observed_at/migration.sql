-- Heure d'observation des cotes (chantier B, lignes de clôture).
--
-- `snapshotAt` est l'heure de dernière modification du prix chez le
-- bookmaker (`update` chez API-Football), et elle fait partie de la clé
-- d'unicité. Quand le balayage de clôture (T-10 min) retrouve un prix que le
-- bookmaker n'a pas bougé depuis le balayage T-60, il retombe sur la même
-- ligne et n'y laisse aucune trace : seule la cote est réécrite. Mesuré le
-- 2026-10-05 sur les rencontres depuis le 15 septembre : 0 rencontre avec un
-- dernier `snapshotAt` à moins de 15 min du coup d'envoi, 217 avec un dernier
-- `createdAt` à moins de 15 min. La ligne de clôture est capturée mais
-- invisible, et `report:freshness` ne peut pas valider B-1/B-2.
--
-- `observedAt` enregistre notre dernière observation du prix. Nullable pour
-- ne pas réécrire ~10 M de lignes : les vues retombent sur `createdAt`, qui
-- est l'heure de première observation. Pour une source HISTORICAL,
-- `snapshotAt` reste la clôture par construction (import CSV après coup).

ALTER TABLE "odds_snapshot" ADD COLUMN "observedAt" TIMESTAMP(3);

CREATE OR REPLACE VIEW "odds_closing_line" AS
SELECT DISTINCT ON (o."fixtureId", o.bookmaker, o.market, o.pick, o.line)
  o."fixtureId",
  o.bookmaker,
  o.market,
  o.pick,
  o.line,
  o."homeOdds",
  o."drawOdds",
  o."awayOdds",
  o.odds,
  o."snapshotAt",
  EXTRACT(EPOCH FROM (f."scheduledAt" - (
    CASE WHEN o.source = 'HISTORICAL' THEN o."snapshotAt"
         ELSE COALESCE(o."observedAt", o."createdAt") END
  ))) / 3600
    AS "hoursBeforeKickoff",
  CASE WHEN o.source = 'HISTORICAL' THEN o."snapshotAt"
       ELSE COALESCE(o."observedAt", o."createdAt") END
    AS "observedAt"
FROM odds_snapshot o
JOIN fixture f ON f.id = o."fixtureId"
WHERE o."snapshotAt" < f."scheduledAt"
  AND (
    o.source = 'HISTORICAL'
    OR COALESCE(o."observedAt", o."createdAt") < f."scheduledAt"
  )
ORDER BY
  o."fixtureId", o.bookmaker, o.market, o.pick, o.line,
  (CASE WHEN o.source = 'HISTORICAL' THEN o."snapshotAt"
        ELSE COALESCE(o."observedAt", o."createdAt") END) DESC,
  o."snapshotAt" DESC, o.id DESC;

CREATE OR REPLACE VIEW "odds_opening_line" AS
SELECT DISTINCT ON (o."fixtureId", o.bookmaker, o.market, o.pick, o.line)
  o."fixtureId",
  o.bookmaker,
  o.market,
  o.pick,
  o.line,
  o."homeOdds",
  o."drawOdds",
  o."awayOdds",
  o.odds,
  o."snapshotAt",
  EXTRACT(EPOCH FROM (f."scheduledAt" - (
    CASE WHEN o.source = 'HISTORICAL' THEN o."snapshotAt"
         ELSE o."createdAt" END
  ))) / 3600
    AS "hoursBeforeKickoff",
  CASE WHEN o.source = 'HISTORICAL' THEN o."snapshotAt"
       ELSE o."createdAt" END
    AS "observedAt"
FROM odds_snapshot o
JOIN fixture f ON f.id = o."fixtureId"
WHERE o."snapshotAt" < f."scheduledAt"
  AND (o.source = 'HISTORICAL' OR o."createdAt" < f."scheduledAt")
ORDER BY
  o."fixtureId", o.bookmaker, o.market, o.pick, o.line,
  (CASE WHEN o.source = 'HISTORICAL' THEN o."snapshotAt"
        ELSE o."createdAt" END) ASC,
  o."snapshotAt" ASC, o.id ASC;

COMMENT ON COLUMN "odds_snapshot"."observedAt" IS
  'Dernière observation du prix par nos balayages. NULL avant 2026-10 : utiliser COALESCE(observedAt, createdAt).';

COMMENT ON VIEW "odds_closing_line" IS
  'Dernier prix OBSERVÉ avant le coup d''envoi par rencontre, book, marché, choix et ligne. Référence du CLV. hoursBeforeKickoff est calculé sur l''heure d''observation (observedAt, sinon createdAt ; snapshotAt pour une source HISTORICAL), pas sur l''heure de mise à jour chez le bookmaker. Filtrer dessus : un dernier relevé à 24 h n''est pas une clôture.';

COMMENT ON VIEW "odds_opening_line" IS
  'Premier prix observé avant le coup d''envoi, même grain. Sert à mesurer la dérive ouverture vers clôture (B-10).';
