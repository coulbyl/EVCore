-- CLV par sélection de canal, par canal et par marché (chantier E, E-2/E-3).
--
-- Lit la vue dédupliquée (un pari = une ligne, dernière analyse d'avant
-- coup d'envoi) et les colonnes de clôture écrites au règlement final :
-- `closingLineValue` = cote de la sélection × probabilité de clôture sans
-- marge − 1, chez le book de la sélection (`oddsBookmaker`) quand il cote le
-- groupe complet à moins de 90 min, sinon le mieux classé.
--
-- `withProvenance` dit combien de sélections connaissent leur book : avant
-- le 2026-10-08 aucune, le chargeur jetait ce nom. `withClosing` est la
-- couverture du CLV (acceptation E-2 : 80 %). Une ligne par (canal, marché)
-- et un total par canal (`market` = NULL), sur les sélections réglées.
SELECT
  s.channel::text                                  AS channel,
  s.market::text                                   AS market,
  count(*)::int                                    AS selections,
  count(s."oddsBookmaker")::int                    AS "withProvenance",
  count(s."closingLineValue")::int                 AS "withClosing",
  avg(s."closingLineValue")::float                 AS "meanClv",
  (stddev_samp(s."closingLineValue")
     / sqrt(nullif(count(s."closingLineValue"), 0)))::float AS "seClv",
  avg(CASE WHEN s.result = 'WON' THEN 1.0 ELSE 0.0 END)
    FILTER (WHERE s.result IN ('WON', 'LOST'))::float AS "hitRate",
  avg((s."closingLineValue" + 1) / s.odds)
    FILTER (WHERE s."closingLineValue" IS NOT NULL)::float AS "meanClosingFair",
  -- Valeur du MÊME choix pris au prix de clôture : c'est la marge payée,
  -- et la barre contre laquelle se lit le CLV (un pari pris à la clôture
  -- vaut moins la marge, jamais zéro).
  avg(s."closingOdds" * (s."closingLineValue" + 1) / s.odds - 1)
    FILTER (WHERE s."closingLineValue" IS NOT NULL)::float AS "clvAtClose",
  -- Écart entre prix pris et prix de clôture, en probabilité de clôture :
  -- positif, le prix pris battait la clôture.
  avg((s."closingLineValue" + 1) / s.odds * (s.odds - s."closingOdds"))
    FILTER (WHERE s."closingLineValue" IS NOT NULL)::float AS "excess",
  (stddev_samp((s."closingLineValue" + 1) / s.odds * (s.odds - s."closingOdds"))
     / sqrt(nullif(count(s."closingLineValue"), 0)))::float AS "excessSe",
  avg(s.odds)::float                               AS "meanOdds",
  avg(s."closingOdds")::float                      AS "meanClosingOdds"
FROM channel_selection_deduped s
WHERE s."settledAt" IS NOT NULL
  AND s.odds IS NOT NULL
GROUP BY GROUPING SETS ((s.channel, s.market), (s.channel))
ORDER BY s.channel, s.market NULLS FIRST;
