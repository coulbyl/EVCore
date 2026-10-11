-- Comparaison PAR JAMBE des politiques de coupon (CLAUDE.md : jamais par
-- ROI de coupon). Trois sources sur les mêmes jours et le même vivier :
--   * LLM publié  : coupon_proposal (source LLM) → jambes → sélection de canal
--     via featureSnapshot.channelSelectionId ;
--   * ombres      : coupon_generation_attempt.metadata.legs des politiques
--     deterministic-5-7-v1 et unified-5-15-v2-shadow, jambes liées à leur
--     sélection de canal (channelSelectionId) ; une seule tentative par
--     (jour, passe, politique) — la relance de 21:15 réécrit les mêmes ombres.
--   * LLM non publié : depuis le 2026-10-11 les tentatives PRESERVED/ERROR
--     portent aussi leurs jambes dans metadata.legs.
-- La sélection de canal donne le résultat, la clôture et le CLV (chantier E) ;
-- `oddsSnapshot` de la jambe est le prix misé (meilleur prix multi-book).
WITH shadow_attempts AS (
  SELECT a.*, row_number() OVER (PARTITION BY a."forDate", a.pass, a."policyVersion" ORDER BY a."generatedAt", a.id) AS n
  FROM coupon_generation_attempt a
  WHERE a.metadata ? 'legs'
),
shadow_legs AS (
  SELECT a."policyVersion" AS policy, a."forDate",
         (leg.value->>'channelSelectionId')::uuid AS selection_id,
         (leg.value->>'oddsSnapshot')::numeric AS taken_odds,
         (leg.value->>'probability')::numeric AS announced,
         NULL::boolean AS own_won
  FROM shadow_attempts a
  CROSS JOIN LATERAL jsonb_array_elements(a.metadata->'legs') AS leg(value)
  WHERE a.n = 1 AND a.outcome <> 'PUBLISHED'
),
published_legs AS (
  SELECT 'published:' || coalesce(p.reasoning->>'policyVersion', 'legacy') AS policy, p."forDate",
         (l."featureSnapshot"->>'channelSelectionId')::uuid AS selection_id,
         l."oddsSnapshot" AS taken_odds, l.probability AS announced,
         -- Les jambes d'avant le 2026-09 n'ont pas de sélection liée : leur
         -- propre règlement fait foi.
         l."isCorrect" AS own_won
  FROM coupon_proposal p JOIN coupon_proposal_leg l ON l."couponProposalId" = p.id
  WHERE p.source = 'LLM'
),
legs AS (
  SELECT * FROM shadow_legs UNION ALL SELECT * FROM published_legs
),
graded AS (
  SELECT g.*, s.odds AS selection_odds, s."closingOdds", s."closingLineValue",
         CASE WHEN s.result = 'WON' THEN true WHEN s.result = 'LOST' THEN false ELSE g.own_won END AS won
  FROM legs g LEFT JOIN channel_selection s ON s.id = g.selection_id
)
SELECT
  g.policy,
  count(*)::int                                            AS legs,
  count(*) FILTER (WHERE g.won IS NOT NULL)::int                AS settled,
  avg(CASE WHEN g.won THEN 1.0 ELSE 0.0 END)
    FILTER (WHERE g.won IS NOT NULL)::float                AS "hitRate",
  avg(g.announced) FILTER (WHERE g.won IS NOT NULL)::float AS announced,
  avg(g.taken_odds)::float                                 AS "meanOdds",
  avg(1 / g.taken_odds)::float                             AS "meanImplied",
  -- ROI par jambe (mise 1), erreur type incluse : SE ~ 1,2 / sqrt(n).
  avg(CASE WHEN g.won THEN g.taken_odds - 1 ELSE -1 END)
    FILTER (WHERE g.won IS NOT NULL)::float                AS "roiPerLeg",
  (stddev_samp(CASE WHEN g.won THEN g.taken_odds - 1 ELSE -1 END)
     FILTER (WHERE g.won IS NOT NULL)
   / sqrt(nullif(count(*) FILTER (WHERE g.won IS NOT NULL), 0)))::float AS "roiSe",
  count(g."closingLineValue")::int                         AS "withClosing",
  -- CLV du prix misé face à la clôture de la sélection (groupe complet, book
  -- de la sélection) : cote misée × probabilité de clôture sans marge − 1.
  avg(g.taken_odds * (g."closingLineValue" + 1) / g.selection_odds - 1)
    FILTER (WHERE g."closingLineValue" IS NOT NULL)::float AS "clvTaken",
  avg(g."closingOdds" * (g."closingLineValue" + 1) / g.selection_odds - 1)
    FILTER (WHERE g."closingLineValue" IS NOT NULL)::float AS "clvAtClose",
  min(g."forDate")::date                                   AS "firstDay",
  max(g."forDate")::date                                   AS "lastDay"
FROM graded g
GROUP BY g.policy
ORDER BY g.policy;
