BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '90s';
COPY (
 WITH latest AS (
  SELECT DISTINCT ON (f.id,cd.channel)
   f.id fixture_id,f."scheduledAt" kickoff,c.code league,
   mr.id run_id,mr."analyzedAt" analyzed_at,mr.features,
   cd.id decision_id,cd.channel,cd.status,cd."configVersion" config_version
  FROM model_run mr JOIN fixture f ON f.id=mr."fixtureId"
  JOIN season s ON s.id=f."seasonId" JOIN competition c ON c.id=s."competitionId"
  JOIN channel_decision cd ON cd."modelRunId"=mr.id
  WHERE mr."analyzedAt"<f."scheduledAt" AND mr."createdAt"<f."scheduledAt"
    AND cd."createdAt"<f."scheduledAt"
  ORDER BY f.id,cd.channel,mr."analyzedAt" DESC,cd."createdAt" DESC,cd.id DESC
 )
 SELECT l.fixture_id,l.kickoff,l.league,l.run_id,l.analyzed_at,l.channel,l.status,
 COALESCE(l.features->>'predictionSource','UNKNOWN') source,
 COALESCE(l.config_version,'UNVERSIONED') config_version,
 l.features->>'h2h_correction_applied' h2h_applied,
 l.features->>'congestion_correction_applied' congestion_applied,
 cs.id selection_id,cs.market,cs.pick,cs.probability,cs.odds,cs.ev,cs.result,cs."settledAt",
 cs."createdAt" selection_created_at,
 l.features->>'calibration_alert' calibration_alert,
 l.features->>'calibration_alert_over_under' calibration_alert_over_under
 FROM latest l LEFT JOIN channel_selection cs ON cs."channelDecisionId"=l.decision_id AND cs.rank=1
 ORDER BY l.kickoff,l.fixture_id,l.channel
) TO STDOUT WITH CSV HEADER;
ROLLBACK;
