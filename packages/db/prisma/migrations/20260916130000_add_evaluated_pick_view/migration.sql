-- Espace d'opportunités du moteur, réglé contre le score réel.
--
-- POURQUOI UNE VUE. `ModelRun.features.evaluatedPicks` porte TOUT ce que le
-- moteur a envisagé sur chaque rencontre — 17 marchés, retenus comme rejetés —
-- avec le prix du marché au moment de l'analyse. C'est à la fois le vivier du
-- jour pour un compositeur et l'historique qui en mesure le coût. Les deux
-- doivent sortir de la même source, sans quoi on calibre sur un espace et on
-- compose dans un autre.
--
-- `won` vaut NULL dans deux cas distincts qu'il faut savoir distinguer :
-- rencontre pas encore jouée (c'est le vivier), ou remboursement (Draw No Bet
-- sur match nul). Le filtre `won IS NOT NULL` isole donc l'historique réglé.
--
-- Le règlement a été vérifié : la somme des taux réalisés vaut exactement
-- 1,0000 sur ONE_X_TWO, BTTS et RESULT_BTTS, 1,93 sur Double Chance (deux
-- issues vraies sur trois par match) et 0,73 sur Draw No Bet.
CREATE OR REPLACE VIEW "public"."evaluated_pick" AS
WITH latest_run AS (
  -- Une rencontre est ré-analysée 5 à 7 fois : on ne garde que la dernière
  -- analyse d'avant coup d'envoi, sinon les blocs corrélés passent pour un
  -- échantillon et les intervalles sont divisés par ~2,4.
  SELECT DISTINCT ON (mr."fixtureId")
         mr."fixtureId", mr.features
  FROM model_run mr
  JOIN fixture f ON f.id = mr."fixtureId"
  WHERE mr.features ? 'evaluatedPicks'
    AND mr."analyzedAt" < f."scheduledAt"
  ORDER BY mr."fixtureId", mr."analyzedAt" DESC
),
raw AS (
  SELECT lr."fixtureId",
         p->>'market'                AS market,
         p->>'pick'                  AS pick,
         (p->>'odds')::numeric       AS odds,
         (p->>'probability')::numeric AS model_prob,
         p->>'status'                AS status,
         p->>'rejectionReason'       AS rejection_reason
  FROM latest_run lr, jsonb_array_elements(lr.features->'evaluatedPicks') p
)
SELECT
  r."fixtureId", r.market, r.pick, r.odds, r.model_prob, r.status,
  r.rejection_reason,
  c.code                     AS competition,
  f."scheduledAt"::date      AS day,
  -- Horodatage complet et statut : le vivier du jour doit pouvoir écarter les
  -- rencontres déjà commencées, ce qu'une date seule ne permet pas.
  f."scheduledAt"            AS "scheduledAt",
  f.status                   AS "fixtureStatus",
  g.line,
  CASE r.market
    WHEN 'ONE_X_TWO' THEN CASE r.pick
      WHEN 'HOME' THEN f."homeScore" > f."awayScore"
      WHEN 'AWAY' THEN f."awayScore" > f."homeScore"
      WHEN 'DRAW' THEN f."homeScore" = f."awayScore" END
    WHEN 'DOUBLE_CHANCE' THEN CASE r.pick
      WHEN '1X' THEN f."homeScore" >= f."awayScore"
      WHEN 'X2' THEN f."awayScore" >= f."homeScore"
      WHEN '12' THEN f."homeScore" <> f."awayScore" END
    -- Le nul rembourse : le compter perdu inventerait une perte de 30 %.
    WHEN 'DRAW_NO_BET' THEN CASE
      WHEN f."homeScore" = f."awayScore" THEN NULL
      WHEN r.pick = 'HOME' THEN f."homeScore" > f."awayScore"
      ELSE f."awayScore" > f."homeScore" END
    WHEN 'BTTS' THEN
      (f."homeScore" > 0 AND f."awayScore" > 0) = (r.pick = 'YES')
    WHEN 'OVER_UNDER' THEN
      (f."homeScore" + f."awayScore" > g.line) = (g.direction = 'OVER')
    WHEN 'TEAM_TOTAL_HOME' THEN
      (f."homeScore" > g.line) = (g.direction = 'OVER')
    WHEN 'TEAM_TOTAL_AWAY' THEN
      (f."awayScore" > g.line) = (g.direction = 'OVER')
    WHEN 'CLEAN_SHEET_HOME' THEN (f."awayScore" = 0) = (r.pick = 'YES')
    WHEN 'CLEAN_SHEET_AWAY' THEN (f."homeScore" = 0) = (r.pick = 'YES')
    WHEN 'WIN_TO_NIL_HOME' THEN
      (f."homeScore" > f."awayScore" AND f."awayScore" = 0) = (r.pick = 'YES')
    WHEN 'WIN_TO_NIL_AWAY' THEN
      (f."awayScore" > f."homeScore" AND f."homeScore" = 0) = (r.pick = 'YES')
    WHEN 'RESULT_BTTS' THEN
      g.outcome = CASE
        WHEN f."homeScore" > f."awayScore" THEN 'HOME'
        WHEN f."awayScore" > f."homeScore" THEN 'AWAY' ELSE 'DRAW' END
      AND (f."homeScore" > 0 AND f."awayScore" > 0) = (g.suffix = 'YES')
    WHEN 'RESULT_TOTAL_GOALS' THEN
      g.outcome = CASE
        WHEN f."homeScore" > f."awayScore" THEN 'HOME'
        WHEN f."awayScore" > f."homeScore" THEN 'AWAY' ELSE 'DRAW' END
      AND (f."homeScore" + f."awayScore" > g.line) = (g.direction = 'OVER')
    -- Marchés de mi-temps : sans score à la pause, non réglable, pas perdu.
    WHEN 'FIRST_HALF_WINNER' THEN CASE
      WHEN f."homeHtScore" IS NULL THEN NULL
      WHEN r.pick = 'HOME' THEN f."homeHtScore" > f."awayHtScore"
      WHEN r.pick = 'AWAY' THEN f."awayHtScore" > f."homeHtScore"
      ELSE f."homeHtScore" = f."awayHtScore" END
    WHEN 'OVER_UNDER_HT' THEN CASE
      WHEN f."homeHtScore" IS NULL THEN NULL
      ELSE (f."homeHtScore" + f."awayHtScore" > g.line) = (g.direction = 'OVER')
      END
    WHEN 'HALF_TIME_FULL_TIME' THEN CASE
      WHEN f."homeHtScore" IS NULL THEN NULL
      ELSE g.outcome = CASE
             WHEN f."homeHtScore" > f."awayHtScore" THEN 'HOME'
             WHEN f."awayHtScore" > f."homeHtScore" THEN 'AWAY' ELSE 'DRAW' END
       AND g.suffix = CASE
             WHEN f."homeScore" > f."awayScore" THEN 'HOME'
             WHEN f."awayScore" > f."homeScore" THEN 'AWAY' ELSE 'DRAW' END
      END
    -- Gagner au moins une mi-temps : la 2e se déduit par différence.
    WHEN 'TO_WIN_EITHER_HALF' THEN CASE
      WHEN f."homeHtScore" IS NULL THEN NULL
      WHEN r.pick = 'HOME' THEN
        f."homeHtScore" > f."awayHtScore"
        OR (f."homeScore" - f."homeHtScore") > (f."awayScore" - f."awayHtScore")
      ELSE
        f."awayHtScore" > f."homeHtScore"
        OR (f."awayScore" - f."awayHtScore") > (f."homeScore" - f."homeHtScore")
      END
  END AS won
FROM raw r
JOIN fixture f     ON f.id = r."fixtureId"
JOIN season s      ON s.id = f."seasonId"
JOIN competition c ON c.id = s."competitionId"
CROSS JOIN LATERAL (
  SELECT
    -- 'HOME_OVER_2_5' -> 2.5 ; 'OVER' seul vaut la ligne par défaut 2.5.
    CASE WHEN r.pick ~ '_\d+_\d+$'
         THEN (regexp_replace(r.pick, '^.*_(\d+)_(\d+)$', '\1.\2'))::numeric
         ELSE 2.5 END                                     AS line,
    CASE WHEN r.pick LIKE '%UNDER%' THEN 'UNDER' ELSE 'OVER' END AS direction,
    split_part(r.pick, '_', 1)                            AS outcome,
    -- 'HOME_YES' -> 'YES', 'HOME_OVER_1_5' -> 'OVER', 'DRAW_HOME' -> 'HOME'.
    split_part(r.pick, '_', 2)                            AS suffix
) g
WHERE r.odds > 1;
