-- Prospective scorecard for the frozen unified policy. Read-only.
-- Change only the bounds below; never use future rows in a partial observation window.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '90s';

WITH params AS (
  SELECT
    'unified-5-15-v1'::text AS policy_version,
    DATE '2026-09-14' AS from_date,
    CURRENT_DATE AS to_date
),
calendar AS (
  SELECT day::date AS day
  FROM params p,
       generate_series(p.from_date, p.to_date, interval '1 day') day
),
attempts AS (
  SELECT a.*
  FROM coupon_generation_attempt a
  JOIN params p ON p.policy_version = a."policyVersion"
  WHERE a."forDate" BETWEEN p.from_date AND p.to_date
),
daily_attempts AS (
  SELECT
    a."forDate",
    count(*) AS attempt_count,
    max(a."candidateCount") AS max_candidate_count,
    bool_or(a.outcome IN ('PUBLISHED', 'PRESERVED')) AS has_coupon,
    array_remove(array_agg(DISTINCT a.reason), NULL) AS abstention_reasons,
    max(a."proposalId"::text)::uuid AS proposal_id
  FROM attempts a
  GROUP BY a."forDate"
),
published AS (
  SELECT DISTINCT a."proposalId"
  FROM attempts a
  WHERE a."proposalId" IS NOT NULL
),
leg_profit AS (
  SELECT
    l."couponProposalId",
    count(*) AS leg_count,
    count(*) FILTER (WHERE l."settledAt" IS NOT NULL) AS settled_leg_count,
    avg(
      CASE
        WHEN l."isCorrect" IS TRUE THEN l."oddsSnapshot"::numeric - 1
        WHEN l."isCorrect" IS FALSE THEN -1
        WHEN l."settledAt" IS NOT NULL THEN 0
      END
    ) AS equal_weight_simple_profit
  FROM coupon_proposal_leg l
  JOIN published x ON x."proposalId" = l."couponProposalId"
  GROUP BY l."couponProposalId"
),
daily AS (
  SELECT
    c.day,
    coalesce(a.attempt_count, 0) AS attempt_count,
    coalesce(a.max_candidate_count, 0) AS max_candidate_count,
    coalesce(a.has_coupon, false) AS has_coupon,
    coalesce(a.abstention_reasons, ARRAY[]::text[]) AS abstention_reasons,
    cp.id AS proposal_id,
    cp.result,
    lp.leg_count,
    CASE
      WHEN lp.settled_leg_count <> lp.leg_count OR cp.result IS NULL THEN NULL
      WHEN cp.result = 'LOST' THEN -1
      WHEN cp.result = 'VOID' THEN 0
      WHEN cp.result = 'WON'
        THEN coalesce(cp."realizedOdds", cp."combinedOdds")::numeric - 1
      WHEN cp.result = 'PARTIAL' AND cp."realizedOdds" IS NOT NULL
        THEN cp."realizedOdds"::numeric - 1
    END AS coupon_profit,
    CASE
      WHEN lp.settled_leg_count = lp.leg_count THEN lp.equal_weight_simple_profit
    END AS equal_weight_simple_profit
  FROM calendar c
  LEFT JOIN daily_attempts a ON a."forDate" = c.day
  LEFT JOIN coupon_proposal cp ON cp.id = a.proposal_id
  LEFT JOIN leg_profit lp ON lp."couponProposalId" = cp.id
)
SELECT * FROM daily ORDER BY day, proposal_id;

WITH params AS (
  SELECT 'unified-5-15-v1'::text AS policy_version
),
published AS (
  SELECT DISTINCT a."proposalId"
  FROM coupon_generation_attempt a
  JOIN params p ON p.policy_version = a."policyVersion"
  WHERE a."proposalId" IS NOT NULL
),
leg_profit AS (
  SELECT
    l."couponProposalId",
    count(*) AS leg_count,
    count(*) FILTER (WHERE l."settledAt" IS NOT NULL) AS settled_leg_count,
    avg(CASE
      WHEN l."isCorrect" IS TRUE THEN l."oddsSnapshot"::numeric - 1
      WHEN l."isCorrect" IS FALSE THEN -1
      WHEN l."settledAt" IS NOT NULL THEN 0
    END) AS simple_profit
  FROM coupon_proposal_leg l
  JOIN published x ON x."proposalId" = l."couponProposalId"
  GROUP BY l."couponProposalId"
),
paired AS (
  SELECT
    CASE
      WHEN cp.result = 'LOST' THEN -1
      WHEN cp.result = 'VOID' THEN 0
      WHEN cp.result = 'WON'
        THEN coalesce(cp."realizedOdds", cp."combinedOdds")::numeric - 1
      WHEN cp.result = 'PARTIAL' AND cp."realizedOdds" IS NOT NULL
        THEN cp."realizedOdds"::numeric - 1
    END AS coupon_profit,
    lp.simple_profit
  FROM coupon_proposal cp
  JOIN published x ON x."proposalId" = cp.id
  JOIN leg_profit lp ON lp."couponProposalId" = cp.id
  WHERE lp.settled_leg_count = lp.leg_count AND cp.result IS NOT NULL
),
summary AS (
  SELECT
    count(*) AS observed_days,
    avg(coupon_profit) AS coupon_roi,
    avg(simple_profit) AS same_legs_equal_weight_roi,
    avg(coupon_profit - simple_profit) AS paired_delta,
    stddev_samp(coupon_profit - simple_profit) AS paired_sd
  FROM paired
)
SELECT
  observed_days,
  coupon_roi,
  same_legs_equal_weight_roi,
  paired_delta,
  paired_delta - 1.96 * paired_sd / sqrt(observed_days) AS paired_delta_ci95_low,
  paired_delta + 1.96 * paired_sd / sqrt(observed_days) AS paired_delta_ci95_high
FROM summary;

ROLLBACK;
