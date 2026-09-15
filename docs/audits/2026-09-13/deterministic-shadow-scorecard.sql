-- Prospective scorecard for deterministic-5-7-v1 shadow attempts.
-- The worker records these attempts but never publishes them as coupons.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '90s';

WITH attempts AS (
  SELECT
    a.*,
    row_number() OVER (
      PARTITION BY a."forDate", a.pass
      ORDER BY a."generatedAt", a.id
    ) AS pass_attempt_number
  FROM coupon_generation_attempt a
  WHERE a."policyVersion" = 'deterministic-5-7-v1'
),
legs AS (
  SELECT
    a.id AS attempt_id,
    leg.ordinality AS leg_number,
    leg.value AS leg,
    s.result,
    s."settledAt"
  FROM attempts a
  CROSS JOIN LATERAL jsonb_array_elements(
    coalesce(a.metadata->'legs', '[]'::jsonb)
  ) WITH ORDINALITY AS leg(value, ordinality)
  LEFT JOIN channel_selection s
    ON s.id = (leg.value->>'channelSelectionId')::uuid
),
settlement AS (
  SELECT
    attempt_id,
    count(*) AS leg_count,
    count(*) FILTER (
      WHERE "settledAt" IS NOT NULL AND result IN ('WON', 'LOST', 'VOID')
    ) AS settled_leg_count,
    CASE
      WHEN bool_or(result = 'LOST') THEN -1::numeric
      WHEN bool_and(result = 'VOID') THEN 0::numeric
      WHEN bool_and("settledAt" IS NOT NULL AND result IN ('WON', 'VOID'))
        THEN exp(sum(ln((leg->>'oddsSnapshot')::numeric)) FILTER (WHERE result = 'WON')) - 1
    END AS profit
  FROM legs
  GROUP BY attempt_id
),
scorecard AS (
  SELECT
    a."forDate",
    a.pass,
    a.pass_attempt_number,
    a.outcome,
    a."candidateCount",
    a.reason,
    a.metadata->>'combinedOdds' AS combined_odds,
    a.metadata->>'jointProbability' AS joint_probability,
    coalesce(s.leg_count, 0) AS leg_count,
    coalesce(s.settled_leg_count, 0) AS settled_leg_count,
    s.profit,
    a."generatedAt"
  FROM attempts a
  LEFT JOIN settlement s ON s.attempt_id = a.id
)
SELECT *
FROM scorecard
ORDER BY "forDate", pass, pass_attempt_number;

WITH attempts AS (
  SELECT a.*
  FROM coupon_generation_attempt a
  WHERE a."policyVersion" = 'deterministic-5-7-v1'
    AND a.outcome = 'SHADOW_COMPOSED'
),
legs AS (
  SELECT
    a.id AS attempt_id,
    leg.value AS leg,
    s.result,
    s."settledAt"
  FROM attempts a
  CROSS JOIN LATERAL jsonb_array_elements(a.metadata->'legs') AS leg(value)
  LEFT JOIN channel_selection s
    ON s.id = (leg.value->>'channelSelectionId')::uuid
),
profits AS (
  SELECT
    attempt_id,
    CASE
      WHEN bool_or(result = 'LOST') THEN -1::numeric
      WHEN bool_and(result = 'VOID') THEN 0::numeric
      WHEN bool_and("settledAt" IS NOT NULL AND result IN ('WON', 'VOID'))
        THEN exp(sum(ln((leg->>'oddsSnapshot')::numeric)) FILTER (WHERE result = 'WON')) - 1
    END AS profit
  FROM legs
  GROUP BY attempt_id
)
SELECT
  count(*) AS composed_attempts,
  count(profit) AS settled_attempts,
  count(*) FILTER (WHERE profit > 0) AS won,
  count(*) FILTER (WHERE profit < 0) AS lost,
  avg(profit) AS roi
FROM profits;

ROLLBACK;
