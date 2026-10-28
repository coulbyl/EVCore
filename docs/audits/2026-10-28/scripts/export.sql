-- Export des sélections envisagées par le moteur, réglées sur le score, avec
-- deux marqueurs : présentes dans le vivier actuel du coupon (sélections
-- SELECTED des canaux non méta), match « Données suspectes » (même définition
-- que coupon.repository.ts). À lancer après
-- packages/backtest-core/scripts/market-cells/settled-picks.sql dans la même
-- session psql. Lecture seule hors du schéma d'étude.
CREATE SCHEMA study_1028;
CREATE TABLE study_1028.picks AS SELECT * FROM settled_picks;
CREATE TABLE study_1028.alerted AS
SELECT lr."fixtureId" FROM (
  SELECT DISTINCT ON (mr."fixtureId") mr."fixtureId", mr.features
  FROM model_run mr JOIN fixture fx ON fx.id = mr."fixtureId"
  WHERE mr."analyzedAt" < fx."scheduledAt"
  ORDER BY mr."fixtureId", mr."analyzedAt" DESC) lr
WHERE jsonb_typeof(lr.features -> 'calibration_alert') = 'object'
   OR CASE WHEN jsonb_typeof(lr.features -> 'calibration_alert_over_under') = 'array'
           THEN jsonb_array_length(lr.features -> 'calibration_alert_over_under') > 0 ELSE false END;
CREATE TABLE study_1028.pool AS
SELECT DISTINCT mr."fixtureId", cs.market::text AS market, cs.pick
FROM channel_selection cs
JOIN channel_decision cd ON cd.id = cs."channelDecisionId"
JOIN model_run mr ON mr.id = cd."modelRunId"
JOIN fixture f ON f.id = mr."fixtureId"
WHERE mr."analyzedAt" < f."scheduledAt" AND cd.status = 'SELECTED'
  AND cd.channel::text NOT IN ('CONSENSUS','CONTRARIAN','AVOID','VALUE','SAFE','VANTAGE');
\copy (SELECT p."fixtureId", p.day, p.competition, p.market, p.pick, p.line, p.odds, p.model_prob, p.status, p.rejection_reason, p.won, (pl."fixtureId" IS NOT NULL) AS in_pool, (a."fixtureId" IS NOT NULL) AS alerted FROM study_1028.picks p LEFT JOIN study_1028.pool pl ON pl."fixtureId"=p."fixtureId" AND pl.market=p.market AND pl.pick=p.pick LEFT JOIN study_1028.alerted a ON a."fixtureId"=p."fixtureId") TO 'picks.csv' CSV HEADER
DROP SCHEMA study_1028 CASCADE;
