-- Vivier de jambes pour le backtest de coupon jour par jour, sur toutes les
-- saisons cotées (2023 → 2026).
--
-- Aucune sortie du moteur n'intervient : la probabilité utilisée est celle du
-- marché, marge retirée par normalisation à l'intérieur de son groupe de
-- choix. C'est le meilleur estimateur dont on dispose (paragraphe 6 du
-- rapport : le réalisé suit l'implicite, pas l'annoncé).
--
-- "value" = fair x cote = l'inverse de la marge payée sur cette jambe. À prix
-- égal, la jambe de plus forte value est la moins taxée.
--
-- Réduction : une seule jambe par rencontre et par tranche de cote, la
-- moins taxée. Deux jambes du même match ne peuvent pas cohabiter dans un
-- coupon, et garder tout le carnet ferait exploser le volume sans rien
-- ajouter au choix.
WITH latest_per_book AS (
  SELECT DISTINCT ON (o."fixtureId", o.bookmaker, o.market, o.pick)
    o."fixtureId",
    o.bookmaker,
    o.market::text AS market,
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
      'ONE_X_TWO', 'OVER_UNDER', 'BTTS', 'DOUBLE_CHANCE', 'FIRST_HALF_WINNER'
    )
  ORDER BY
    o."fixtureId", o.bookmaker, o.market, o.pick,
    o."snapshotAt" DESC, o.id DESC
),
expanded AS (
  SELECT l."fixtureId", l.bookmaker, 'ONE_X_TWO'::text AS market_key, v.pick, v.odds
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
    l.bookmaker,
    CASE
      WHEN l.market <> 'OVER_UNDER' THEN l.market
      WHEN l.pick IN ('OVER', 'UNDER') THEN 'OVER_UNDER_2_5'
      ELSE 'OVER_UNDER_' || right(l.pick, 3)
    END,
    CASE
      WHEN l.market <> 'OVER_UNDER' THEN l.pick
      WHEN l.pick LIKE 'OVER%' THEN 'OVER'
      ELSE 'UNDER'
    END,
    l.odds
  FROM latest_per_book l
  WHERE l.market <> 'ONE_X_TWO' AND l.pick IS NOT NULL
),
consensus AS (
  SELECT
    e."fixtureId",
    e.market_key,
    e.pick,
    avg(e.odds)::double precision AS odds,
    max(e.odds)::double precision AS best,
    count(DISTINCT e.bookmaker)::int AS books
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
    k.best,
    k.books,
    (1 / k.odds)
      / (sum(1 / k.odds) OVER w
         / CASE WHEN k.market_key = 'DOUBLE_CHANCE' THEN 2 ELSE 1 END)
      AS fair,
    count(*) OVER w AS picks
  FROM consensus k
  WINDOW w AS (PARTITION BY k."fixtureId", k.market_key)
),
scored AS (
  SELECT
    n."fixtureId",
    f."scheduledAt",
    c.code AS competition,
    n.market_key,
    n.pick,
    n.odds,
    n.best,
    n.fair,
    n.books,
    res.won,
    CASE
      WHEN n.odds < 1.20 THEN 1
      WHEN n.odds < 1.35 THEN 2
      WHEN n.odds < 1.55 THEN 3
      WHEN n.odds < 1.80 THEN 4
      WHEN n.odds < 2.20 THEN 5
      WHEN n.odds < 2.80 THEN 6
      ELSE 7
    END AS band
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
  WHERE f."homeScore" IS NOT NULL
    AND f."awayScore" IS NOT NULL
    AND res.won IS NOT NULL
    AND n.odds BETWEEN 1.05 AND 4.00
    AND (
      (n.market_key IN ('ONE_X_TWO', 'FIRST_HALF_WINNER', 'DOUBLE_CHANCE')
        AND n.picks = 3)
      OR (n.market_key NOT IN
            ('ONE_X_TWO', 'FIRST_HALF_WINNER', 'DOUBLE_CHANCE')
        AND n.picks = 2)
    )
)
SELECT DISTINCT ON ("fixtureId", band)
  "fixtureId",
  to_char("scheduledAt", 'YYYY-MM-DD') AS day,
  competition,
  market_key AS "marketKey",
  pick,
  odds,
  best,
  fair,
  books,
  won
FROM scored
ORDER BY "fixtureId", band, fair * odds DESC, odds
