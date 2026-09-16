-- L'edge annoncé (probabilité du moteur moins probabilité implicite de la
-- cote) est-il prédictif ? Un décile est un dixième des sélections live,
-- classées par edge croissant. Déduplication par dernière analyse avant le
-- coup d'envoi, sans quoi un même pari compterait 5 à 7 fois. Si l'edge
-- portait de l'information, le taux réalisé devrait monter avec lui.
WITH live AS (
  SELECT DISTINCT ON (cd.channel, mr."fixtureId", cs.market, cs.pick)
    cs.probability::double precision AS p,
    cs."impliedProbability"::double precision AS q,
    cs.odds::double precision AS o,
    (cs.result = 'WON') AS won
  FROM channel_selection cs
  JOIN channel_decision cd ON cd.id = cs."channelDecisionId"
  JOIN model_run mr ON mr.id = cd."modelRunId"
  JOIN fixture f ON f.id = mr."fixtureId"
  WHERE cs.result IN ('WON', 'LOST')
    AND mr."analyzedAt" < f."scheduledAt"
    AND cs.odds IS NOT NULL
    AND cs."impliedProbability" IS NOT NULL
  ORDER BY
    cd.channel, mr."fixtureId", cs.market, cs.pick,
    mr."analyzedAt" DESC, cs.id DESC
),
ranked AS (
  SELECT live.*, ntile(10) OVER (ORDER BY live.p - live.q) AS decile
  FROM live
)
SELECT
  decile::int AS decile,
  count(*)::int AS n,
  avg(p - q)::double precision AS "claimedEdge",
  avg(q)::double precision AS implied,
  avg(p)::double precision AS announced,
  avg(won::int)::double precision AS realised,
  avg(CASE WHEN won THEN o - 1 ELSE -1 END)::double precision AS "legRoi"
FROM ranked
GROUP BY decile
ORDER BY decile
