\pset pager off
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '90s';
SELECT current_database() AS database, current_timestamp AS observed_at;
SELECT mr.phase, count(*) AS runs,
 count(*) FILTER (WHERE mr."analyzedAt" >= f."scheduledAt") AS analyzed_after_kickoff,
 count(*) FILTER (WHERE mr."createdAt" >= f."scheduledAt") AS recorded_after_kickoff,
 min(f."scheduledAt") AS first_fixture, max(f."scheduledAt") AS last_fixture
FROM model_run mr JOIN fixture f ON f.id=mr."fixtureId" GROUP BY mr.phase;
SELECT COALESCE(features->>'predictionSource','UNKNOWN') AS source,
 count(*) AS runs, min("analyzedAt"), max("analyzedAt") FROM model_run GROUP BY 1 ORDER BY 2 DESC;
SELECT key,count(*) FROM model_run, LATERAL jsonb_object_keys(features::jsonb) key
GROUP BY key ORDER BY count(*) DESC;
SELECT channel,"configVersion",count(*) AS decisions,min("createdAt"),max("createdAt")
FROM channel_decision GROUP BY 1,2 ORDER BY 1,2;
SELECT algorithm,segment,"isActive",count(*),min("createdAt"),max("createdAt")
FROM ml_model_version GROUP BY 1,2,3 ORDER BY 2,1,3;
SELECT source,count(*),min("snapshotAt"),max("snapshotAt"),
 count(*) FILTER (WHERE "createdAt">"snapshotAt"+interval '1 day') AS recorded_over_one_day_late
FROM odds_snapshot GROUP BY source;
SELECT count(*) AS coupons,
 count(*) FILTER (WHERE cp."generatedAt">=x.first_kickoff) AS generated_after_first_kickoff,
 count(*) FILTER (WHERE cp."generatedAt">=x.last_kickoff) AS generated_after_last_kickoff
FROM coupon_proposal cp JOIN LATERAL (
 SELECT min(f."scheduledAt") first_kickoff,max(f."scheduledAt") last_kickoff
 FROM coupon_proposal_leg l JOIN fixture f ON f.id=l."fixtureId" WHERE l."couponProposalId"=cp.id
) x ON true;
SELECT result,count(*) FROM channel_selection GROUP BY result;
SELECT count(*) AS duplicate_fixture_groups FROM (
 SELECT "homeTeamId","awayTeamId","scheduledAt",count(*) FROM fixture
 GROUP BY 1,2,3 HAVING count(*)>1
) d;
SELECT count(*) AS duplicate_model_bet_groups FROM (
 SELECT "fixtureId","pickKey",count(*) FROM bet WHERE "userId" IS NULL
 GROUP BY 1,2 HAVING count(*)>1
) d;
ROLLBACK;
