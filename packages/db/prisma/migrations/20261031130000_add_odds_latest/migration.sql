-- Le dernier prix d'avant coup d'envoi de chaque choix, chez chaque book
-- (refonte 15-todo B17c). Les écrans lisaient ce prix dans tout l'historique
-- `odds_snapshot` (23,5 M lignes) : 48 ms à chaud par page de « Matchs »,
-- bien plus dès que le cache de la base ne le tient plus.
--
-- Tenue par un déclencheur sur `odds_snapshot` : chaque écrivain, présent
-- ou futur, la met à jour sans le savoir. Même choix que la lecture qu'elle
-- remplace : relevé d'avant le coup d'envoi, le plus récent (`snapshotAt`,
-- puis `id`). Un match qui n'y a aucune ligne est lu dans l'historique
-- (PlayableOddsRepository) : la table peut être incomplète, jamais fausse.

CREATE TABLE "public"."odds_latest" (
    "fixtureId" UUID NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "market" "public"."Market" NOT NULL,
    "pick" TEXT,
    "line" DECIMAL(5,2),
    "homeOdds" DECIMAL(6,3),
    "drawOdds" DECIMAL(6,3),
    "awayOdds" DECIMAL(6,3),
    "odds" DECIMAL(9,3),
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "observedAt" TIMESTAMP(3),
    "snapshotId" UUID NOT NULL,

    CONSTRAINT "odds_latest_fixtureId_fkey" FOREIGN KEY ("fixtureId")
      REFERENCES "public"."fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- NULLS NOT DISTINCT : le 1X2 n'a pas de `pick`, la plupart des marchés pas
-- de `line` (même règle que la contrainte de `odds_snapshot`).
CREATE UNIQUE INDEX "odds_latest_fixtureId_bookmaker_market_pick_line_key"
  ON "public"."odds_latest" ("fixtureId", "bookmaker", "market", "pick", "line")
  NULLS NOT DISTINCT;

-- Un relevé est le dernier d'au plus un choix.
CREATE UNIQUE INDEX "odds_latest_snapshotId_key" ON "public"."odds_latest" ("snapshotId");

CREATE FUNCTION "public"."odds_latest_from_snapshot"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Après le coup d'envoi, un relevé n'est plus « le prix du match ».
  IF NEW."snapshotAt" > (
    SELECT f."scheduledAt" FROM "public"."fixture" f WHERE f.id = NEW."fixtureId"
  ) THEN
    RETURN NULL;
  END IF;
  INSERT INTO "public"."odds_latest" AS l (
    "fixtureId", "bookmaker", "market", "pick", "line", "homeOdds",
    "drawOdds", "awayOdds", "odds", "snapshotAt", "observedAt", "snapshotId"
  ) VALUES (
    NEW."fixtureId", NEW."bookmaker", NEW."market", NEW."pick", NEW."line",
    NEW."homeOdds", NEW."drawOdds", NEW."awayOdds", NEW."odds",
    NEW."snapshotAt", NEW."observedAt", NEW."id"
  )
  ON CONFLICT ("fixtureId", "bookmaker", "market", "pick", "line") DO UPDATE SET
    "homeOdds" = EXCLUDED."homeOdds",
    "drawOdds" = EXCLUDED."drawOdds",
    "awayOdds" = EXCLUDED."awayOdds",
    "odds" = EXCLUDED."odds",
    "snapshotAt" = EXCLUDED."snapshotAt",
    "observedAt" = EXCLUDED."observedAt",
    "snapshotId" = EXCLUDED."snapshotId"
  -- Jamais un relevé plus ancien par-dessus un plus récent ; le même relevé
  -- mis à jour (prix ou heure d'observation) passe.
  WHERE (l."snapshotAt", l."snapshotId") <= (EXCLUDED."snapshotAt", EXCLUDED."snapshotId");
  RETURN NULL;
END;
$$;

CREATE TRIGGER "odds_snapshot_latest"
  AFTER INSERT OR UPDATE ON "public"."odds_snapshot"
  FOR EACH ROW EXECUTE FUNCTION "public"."odds_latest_from_snapshot"();

-- Remplissage des matchs d'hier et à venir, ce que lisent les écrans et la
-- composition des coupons : ~25 s sur la copie de prod (357 000 prix). Les
-- matchs plus anciens retombent sur l'historique ; le script
-- `db:backfill:odds-latest` les remplit s'il le faut.
INSERT INTO "public"."odds_latest" (
  "fixtureId", "bookmaker", "market", "pick", "line", "homeOdds", "drawOdds",
  "awayOdds", "odds", "snapshotAt", "observedAt", "snapshotId"
)
SELECT DISTINCT ON (o."fixtureId", o."bookmaker", o."market", o."pick", o."line")
       o."fixtureId", o."bookmaker", o."market", o."pick", o."line",
       o."homeOdds", o."drawOdds", o."awayOdds", o."odds", o."snapshotAt",
       o."observedAt", o."id"
FROM "public"."odds_snapshot" o
JOIN "public"."fixture" f ON f.id = o."fixtureId"
WHERE f."scheduledAt" >= current_date - 1
  AND o."snapshotAt" <= f."scheduledAt"
ORDER BY o."fixtureId", o."bookmaker", o."market", o."pick", o."line",
         o."snapshotAt" DESC, o."id" DESC
ON CONFLICT DO NOTHING;
