BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
COPY (
 SELECT id,segment,algorithm,"createdAt","activatedAt","isActive","rollbackOfId",features,metrics
 FROM ml_model_version ORDER BY segment,"createdAt",id
) TO STDOUT WITH CSV HEADER;
ROLLBACK;
