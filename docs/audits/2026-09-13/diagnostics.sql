\pset pager off
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='90s';
-- Same row universe as the calibration loader, historical cutoff 2026-08-01.
SELECT count(*) eligible_by_fixture_date,
 count(*) FILTER (WHERE cs."createdAt">='2026-08-01') selection_not_yet_recorded,
 count(*) FILTER (WHERE cs."settledAt">='2026-08-01') result_not_yet_recorded
FROM channel_selection cs JOIN channel_decision cd ON cd.id=cs."channelDecisionId"
JOIN model_run mr ON mr.id=cd."modelRunId" JOIN fixture f ON f.id=mr."fixtureId"
WHERE cs.result IN ('WON','LOST') AND cs.rank=1 AND cs.odds IS NOT NULL
AND cd.status='SELECTED' AND f."scheduledAt"<'2026-08-01';
SELECT cd.channel,cs.market,cs.pick,cs.result,f.status,f.id,cs.id selection_id,mr."analyzedAt",f."scheduledAt"
FROM channel_selection cs JOIN channel_decision cd ON cd.id=cs."channelDecisionId"
JOIN model_run mr ON mr.id=cd."modelRunId" JOIN fixture f ON f.id=mr."fixtureId"
WHERE f.status='CANCELLED' AND cs.result IN ('WON','LOST');
SELECT b.id,b.market,b.pick,b.status bet_status,cs.result selection_result,mr."fixtureId"
FROM bet b JOIN channel_selection cs ON cs.id=b."channelSelectionId"
JOIN model_run mr ON mr.id=b."modelRunId"
WHERE b.status IN ('WON','LOST','VOID') AND cs.result IN ('WON','LOST','VOID') AND b.status<>cs.result;
-- Non-personal sample: the five latest VANTAGE textual decisions and numeric evidence.
SELECT cd.id,cd."configVersion",cd."createdAt",f."scheduledAt",cs.market,cs.pick,cs.probability,cs.odds,cs.result,
 cd."reasonDetails"->>'text' explanation
FROM channel_decision cd JOIN model_run mr ON mr.id=cd."modelRunId" JOIN fixture f ON f.id=mr."fixtureId"
JOIN channel_selection cs ON cs."channelDecisionId"=cd.id
WHERE cd.channel='VANTAGE' AND cd.status='SELECTED'
ORDER BY cd."createdAt" DESC LIMIT 5;
SELECT count(*) AS history_rows,min("createdAt"),max("createdAt") FROM vantage_decision_history;
SELECT count(*) AS odds_snapshot_after_kickoff FROM odds_snapshot o JOIN fixture f ON f.id=o."fixtureId"
WHERE o."snapshotAt">f."scheduledAt";
ROLLBACK;
