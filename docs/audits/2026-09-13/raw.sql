BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '90s';
COPY (
 WITH latest AS (
  SELECT DISTINCT ON (f.id) f.id,f."scheduledAt",f."homeScore",f."awayScore",f.status,
   mr."analyzedAt",mr.features,mr.id run_id,c.code
  FROM fixture f JOIN model_run mr ON mr."fixtureId"=f.id
  JOIN season s ON s.id=f."seasonId" JOIN competition c ON c.id=s."competitionId"
  WHERE mr."analyzedAt"<f."scheduledAt" AND mr."createdAt"<f."scheduledAt"
  ORDER BY f.id,mr."analyzedAt" DESC,mr.id DESC
 )
 SELECT l.id,l."scheduledAt",l."homeScore",l."awayScore",l.status,l."analyzedAt",l.run_id,l.code,
 l.features->>'predictionSource' source,l.features->'probabilities' probabilities,
 os."homeOdds",os."drawOdds",os."awayOdds",os."snapshotAt",os.bookmaker
 FROM latest l LEFT JOIN LATERAL (
  SELECT o."homeOdds",o."drawOdds",o."awayOdds",o."snapshotAt",o.bookmaker
  FROM odds_snapshot o WHERE o."fixtureId"=l.id AND o.market='ONE_X_TWO'
   AND o."snapshotAt"<=l."analyzedAt" AND o."createdAt"<=l."analyzedAt"
   AND o."homeOdds">1 AND o."drawOdds">1 AND o."awayOdds">1
  ORDER BY o."snapshotAt" DESC,(o.bookmaker='Pinnacle') DESC,o.bookmaker LIMIT 1
 ) os ON true ORDER BY l."scheduledAt",l.id
) TO STDOUT WITH CSV HEADER;
ROLLBACK;
