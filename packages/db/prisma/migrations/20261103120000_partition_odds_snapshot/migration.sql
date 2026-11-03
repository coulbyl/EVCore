-- `odds_snapshot` partitionnée par mois de `snapshotAt`
-- (docs/audits/2026-11-03/ODDS-ARCHIVE.md).
--
-- 7,1 Go sur 9,2 en prod au 03/11, ~1 Go de plus par semaine, 85 % de lignes
-- de matchs joués depuis plus de 7 jours. Une partition par mois permet
-- d'archiver un mois clos en Parquet puis de le remplacer par sa version
-- compacte en un échange de partitions : la place est rendue tout de suite,
-- sans DELETE ni VACUUM FULL (OddsArchiveService).
--
-- Sans recopier 26 M de lignes : l'ancienne table devient la partition de
-- tout ce qui précède le 1er novembre 2026 (`odds_snapshot_legacy`). Seules
-- les lignes de novembre sont déplacées (~4 M par semaine en prod). La
-- partition ancienne sera compactée par le même job une fois ses matchs
-- joués, puis remplacée par `odds_snapshot_history`.
--
-- Une clé unique d'une table partitionnée contient la clé de partition : la
-- clé primaire devient (id, snapshotAt). La contrainte d'unicité du prix la
-- contient déjà. Aucune clé étrangère ne pointe vers `odds_snapshot.id`.
--
-- Le script entier tient un verrou exclusif sur la table : les passes de
-- cotes attendent. Sa durée croît avec novembre (mesures dans le plan, § 5).

-- 1. L'ancienne table, renommée avec ses index (les noms d'index sont
--    uniques par schéma : la table mère reprend les noms de Prisma).
ALTER TABLE "public"."odds_snapshot" RENAME TO "odds_snapshot_legacy";
DROP TRIGGER "odds_snapshot_latest" ON "public"."odds_snapshot_legacy";
ALTER INDEX "public"."odds_snapshot_fixtureId_bookmaker_market_pick_line_snapshot_key"
  RENAME TO "odds_snapshot_legacy_fixtureId_bookmaker_market_pick_line_s_key";
ALTER INDEX "public"."odds_snapshot_fixtureId_snapshotAt_idx"
  RENAME TO "odds_snapshot_legacy_fixtureId_snapshotAt_idx";
ALTER INDEX "public"."odds_snapshot_snapshotAt_idx"
  RENAME TO "odds_snapshot_legacy_snapshotAt_idx";

-- Sa clé primaire passe à (id, snapshotAt), celle de la table mère.
CREATE UNIQUE INDEX "odds_snapshot_legacy_pkey_composite"
  ON "public"."odds_snapshot_legacy" ("id", "snapshotAt");
ALTER TABLE "public"."odds_snapshot_legacy"
  DROP CONSTRAINT "odds_snapshot_pkey",
  ADD CONSTRAINT "odds_snapshot_legacy_pkey"
    PRIMARY KEY USING INDEX "odds_snapshot_legacy_pkey_composite";

-- 2. La table mère : mêmes colonnes, mêmes défauts, mêmes clés.
CREATE TABLE "public"."odds_snapshot" (
  LIKE "public"."odds_snapshot_legacy" INCLUDING DEFAULTS
) PARTITION BY RANGE ("snapshotAt");

ALTER TABLE "public"."odds_snapshot"
  ADD CONSTRAINT "odds_snapshot_pkey" PRIMARY KEY ("id", "snapshotAt");
-- NULLS NOT DISTINCT : le 1X2 n'a pas de `pick` (migration 20260815130000).
ALTER TABLE "public"."odds_snapshot"
  ADD CONSTRAINT "odds_snapshot_fixtureId_bookmaker_market_pick_line_snapshot_key"
  UNIQUE NULLS NOT DISTINCT ("fixtureId", "bookmaker", "market", "pick", "line", "snapshotAt");
CREATE INDEX "odds_snapshot_fixtureId_snapshotAt_idx"
  ON "public"."odds_snapshot" ("fixtureId", "snapshotAt");
CREATE INDEX "odds_snapshot_snapshotAt_idx"
  ON "public"."odds_snapshot" ("snapshotAt");
ALTER TABLE "public"."odds_snapshot"
  ADD CONSTRAINT "odds_snapshot_fixtureId_fkey" FOREIGN KEY ("fixtureId")
  REFERENCES "public"."fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Novembre quitte l'ancienne table. Chargé dans une table nue, ses clés
