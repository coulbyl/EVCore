-- Marge du marché par famille de marché : somme des probabilités implicites
-- brutes d'une même rencontre. C'est le coût fixe qu'une jambe doit battre,
-- et qu'un coupon à k jambes doit battre k fois.
WITH latest_per_book AS (
  SELECT DISTINCT ON (o."fixtureId", o.bookmaker, o.market, o.pick)
    o."fixtureId",
    o.market,
    o.pick,
    o."homeOdds",
    o."drawOdds",
    o."awayOdds",
    o.odds
  FROM odds_snapshot o
  JOIN fixture f ON f.id = o."fixtureId"
  WHERE f.status = 'FINISHED'
    AND o."snapshotAt" < f."scheduledAt"
    AND o.market IN ('ONE_X_TWO', 'OVER_UNDER', 'BTTS', 'FIRST_HALF_WINNER')
  ORDER BY
    o."fixtureId", o.bookmaker, o.market, o.pick,
    o."snapshotAt" DESC, o.id DESC
),
expanded AS (
  SELECT l."fixtureId", 'ONE_X_TWO'::text AS market_key, v.odds
  FROM latest_per_book l
  CROSS JOIN LATERAL (VALUES
    (l."homeOdds"), (l."drawOdds"), (l."awayOdds")
  ) AS v(odds)
  WHERE l.market = 'ONE_X_TWO'
  UNION ALL
  SELECT
    l."fixtureId",
    CASE
      WHEN l.market <> 'OVER_UNDER' THEN l.market::text
      WHEN l.pick IN ('OVER', 'UNDER') THEN 'OVER_UNDER_2_5'
      ELSE 'OVER_UNDER_' || right(l.pick, 3)
    END,
    l.odds
  FROM latest_per_book l
  WHERE l.market <> 'ONE_X_TWO' AND l.pick IS NOT NULL
),
per_fixture AS (
  SELECT
    e."fixtureId",
    e.market_key,
    sum(1 / e.odds::double precision) AS overround,
    count(*)::int AS picks
  FROM expanded e
  WHERE e.odds > 1
  GROUP BY e."fixtureId", e.market_key
)
SELECT
  market_key AS "marketKey",
  count(*)::int AS fixtures,
  avg(overround)::double precision AS overround
FROM per_fixture
WHERE (market_key IN ('ONE_X_TWO', 'FIRST_HALF_WINNER') AND picks = 3)
   OR (market_key NOT IN ('ONE_X_TWO', 'FIRST_HALF_WINNER') AND picks = 2)
GROUP BY market_key
HAVING count(*) >= 1000
ORDER BY count(*) DESC
