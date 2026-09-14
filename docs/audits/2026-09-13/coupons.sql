BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '90s';
COPY (
 SELECT cp.id,cp."forDate",cp."generatedAt",cp."combinedOdds",cp."realizedOdds",
 cp."jointProbability",cp.status,cp.result,cp.rank,
 count(*) legs,min(f."scheduledAt") first_kickoff,max(f."scheduledAt") last_kickoff,
 count(*) FILTER (WHERE l."oddsSnapshot" IS NULL) missing_odds,
 count(*)-count(DISTINCT l."fixtureId") duplicate_fixture_legs,
 cp.reasoning->>'source' source,
 json_agg(json_build_object('fixture_id',l."fixtureId",'canal',l.canal,'market',l.market,'pick',l.pick,
 'probability',l.probability,'odds',l."oddsSnapshot",'correct',l."isCorrect",'settled_at',l."settledAt",
 'feature_keys',(SELECT json_agg(k) FROM jsonb_object_keys(l."featureSnapshot"::jsonb) k))) leg_data
 FROM coupon_proposal cp JOIN coupon_proposal_leg l ON l."couponProposalId"=cp.id
 JOIN fixture f ON f.id=l."fixtureId"
 GROUP BY cp.id ORDER BY cp."generatedAt",cp.id
) TO STDOUT WITH CSV HEADER;
ROLLBACK;