--    et index posés après coup puis attaché : bien plus rapide qu'une
--    insertion dans une partition déjà indexée. Le déclencheur n'est pas
--    encore posé : `odds_latest` garde ses lignes, mêmes `id`.
CREATE TABLE "public"."odds_snapshot_y2026m11" (
  LIKE "public"."odds_snapshot_legacy" INCLUDING DEFAULTS
);
INSERT INTO "public"."odds_snapshot_y2026m11"
SELECT * FROM "public"."odds_snapshot_legacy" WHERE "snapshotAt" >= '2026-11-01';
DELETE FROM "public"."odds_snapshot_legacy" WHERE "snapshotAt" >= '2026-11-01';
ALTER TABLE "public"."odds_snapshot_y2026m11"
  ADD PRIMARY KEY ("id", "snapshotAt"),
  ADD UNIQUE NULLS NOT DISTINCT ("fixtureId", "bookmaker", "market", "pick", "line", "snapshotAt"),
  ADD FOREIGN KEY ("fixtureId") REFERENCES "public"."fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "odds_snapshot_y2026m11_bound"
    CHECK ("snapshotAt" >= '2026-11-01' AND "snapshotAt" < '2026-12-01');
CREATE INDEX ON "public"."odds_snapshot_y2026m11" ("fixtureId", "snapshotAt");
CREATE INDEX ON "public"."odds_snapshot_y2026m11" ("snapshotAt");
ALTER TABLE "public"."odds_snapshot"
  ATTACH PARTITION "public"."odds_snapshot_y2026m11"
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
ALTER TABLE "public"."odds_snapshot_y2026m11" DROP CONSTRAINT "odds_snapshot_y2026m11_bound";

-- 4. Les mois suivants, et une partition par défaut qui doit rester vide (le
--    job crée les mois suivants d'avance ; la console la surveille).
CREATE TABLE "public"."odds_snapshot_y2026m12" PARTITION OF "public"."odds_snapshot"
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE "public"."odds_snapshot_y2027m01" PARTITION OF "public"."odds_snapshot"
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE "public"."odds_snapshot_default" PARTITION OF "public"."odds_snapshot" DEFAULT;

-- 5. L'ancienne table devient la partition de tout ce qui précède. La
--    contrainte prouve la borne : l'attachement ne relit pas la table.
ALTER TABLE "public"."odds_snapshot_legacy"
  ADD CONSTRAINT "odds_snapshot_legacy_bound" CHECK ("snapshotAt" < '2026-11-01');
ALTER TABLE "public"."odds_snapshot"
  ATTACH PARTITION "public"."odds_snapshot_legacy"
  FOR VALUES FROM (MINVALUE) TO ('2026-11-01');
ALTER TABLE "public"."odds_snapshot_legacy" DROP CONSTRAINT "odds_snapshot_legacy_bound";

-- 6. Le déclencheur de `odds_latest`, sur la table mère : chaque partition
--    présente et future en hérite.
CREATE TRIGGER "odds_snapshot_latest"
  AFTER INSERT OR UPDATE ON "public"."odds_snapshot"
  FOR EACH ROW EXECUTE FUNCTION "public"."odds_latest_from_snapshot"();

COMMENT ON COLUMN "public"."odds_snapshot"."observedAt" IS
  'Dernière observation du prix par nos balayages. NULL avant 2026-10 : utiliser COALESCE(observedAt, createdAt).';

-- 7. Les vues suivaient l'ancienne table par son identifiant : les mêmes
--    définitions (migration 20261005220000), relues sur la table mère.
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

-- 8. Le journal des mois archivés.
CREATE TABLE "public"."odds_archive_month" (
    "month" DATE NOT NULL,
    "objectKey" TEXT NOT NULL,
    "parquetBytes" BIGINT NOT NULL,
    "rowsTotal" INTEGER NOT NULL,
    "rowsKept" INTEGER NOT NULL,
    "oddsSum" DECIMAL(20,3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_archive_month_pkey" PRIMARY KEY ("month")
);

-- 9. Le rôle de lecture de la prod (PROD_DB_ACCESS.md) lisait l'ancienne
--    table ; la table mère est nouvelle.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evcore_analyst') THEN
    GRANT SELECT ON "public"."odds_snapshot", "public"."odds_archive_month" TO evcore_analyst;
  END IF;
END
$$;
