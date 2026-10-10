-- Marge payée par sélection contre meilleure marge disponible (chantier E,
-- E-5/E-6). Écrites par le moteur avec la sélection depuis le 2026-10-11 :
-- `marginPaid` est la surcote du groupe d'issues complet chez le book retenu,
-- `marginBest` la plus basse offerte par un book du relevé au même instant.
-- L'écart est ce que le choix du book coûte par rapport au meilleur prix
-- disponible — cible du plan : < 0,5 point par jour.
-- Une ligne par marché, une par book retenu, et un total (NULL).
SELECT
  -- 3 = total, 1 = par marché, 2 = par book (GROUPING : bit 2 = marché, bit 1 = book).
  GROUPING(s.market, s."oddsBookmaker")::int       AS level,
  s.market::text                                   AS market,
  s."oddsBookmaker"                                AS bookmaker,
  count(*)::int                                    AS selections,
  count(s."marginPaid")::int                       AS "withMargin",
  avg(s."marginPaid")::float                       AS "marginPaid",
  avg(s."marginBest")::float                       AS "marginBest",
  avg(s."marginPaid" - s."marginBest")::float      AS gap,
  (stddev_samp(s."marginPaid" - s."marginBest")
     / sqrt(nullif(count(s."marginPaid"), 0)))::float AS "gapSe"
FROM channel_selection_deduped s
WHERE s.odds IS NOT NULL
  AND s."scheduledAt" >= now() - INTERVAL '30 days'
GROUP BY GROUPING SETS ((s.market), (s."oddsBookmaker"), ())
ORDER BY level, s.market NULLS LAST, s."oddsBookmaker" NULLS LAST;
