-- Fraîcheur des cotes par book (chantier B, tâche B-9).
--
-- Mesure la distance entre le dernier relevé d'une rencontre et son coup
-- d'envoi. C'est l'indicateur qui dit si la ligne de clôture est réellement
-- capturée : sans relevé proche du coup d'envoi, le CLV est incalculable, et
-- comparer deux books relevés à des heures différentes produit des écarts
-- qui ne sont que du décalage temporel.
--
-- Constat d'ouverture du chantier (2026-09-15, avant le balayage de clôture) :
-- Pinnacle à 7,5 h du coup d'envoi en médiane, Bet365 à 9,5 h, Marathonbet et
-- Unibet à 43 h. `closingRate` donne la part des rencontres dont le dernier
-- relevé tombe dans le dernier quart d'heure — la cible du chantier.
WITH latest AS (
  SELECT DISTINCT ON (o."fixtureId", o.bookmaker)
    o.bookmaker,
    o."fixtureId",
    EXTRACT(EPOCH FROM (f."scheduledAt" - o."snapshotAt")) / 3600
      AS hours_before
  FROM odds_snapshot o
  JOIN fixture f ON f.id = o."fixtureId"
  WHERE f.status = 'FINISHED'
    AND o."snapshotAt" < f."scheduledAt"
    AND f."scheduledAt" >= now() - INTERVAL '30 days'
  ORDER BY o."fixtureId", o.bookmaker, o."snapshotAt" DESC
),
counted AS (
  SELECT
    o."fixtureId",
    o.bookmaker,
    -- Relevés DISTINCTS, pas lignes : un relevé produit une ligne par marché
    -- et par choix, soit plusieurs centaines. Les compter donnerait une
    -- densité temporelle fausse d'un facteur 100.
    count(DISTINCT o."snapshotAt")::int AS snapshots
  FROM odds_snapshot o
  JOIN fixture f ON f.id = o."fixtureId"
  WHERE f.status = 'FINISHED'
    AND o."snapshotAt" < f."scheduledAt"
    AND f."scheduledAt" >= now() - INTERVAL '30 days'
  GROUP BY o."fixtureId", o.bookmaker
)
SELECT
  l.bookmaker,
  count(*)::int AS fixtures,
  avg(c.snapshots)::double precision AS "snapshotsPerFixture",
  (percentile_disc(0.5) WITHIN GROUP (ORDER BY l.hours_before))::double precision
    AS "medianHoursBefore",
  (percentile_disc(0.1) WITHIN GROUP (ORDER BY l.hours_before))::double precision
    AS "p10HoursBefore",
  (percentile_disc(0.9) WITHIN GROUP (ORDER BY l.hours_before))::double precision
    AS "p90HoursBefore",
  (count(*) FILTER (WHERE l.hours_before <= 0.25)::double precision
    / count(*))::double precision AS "closingRate",
  (count(*) FILTER (WHERE l.hours_before <= 1.5)::double precision
    / count(*))::double precision AS "withinNinetyMinutesRate"
FROM latest l
JOIN counted c
  ON c."fixtureId" = l."fixtureId" AND c.bookmaker = l.bookmaker
GROUP BY l.bookmaker
HAVING count(*) >= 20
ORDER BY "medianHoursBefore"
