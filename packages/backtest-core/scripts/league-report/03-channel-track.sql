-- Trace du moteur, sur les sélections analysées avant le coup d'envoi.
--
-- Déduplication obligatoire : une rencontre est ré-analysée plusieurs fois à
-- l'approche du coup d'envoi, et chaque ModelRun réécrit une ligne de
-- ChannelSelection. Sans DISTINCT ON, un même pari compte 5 à 7 fois, ce qui
-- divise artificiellement les erreurs types par ~2,4 et transforme des blocs
-- corrélés en faux échantillon. On ne garde que la DERNIÈRE analyse avant le
-- coup d'envoi, celle qui aurait effectivement été jouée.
WITH deduplicated AS (
  SELECT DISTINCT ON (cd.channel, mr."fixtureId", cs.market, cs.pick)
    cd.channel::text AS channel,
    cs.market::text AS market,
    f."seasonId",
    f."scheduledAt",
    cs.probability::double precision AS probability,
    cs.odds::double precision AS odds,
    (cs.result = 'WON') AS won
  FROM channel_selection cs
  JOIN channel_decision cd ON cd.id = cs."channelDecisionId"
  JOIN model_run mr ON mr.id = cd."modelRunId"
  JOIN fixture f ON f.id = mr."fixtureId"
  WHERE cs.result IN ('WON', 'LOST')
    AND mr."analyzedAt" < f."scheduledAt"
  ORDER BY
    cd.channel, mr."fixtureId", cs.market, cs.pick,
    mr."analyzedAt" DESC, cs.id DESC
)
SELECT
  c.code AS competition,
  d.channel,
  d.market,
  CASE WHEN d."scheduledAt" < TIMESTAMP '2026-08-25 00:00:00'
    THEN 'A' ELSE 'B' END AS period,
  count(*)::int AS n,
  count(*) FILTER (WHERE d.won)::int AS hits,
  sum(d.probability)::double precision AS announced,
  count(d.odds)::int AS "oddsN",
  coalesce(sum(d.odds) FILTER (WHERE d.odds IS NOT NULL), 0)::double precision
    AS "oddsSum",
  coalesce(sum(
    CASE WHEN d.won THEN d.odds - 1 ELSE -1 END
  ) FILTER (WHERE d.odds IS NOT NULL), 0)::double precision AS profit
FROM deduplicated d
JOIN season s ON s.id = d."seasonId"
JOIN competition c ON c.id = s."competitionId"
GROUP BY c.code, d.channel, d.market, period
ORDER BY c.code, d.channel, d.market, period
