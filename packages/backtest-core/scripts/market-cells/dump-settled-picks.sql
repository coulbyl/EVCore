-- Extraction de l'espace d'opportunités réglé, pour rejouer le compositeur.
-- À concaténer après `settled-picks.sql`.
COPY (
  SELECT day, "fixtureId", competition, market, pick,
         round(odds, 3) AS odds,
         CASE WHEN won IS NULL THEN '' WHEN won THEN '1' ELSE '0' END AS won
  FROM settled_picks
  WHERE odds BETWEEN 1.05 AND 12
    AND (won IS NOT NULL OR market = 'DRAW_NO_BET')
  ORDER BY day, "fixtureId"
) TO STDOUT WITH (FORMAT csv, HEADER true);
