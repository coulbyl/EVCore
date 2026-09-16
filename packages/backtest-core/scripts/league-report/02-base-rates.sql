WITH fx AS (
  SELECT
    c.code AS competition,
    s.name AS season,
    s."startDate" AS season_start,
    f."homeScore" AS home_score,
    f."awayScore" AS away_score,
    f."homeHtScore" AS ht_home,
    f."awayHtScore" AS ht_away
  FROM fixture f
  JOIN season s ON s.id = f."seasonId"
  JOIN competition c ON c.id = s."competitionId"
  WHERE f.status = 'FINISHED'
    AND f."homeScore" IS NOT NULL
    AND f."awayScore" IS NOT NULL
)
SELECT
  fx.competition,
  fx.season,
  fx.season_start AS "seasonStart",
  o.outcome,
  count(*)::int AS n,
  count(*) FILTER (WHERE o.hit)::int AS hits
FROM fx
CROSS JOIN LATERAL (VALUES
  ('1X2_HOME', fx.home_score > fx.away_score),
  ('1X2_DRAW', fx.home_score = fx.away_score),
  ('1X2_AWAY', fx.home_score < fx.away_score),
  ('DC_1X', fx.home_score >= fx.away_score),
  ('DC_X2', fx.home_score <= fx.away_score),
  ('DC_12', fx.home_score <> fx.away_score),
  ('OVER_1_5', fx.home_score + fx.away_score >= 2),
  ('OVER_2_5', fx.home_score + fx.away_score >= 3),
  ('OVER_3_5', fx.home_score + fx.away_score >= 4),
  ('UNDER_2_5', fx.home_score + fx.away_score <= 2),
  ('UNDER_3_5', fx.home_score + fx.away_score <= 3),
  ('BTTS_YES', fx.home_score > 0 AND fx.away_score > 0),
  ('BTTS_NO', fx.home_score = 0 OR fx.away_score = 0),
  ('CLEAN_SHEET_HOME', fx.away_score = 0),
  ('CLEAN_SHEET_AWAY', fx.home_score = 0),
  ('WIN_TO_NIL_HOME', fx.home_score > fx.away_score AND fx.away_score = 0),
  ('WIN_TO_NIL_AWAY', fx.away_score > fx.home_score AND fx.home_score = 0),
  ('TEAM_TOTAL_HOME_OVER_0_5', fx.home_score >= 1),
  ('TEAM_TOTAL_HOME_OVER_1_5', fx.home_score >= 2),
  ('TEAM_TOTAL_AWAY_OVER_0_5', fx.away_score >= 1),
  ('TEAM_TOTAL_AWAY_OVER_1_5', fx.away_score >= 2),
  ('HT_HOME', fx.ht_home > fx.ht_away),
  ('HT_DRAW', fx.ht_home = fx.ht_away),
  ('HT_AWAY', fx.ht_home < fx.ht_away),
  ('HT_OVER_0_5', fx.ht_home + fx.ht_away >= 1),
  ('HT_OVER_1_5', fx.ht_home + fx.ht_away >= 2),
  ('HT_UNDER_1_5', fx.ht_home + fx.ht_away <= 1),
  ('WIN_EITHER_HALF_HOME',
    fx.ht_home > fx.ht_away
    OR (fx.home_score - fx.ht_home) > (fx.away_score - fx.ht_away)),
  ('WIN_EITHER_HALF_AWAY',
    fx.ht_away > fx.ht_home
    OR (fx.away_score - fx.ht_away) > (fx.home_score - fx.ht_home))
) AS o(outcome, hit)
WHERE o.hit IS NOT NULL
GROUP BY fx.competition, fx.season, fx.season_start, o.outcome
ORDER BY fx.competition, o.outcome, fx.season_start
