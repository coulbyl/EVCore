-- CLV par jambe de coupon, par source et par marché (chantier E, E-2/E-3).
--
-- Lit les colonnes de clôture écrites au règlement (`closingLineValue` =
-- cote prise × probabilité de clôture sans marge − 1, `closingValue` dans
-- analysis-core). Une jambe sans clôture assez fraîche (90 min, cf.
-- COUPON_SETTLEMENT_POLICY) reste à null et compte dans `legs` mais pas dans
-- `withClosing` : la couverture est la première chose à lire, l'acceptation
-- de E-2 est ≥ 80 %.
--
-- Le CLV ne dépend pas du résultat : son erreur type se compte en dixièmes
-- de point sur quelques centaines de jambes, là où le ROI en demande des
-- milliers (P-1, P-7). `meanClosingFair` est la probabilité de clôture
-- moyenne des jambes : comparée à `hitRate`, elle dit si la clôture était
-- elle-même calibrée sur cet échantillon.
--
-- Une ligne par (source, marché) et une ligne de total par source
-- (`market` = NULL).
SELECT
  p.source::text                                   AS source,
  l.market::text                                   AS market,
  count(*)::int                                    AS legs,
  count(l."closingLineValue")::int                 AS "withClosing",
  avg(l."closingLineValue")::float                 AS "meanClv",
  (stddev_samp(l."closingLineValue")
     / sqrt(nullif(count(l."closingLineValue"), 0)))::float AS "seClv",
  avg(CASE WHEN l."isCorrect" THEN 1.0 ELSE 0.0 END)
    FILTER (WHERE l."isCorrect" IS NOT NULL)::float AS "hitRate",
  avg((l."closingLineValue" + 1) / l."oddsSnapshot")
    FILTER (WHERE l."closingLineValue" IS NOT NULL)::float AS "meanClosingFair",
  avg(l."oddsSnapshot")::float                     AS "meanOdds",
  avg(l."closingOdds")::float                      AS "meanClosingOdds"
FROM coupon_proposal_leg l
JOIN coupon_proposal p ON p.id = l."couponProposalId"
WHERE l."settledAt" IS NOT NULL
GROUP BY GROUPING SETS ((p.source, l.market), (p.source))
ORDER BY p.source, l.market NULLS FIRST;
