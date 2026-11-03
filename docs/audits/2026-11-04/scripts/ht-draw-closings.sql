-- Chasseur Nul à la mi-temps : clôtures FIRST_HALF_WINNER (moins de 24 h)
-- de Pinnacle et de 1xBet, matchs finis avec score à la mi-temps.
-- Une ligne par match et par book, les trois issues en colonnes.
-- docker exec evcore-postgres psql -U postgres -d evcore --csv -f - < ht-draw-closings.sql > ht-draw.csv
SELECT f.id AS "fixtureId",
       to_char(f."scheduledAt", 'YYYY-MM-DD') AS day,
       c.bookmaker,
       max(c.odds) FILTER (WHERE c.pick = 'HOME')::float AS home,
       max(c.odds) FILTER (WHERE c.pick = 'DRAW')::float AS draw,
       max(c.odds) FILTER (WHERE c.pick = 'AWAY')::float AS away,
       f."homeHtScore" AS hht,
       f."awayHtScore" AS aht
FROM odds_closing_line c
JOIN fixture f ON f.id = c."fixtureId"
WHERE c.market = 'FIRST_HALF_WINNER'
  AND c.bookmaker IN ('Pinnacle', '1xBet')
  AND c."hoursBeforeKickoff" <= 24
  AND f.status = 'FINISHED'
  AND f."homeHtScore" IS NOT NULL
  AND f."awayHtScore" IS NOT NULL
GROUP BY f.id, f."scheduledAt", c.bookmaker,
         f."homeHtScore", f."awayHtScore"
HAVING count(DISTINCT c.pick) = 3;
