WITH sel AS (
  SELECT d.channel, d.market, d.pick, d."fixtureId", d."analyzedAt", d."scheduledAt", c.code AS competition,
         d.probability::float AS p_engine, d.odds::float AS odds,
         (mr.features->'shadow_ml_by_channel'->d.channel::text->>'correctedP')::float AS p_ml,
         mr.features->'shadow_ml_by_channel'->d.channel::text->>'modelId' AS model_id,
         d."closingOdds"::float AS closing_odds,
         (d.result = 'WON')::int AS won,
         CASE
           WHEN d.pick LIKE 'OVER%'  THEN 'UNDER' || substr(d.pick, 5)
           WHEN d.pick LIKE 'UNDER%' THEN 'OVER'  || substr(d.pick, 6)
           WHEN d.pick = 'YES' THEN 'NO'
           WHEN d.pick = 'NO'  THEN 'YES'
         END AS complement
  FROM channel_selection_deduped d
  JOIN channel_decision cd ON cd.id = d."channelDecisionId"
  JOIN model_run mr ON mr.id = cd."modelRunId"
  JOIN fixture f ON f.id = d."fixtureId"
  JOIN season s ON s.id = f."seasonId"
  JOIN competition c ON c.id = s."competitionId"
  WHERE d.result IN ('WON','LOST') AND d.rank = 1
    AND jsonb_typeof(mr.features->'shadow_ml_by_channel') = 'object'
    AND mr.features->'shadow_ml_by_channel' ? d.channel::text
)
SELECT sel.*, px.bookmaker, px.snap_at,
       extract(epoch FROM (sel."analyzedAt" - px.snap_at)) / 3600 AS snap_age_h,
       px.p_fair, px.overround
FROM sel
LEFT JOIN LATERAL (
  -- 1X2 : les trois cotes sur la même ligne
  SELECT o.bookmaker, o."snapshotAt" AS snap_at,
         (1 / CASE sel.pick WHEN 'HOME' THEN o."homeOdds" WHEN 'DRAW' THEN o."drawOdds" ELSE o."awayOdds" END)
           / (1/o."homeOdds" + 1/o."drawOdds" + 1/o."awayOdds") AS p_fair,
         (1/o."homeOdds" + 1/o."drawOdds" + 1/o."awayOdds") - 1 AS overround
  FROM odds_snapshot o
  WHERE sel.market = 'ONE_X_TWO' AND o."fixtureId" = sel."fixtureId" AND o.market = 'ONE_X_TWO'
    AND o."snapshotAt" <= sel."analyzedAt" AND o."homeOdds" > 1 AND o."drawOdds" > 1 AND o."awayOdds" > 1
  ORDER BY (o.bookmaker = 'Pinnacle') DESC, (o.bookmaker = 'Bet365') DESC, o."snapshotAt" DESC
  LIMIT 1
) x1 ON true
LEFT JOIN LATERAL (
  -- marchés à deux issues : le pari et son complément au même relevé
  SELECT a.bookmaker, a."snapshotAt" AS snap_at,
         (1/a.odds) / (1/a.odds + 1/b.odds) AS p_fair,
         (1/a.odds + 1/b.odds) - 1 AS overround
  FROM odds_snapshot a
  JOIN odds_snapshot b ON b."fixtureId" = a."fixtureId" AND b.bookmaker = a.bookmaker AND b.market = a.market
                      AND b.pick = sel.complement AND b.line IS NOT DISTINCT FROM a.line AND b."snapshotAt" = a."snapshotAt"
  WHERE sel.complement IS NOT NULL AND a."fixtureId" = sel."fixtureId" AND a.market = sel.market AND a.pick = sel.pick
    AND a."snapshotAt" <= sel."analyzedAt" AND a.odds > 1 AND b.odds > 1
  ORDER BY (a.bookmaker = 'Pinnacle') DESC, (a.bookmaker = 'Bet365') DESC, a."snapshotAt" DESC
  LIMIT 1
) x2 ON true
CROSS JOIN LATERAL (SELECT COALESCE(x1.bookmaker, x2.bookmaker) AS bookmaker, COALESCE(x1.snap_at, x2.snap_at) AS snap_at,
                           COALESCE(x1.p_fair, x2.p_fair)::float AS p_fair, COALESCE(x1.overround, x2.overround)::float AS overround) px
ORDER BY sel."analyzedAt";
