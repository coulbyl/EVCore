-- Features point-in-time par rencontre, pour chercher un edge sur le prix.
--
-- Tout est recalculé depuis l'historique des matchs par fenêtrage : la table
-- `standing` n'a pas d'historique (syncedAt est écrasé), elle est donc
-- inutilisable pour un backtest. Chaque fenêtre exclut explicitement la
-- rencontre courante (`1 PRECEDING`), sans quoi le résultat fuiterait dans
-- ses propres features.
--
-- La cible n'est pas le résultat mais le **résidu** : réalisé moins
-- probabilité implicite du marché, marge retirée. On ne cherche pas à prédire
-- un match, on cherche à battre un prix.
WITH team_match AS (
  SELECT
    f.id AS fixture_id,
    f."seasonId" AS season_id,
    f."scheduledAt" AS ts,
    f."homeTeamId" AS team_id,
    TRUE AS is_home,
    f."homeScore" AS gf,
    f."awayScore" AS ga,
    f."homeXg"::double precision AS xgf,
    f."awayXg"::double precision AS xga
  FROM fixture f
  WHERE f.status = 'FINISHED'
    AND f."homeScore" IS NOT NULL
    AND f."awayScore" IS NOT NULL
  UNION ALL
  SELECT
    f.id,
    f."seasonId",
    f."scheduledAt",
    f."awayTeamId",
    FALSE,
    f."awayScore",
    f."homeScore",
    f."awayXg"::double precision,
    f."homeXg"::double precision
  FROM fixture f
  WHERE f.status = 'FINISHED'
    AND f."homeScore" IS NOT NULL
    AND f."awayScore" IS NOT NULL
),
scored AS (
  SELECT
    tm.*,
    CASE WHEN tm.gf > tm.ga THEN 3 WHEN tm.gf = tm.ga THEN 1 ELSE 0 END AS pts
  FROM team_match tm
),
features AS (
  SELECT
    s.fixture_id,
    s.team_id,
    s.is_home,
    EXTRACT(EPOCH FROM (s.ts - lag(s.ts) OVER w)) / 86400 AS rest_days,
    count(*) OVER w14 AS matches_14d,
    avg(s.pts) OVER w5 AS form5,
    avg(s.gf) OVER w5 AS goals_for5,
    avg(s.ga) OVER w5 AS goals_against5,
    avg(s.xgf) OVER w5 AS xg_for5,
    avg(s.xga) OVER w5 AS xg_against5,
    avg(s.pts) OVER w5v AS venue_form5,
    avg(s.gf + s.ga) OVER w5 AS total_goals5,
    count(*) OVER wseason AS played_season,
    avg(s.pts) OVER wseason AS ppg_season
  FROM scored s
  WINDOW
    w AS (PARTITION BY s.team_id ORDER BY s.ts),
    w5 AS (
      PARTITION BY s.team_id ORDER BY s.ts
      ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING
    ),
    w5v AS (
      PARTITION BY s.team_id, s.is_home ORDER BY s.ts
      ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING
    ),
    w14 AS (
      PARTITION BY s.team_id ORDER BY s.ts
      RANGE BETWEEN INTERVAL '14 days' PRECEDING
                AND INTERVAL '1 second' PRECEDING
    ),
    wseason AS (
      PARTITION BY s.team_id, s.season_id ORDER BY s.ts
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    )
),
latest_per_book AS (
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
    AND o.market IN ('ONE_X_TWO', 'OVER_UNDER', 'BTTS')
  ORDER BY
    o."fixtureId", o.bookmaker, o.market, o.pick,
    o."snapshotAt" DESC, o.id DESC
),
expanded AS (
  SELECT l."fixtureId", l.bookmaker, 'ONE_X_TWO'::text AS mk, v.pick, v.odds
  FROM latest_per_book l
  CROSS JOIN LATERAL (VALUES
    ('HOME'::text, l."homeOdds"),
    ('DRAW'::text, l."drawOdds"),
    ('AWAY'::text, l."awayOdds")
  ) AS v(pick, odds)
  WHERE l.market = 'ONE_X_TWO'
  UNION ALL
  SELECT l."fixtureId", l.bookmaker, 'OVER_UNDER_2_5', l.pick, l.odds
  FROM latest_per_book l
  WHERE l.market = 'OVER_UNDER' AND l.pick IN ('OVER', 'UNDER')
  UNION ALL
  SELECT l."fixtureId", l.bookmaker, 'BTTS', l.pick, l.odds
  FROM latest_per_book l
  WHERE l.market = 'BTTS' AND l.pick IN ('YES', 'NO')
),
consensus AS (
  SELECT e."fixtureId", e.mk, e.pick,
    avg(e.odds)::double precision AS odds,
    max(e.odds)::double precision AS best,
    count(DISTINCT e.bookmaker)::int AS books
  FROM expanded e
  WHERE e.odds > 1
  GROUP BY e."fixtureId", e.mk, e.pick
),
normalized AS (
  SELECT
    c.*,
    (1 / c.odds) / sum(1 / c.odds) OVER w AS fair,
    count(*) OVER w AS picks
  FROM consensus c
  WINDOW w AS (PARTITION BY c."fixtureId", c.mk)
),
priced AS (
  SELECT
    "fixtureId",
    max(fair) FILTER (WHERE mk = 'ONE_X_TWO' AND pick = 'HOME') AS fair_home,
    max(fair) FILTER (WHERE mk = 'ONE_X_TWO' AND pick = 'DRAW') AS fair_draw,
    max(fair) FILTER (WHERE mk = 'ONE_X_TWO' AND pick = 'AWAY') AS fair_away,
    max(best) FILTER (WHERE mk = 'ONE_X_TWO' AND pick = 'HOME') AS best_home,
    max(best) FILTER (WHERE mk = 'ONE_X_TWO' AND pick = 'AWAY') AS best_away,
    max(best) FILTER (WHERE mk = 'OVER_UNDER_2_5' AND pick = 'OVER') AS best_over,
    max(best) FILTER (WHERE mk = 'BTTS' AND pick = 'YES') AS best_btts,
    max(books) FILTER (WHERE mk = 'OVER_UNDER_2_5' AND pick = 'OVER') AS books_over,
    max(odds) FILTER (WHERE mk = 'ONE_X_TWO' AND pick = 'HOME') AS odds_home,
    max(odds) FILTER (WHERE mk = 'ONE_X_TWO' AND pick = 'AWAY') AS odds_away,
    max(fair) FILTER (WHERE mk = 'OVER_UNDER_2_5' AND pick = 'OVER') AS fair_over,
    max(odds) FILTER (WHERE mk = 'OVER_UNDER_2_5' AND pick = 'OVER') AS odds_over,
    max(fair) FILTER (WHERE mk = 'BTTS' AND pick = 'YES') AS fair_btts,
    max(odds) FILTER (WHERE mk = 'BTTS' AND pick = 'YES') AS odds_btts,
    count(*) FILTER (WHERE mk = 'ONE_X_TWO') AS picks_1x2
  FROM normalized
  GROUP BY "fixtureId"
)
SELECT
  f.id AS "fixtureId",
  to_char(f."scheduledAt", 'YYYY-MM-DD') AS day,
  c.code AS competition,
  p.fair_home AS "fairHome",
  p.fair_draw AS "fairDraw",
  p.fair_away AS "fairAway",
  p.odds_home AS "oddsHome",
  p.best_home AS "bestHome",
  p.best_away AS "bestAway",
  p.best_over AS "bestOver",
  p.best_btts AS "bestBtts",
  p.books_over AS "booksOver",
  p.odds_away AS "oddsAway",
  p.fair_over AS "fairOver",
  p.odds_over AS "oddsOver",
  p.fair_btts AS "fairBtts",
  p.odds_btts AS "oddsBtts",
  (f."homeScore" > f."awayScore") AS "homeWon",
  (f."homeScore" = f."awayScore") AS "drew",
  (f."homeScore" < f."awayScore") AS "awayWon",
  (f."homeScore" + f."awayScore" >= 3) AS "over25",
  (f."homeScore" > 0 AND f."awayScore" > 0) AS "bttsYes",
  h.rest_days AS "homeRest",
  a.rest_days AS "awayRest",
  h.matches_14d::int AS "homeMatches14",
  a.matches_14d::int AS "awayMatches14",
  h.form5 AS "homeForm5",
  a.form5 AS "awayForm5",
  h.venue_form5 AS "homeVenueForm5",
  a.venue_form5 AS "awayVenueForm5",
  h.goals_for5 AS "homeGoalsFor5",
  h.goals_against5 AS "homeGoalsAgainst5",
  a.goals_for5 AS "awayGoalsFor5",
  a.goals_against5 AS "awayGoalsAgainst5",
  h.xg_for5 AS "homeXgFor5",
  h.xg_against5 AS "homeXgAgainst5",
  a.xg_for5 AS "awayXgFor5",
  a.xg_against5 AS "awayXgAgainst5",
  h.total_goals5 AS "homeTotalGoals5",
  a.total_goals5 AS "awayTotalGoals5",
  h.played_season::int AS "homePlayed",
  a.played_season::int AS "awayPlayed",
  h.ppg_season AS "homePpg",
  a.ppg_season AS "awayPpg"
FROM fixture f
JOIN season s ON s.id = f."seasonId"
JOIN competition c ON c.id = s."competitionId"
JOIN priced p ON p."fixtureId" = f.id
JOIN features h ON h.fixture_id = f.id AND h.is_home
JOIN features a ON a.fixture_id = f.id AND NOT a.is_home
WHERE f.status = 'FINISHED'
  AND f."homeScore" IS NOT NULL
  AND p.picks_1x2 = 3
ORDER BY f."scheduledAt", f.id
