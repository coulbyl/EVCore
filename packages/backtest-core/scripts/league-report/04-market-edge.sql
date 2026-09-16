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
    AND o.market IN (
      'ONE_X_TWO', 'OVER_UNDER', 'BTTS',
      'DOUBLE_CHANCE', 'FIRST_HALF_WINNER'
    )
  ORDER BY
    o."fixtureId", o.bookmaker, o.market, o.pick,
    o."snapshotAt" DESC, o.id DESC
),
expanded AS (
  SELECT l."fixtureId", 'ONE_X_TWO'::text AS market_key, v.pick, v.odds
  FROM latest_per_book l
  CROSS JOIN LATERAL (VALUES
    ('HOME'::text, l."homeOdds"),
    ('DRAW'::text, l."drawOdds"),
    ('AWAY'::text, l."awayOdds")
  ) AS v(pick, odds)
  WHERE l.market = 'ONE_X_TWO'
  UNION ALL
  SELECT
    l."fixtureId",
    CASE
      WHEN l.market <> 'OVER_UNDER' THEN l.market::text
      WHEN l.pick IN ('OVER', 'UNDER') THEN 'OVER_UNDER_2_5'
      ELSE 'OVER_UNDER_' || right(l.pick, 3)
    END AS market_key,
    CASE
      WHEN l.market <> 'OVER_UNDER' THEN l.pick
      WHEN l.pick LIKE 'OVER%' THEN 'OVER'
      ELSE 'UNDER'
    END AS pick,
    l.odds
  FROM latest_per_book l
  WHERE l.market <> 'ONE_X_TWO' AND l.pick IS NOT NULL
),
consensus AS (
  SELECT
    e."fixtureId",
    e.market_key,
    e.pick,
    avg(e.odds)::double precision AS odds
  FROM expanded e
  WHERE e.odds > 1
  GROUP BY e."fixtureId", e.market_key, e.pick
),
normalized AS (
  SELECT
    k."fixtureId",
    k.market_key,
    k.pick,
    k.odds,
    (1 / k.odds)
      / (sum(1 / k.odds) OVER w
         / CASE WHEN k.market_key = 'DOUBLE_CHANCE' THEN 2 ELSE 1 END)
      AS implied,
    count(*) OVER w AS picks
  FROM consensus k
  WINDOW w AS (PARTITION BY k."fixtureId", k.market_key)
)
SELECT
  c.code AS competition,
  n.market_key AS "marketKey",
  n.pick,
  count(*)::int AS n,
  count(*) FILTER (WHERE res.won)::int AS hits,
  sum(n.implied)::double precision AS "impliedSum",
  sum(n.odds)::double precision AS "oddsSum"
FROM normalized n
JOIN fixture f ON f.id = n."fixtureId"
JOIN season s ON s.id = f."seasonId"
JOIN competition c ON c.id = s."competitionId"
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN n.market_key = 'ONE_X_TWO' AND n.pick = 'HOME'
      THEN f."homeScore" > f."awayScore"
    WHEN n.market_key = 'ONE_X_TWO' AND n.pick = 'DRAW'
      THEN f."homeScore" = f."awayScore"
    WHEN n.market_key = 'ONE_X_TWO' AND n.pick = 'AWAY'
      THEN f."homeScore" < f."awayScore"
    WHEN n.market_key = 'DOUBLE_CHANCE' AND n.pick = '1X'
      THEN f."homeScore" >= f."awayScore"
    WHEN n.market_key = 'DOUBLE_CHANCE' AND n.pick = 'X2'
      THEN f."homeScore" <= f."awayScore"
    WHEN n.market_key = 'DOUBLE_CHANCE' AND n.pick = '12'
      THEN f."homeScore" <> f."awayScore"
    WHEN n.market_key = 'BTTS' AND n.pick = 'YES'
      THEN f."homeScore" > 0 AND f."awayScore" > 0
    WHEN n.market_key = 'BTTS' AND n.pick = 'NO'
      THEN f."homeScore" = 0 OR f."awayScore" = 0
    WHEN n.market_key = 'FIRST_HALF_WINNER' AND n.pick = 'HOME'
      THEN f."homeHtScore" > f."awayHtScore"
    WHEN n.market_key = 'FIRST_HALF_WINNER' AND n.pick = 'DRAW'
      THEN f."homeHtScore" = f."awayHtScore"
    WHEN n.market_key = 'FIRST_HALF_WINNER' AND n.pick = 'AWAY'
      THEN f."homeHtScore" < f."awayHtScore"
    WHEN n.market_key LIKE 'OVER_UNDER_%' AND n.pick = 'OVER'
      THEN f."homeScore" + f."awayScore"
        > replace(right(n.market_key, 3), '_', '.')::double precision
    WHEN n.market_key LIKE 'OVER_UNDER_%' AND n.pick = 'UNDER'
      THEN f."homeScore" + f."awayScore"
        < replace(right(n.market_key, 3), '_', '.')::double precision
    ELSE NULL
  END AS won
) AS res
WHERE res.won IS NOT NULL
  AND (
    (n.market_key IN ('ONE_X_TWO', 'FIRST_HALF_WINNER', 'DOUBLE_CHANCE')
      AND n.picks = 3)
    OR (n.market_key NOT IN
          ('ONE_X_TWO', 'FIRST_HALF_WINNER', 'DOUBLE_CHANCE')
      AND n.picks = 2)
  )
GROUP BY c.code, n.market_key, n.pick
ORDER BY c.code, n.market_key, n.pick
