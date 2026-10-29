WITH last_run AS (
  SELECT DISTINCT ON (mr."fixtureId") mr."fixtureId", mr."analyzedAt", mr.features,
         f."scheduledAt", f."homeScore", f."awayScore", c.code AS competition
  FROM model_run mr
  JOIN fixture f ON f.id = mr."fixtureId"
  JOIN season s ON s.id = f."seasonId"
  JOIN competition c ON c.id = s."competitionId"
  WHERE mr."analyzedAt" < f."scheduledAt" AND f.status = 'FINISHED'
    AND f."homeScore" IS NOT NULL AND f."awayScore" IS NOT NULL
    AND mr."analyzedAt" >= '2026-07-01'
    AND jsonb_typeof(mr.features->'probabilities') = 'object'
  ORDER BY mr."fixtureId", mr."analyzedAt" DESC
)
SELECT lr."fixtureId", lr."analyzedAt", lr."scheduledAt", lr.competition,
  extract(epoch FROM (lr."scheduledAt" - lr."analyzedAt"))/3600 AS hours_before,
  lr."homeScore" AS home_score, lr."awayScore" AS away_score,
  (lr.features->'probabilities'->>'home')::float AS pe_home,
  (lr.features->'probabilities'->>'draw')::float AS pe_draw,
  (lr.features->'probabilities'->>'away')::float AS pe_away,
  (lr.features->'probabilities'->>'over25')::float AS pe_over25,
  (lr.features->'probabilities'->>'bttsYes')::float AS pe_btts,
  (lr.features->'rawPoissonProbability'->>'home')::float AS raw_home,
  (lr.features->'rawPoissonProbability'->>'draw')::float AS raw_draw,
  (lr.features->'rawPoissonProbability'->>'away')::float AS raw_away,
  (lr.features->'rawPoissonProbability'->>'over25')::float AS raw_over25,
  (lr.features->'rawPoissonProbability'->>'bttsYes')::float AS raw_btts,
  (lr.features->>'lambdaHome')::float AS lambda_home,
  (lr.features->>'lambdaAway')::float AS lambda_away,
  (lr.features->>'recentForm')::float AS recent_form,
  (lr.features->>'xg')::float AS xg,
  (lr.features->>'performanceDomExt')::float AS perf_dom_ext,
  (lr.features->>'volatiliteLigue')::float AS volat_ligue,
  (lr.features->>'homeDrawRate')::float AS home_draw_rate,
  (lr.features->>'awayDrawRate')::float AS away_draw_rate,
  (lr.features->'offensiveBalance'->>'ratio')::float AS off_ratio,
  (lr.features->>'shadow_lineMovement')::float AS line_movement,
  (lr.features->>'shadow_congestion')::float AS congestion,
  CASE WHEN jsonb_typeof(lr.features->'shadow_h2h') = 'number' THEN (lr.features->>'shadow_h2h')::float END AS h2h,
  (lr.features->>'shadow_h2h_over25')::float AS h2h_over25,
  (lr.features->>'shadow_h2h_btts')::float AS h2h_btts,
  (lr.features->>'shadow_h2h_sample_size')::float AS h2h_n,
  (lr.features->'shadow_predictions'->'percent'->>'home')::float AS af_home,
  (lr.features->'shadow_predictions'->'percent'->>'draw')::float AS af_draw,
  (lr.features->'shadow_predictions'->'percent'->>'away')::float AS af_away,
  lr.features->>'engineConfigVersion' AS engine_version,
  x1.bookmaker AS bk_1x2, x1.ph AS pm_home, x1.pd AS pm_draw, x1.pa AS pm_away, x1.overround AS over_1x2, x1.age_h AS age_1x2_h,
  x2.p_over AS pm_over25, x2.overround AS over_ou,
  x3.p_yes AS pm_btts, x3.overround AS over_btts
FROM last_run lr
LEFT JOIN LATERAL (
  SELECT o.bookmaker,
         (1/o."homeOdds")/(1/o."homeOdds"+1/o."drawOdds"+1/o."awayOdds") AS ph,
         (1/o."drawOdds")/(1/o."homeOdds"+1/o."drawOdds"+1/o."awayOdds") AS pd,
         (1/o."awayOdds")/(1/o."homeOdds"+1/o."drawOdds"+1/o."awayOdds") AS pa,
         (1/o."homeOdds"+1/o."drawOdds"+1/o."awayOdds") - 1 AS overround,
         extract(epoch FROM (lr."analyzedAt" - o."snapshotAt"))/3600 AS age_h
  FROM odds_snapshot o
  WHERE o."fixtureId" = lr."fixtureId" AND o.market = 'ONE_X_TWO' AND o."snapshotAt" <= lr."analyzedAt"
    AND o."homeOdds" > 1 AND o."drawOdds" > 1 AND o."awayOdds" > 1
  ORDER BY (o.bookmaker = 'Pinnacle') DESC, (o.bookmaker = 'Bet365') DESC, o."snapshotAt" DESC
  LIMIT 1
) x1 ON true
LEFT JOIN LATERAL (
  SELECT (1/a.odds)/(1/a.odds+1/b.odds) AS p_over, (1/a.odds+1/b.odds) - 1 AS overround
  FROM odds_snapshot a
  JOIN odds_snapshot b ON b."fixtureId" = a."fixtureId" AND b.bookmaker = a.bookmaker AND b.market = a.market
       AND b.pick = 'UNDER' AND b.line IS NULL AND b."snapshotAt" = a."snapshotAt"
  WHERE a."fixtureId" = lr."fixtureId" AND a.market = 'OVER_UNDER' AND a.pick = 'OVER' AND a.line IS NULL
    AND a."snapshotAt" <= lr."analyzedAt" AND a.odds > 1 AND b.odds > 1
  ORDER BY (a.bookmaker = 'Pinnacle') DESC, (a.bookmaker = 'Bet365') DESC, a."snapshotAt" DESC
  LIMIT 1
) x2 ON true
LEFT JOIN LATERAL (
  SELECT (1/a.odds)/(1/a.odds+1/b.odds) AS p_yes, (1/a.odds+1/b.odds) - 1 AS overround
  FROM odds_snapshot a
  JOIN odds_snapshot b ON b."fixtureId" = a."fixtureId" AND b.bookmaker = a.bookmaker AND b.market = a.market
       AND b.pick = 'NO' AND b."snapshotAt" = a."snapshotAt"
  WHERE a."fixtureId" = lr."fixtureId" AND a.market = 'BTTS' AND a.pick = 'YES'
    AND a."snapshotAt" <= lr."analyzedAt" AND a.odds > 1 AND b.odds > 1
  ORDER BY (a.bookmaker = 'Pinnacle') DESC, (a.bookmaker = 'Bet365') DESC, a."snapshotAt" DESC
  LIMIT 1
) x3 ON true
ORDER BY lr."scheduledAt";
