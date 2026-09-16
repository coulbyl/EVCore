\pset pager off
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='90s';
SELECT count(*) selections,count(*) FILTER (WHERE mr."analyzedAt">=f."scheduledAt") post_kickoff,
 count(*) FILTER (WHERE cs."createdAt">=f."scheduledAt") selection_post_kickoff,
 count(*) FILTER (WHERE cs.odds IS NULL) no_odds,
 count(*) FILTER (WHERE cs.probability<0 OR cs.probability>1) invalid_probability,
 count(*) FILTER (WHERE cs.odds<=1) invalid_odds
FROM channel_selection cs JOIN channel_decision cd ON cd.id=cs."channelDecisionId"
JOIN model_run mr ON mr.id=cd."modelRunId" JOIN fixture f ON f.id=mr."fixtureId";
SELECT count(*) AS repeated_fixture_channel_pick_groups FROM (
 SELECT mr."fixtureId",cd.channel,cs.market,cs.pick,count(*)
 FROM channel_selection cs JOIN channel_decision cd ON cd.id=cs."channelDecisionId"
 JOIN model_run mr ON mr.id=cd."modelRunId" GROUP BY 1,2,3,4 HAVING count(*)>1
) d;
SELECT count(*) stats,count(*) FILTER (WHERE ts."createdAt">f."scheduledAt"+interval '1 day') recorded_after_match_plus_day
FROM team_stats ts JOIN fixture f ON f.id=ts."afterFixtureId";
SELECT f.status,cs.result,count(*) FROM channel_selection cs
JOIN channel_decision cd ON cd.id=cs."channelDecisionId" JOIN model_run mr ON mr.id=cd."modelRunId"
JOIN fixture f ON f.id=mr."fixtureId" WHERE f.status IN ('CANCELLED','POSTPONED') GROUP BY 1,2;
SELECT count(*) AS finished_unsettled_over_one_day FROM channel_selection cs
JOIN channel_decision cd ON cd.id=cs."channelDecisionId" JOIN model_run mr ON mr.id=cd."modelRunId"
JOIN fixture f ON f.id=mr."fixtureId" WHERE f.status='FINISHED' AND f."scheduledAt"<now()-interval '1 day'
AND (cs.result IS NULL OR cs.result='PENDING');
SELECT count(*) AS selection_bet_result_disagreements FROM bet b JOIN channel_selection cs ON cs.id=b."channelSelectionId"
WHERE b.status IN ('WON','LOST','VOID') AND cs.result IN ('WON','LOST','VOID') AND b.status<>cs.result;
SELECT count(*) AS missing_config FROM channel_decision WHERE "configVersion" IS NULL;
SELECT min("finished_at"),max("finished_at"),count(*) FROM _prisma_migrations WHERE rolled_back_at IS NULL;
SELECT segment,algorithm,id,"createdAt","activatedAt",metrics FROM ml_model_version WHERE "isActive" ORDER BY segment;
ROLLBACK;
