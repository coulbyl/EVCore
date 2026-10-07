-- Provenance du prix et ligne de clôture par sélection de canal (chantier E).
--
-- Une sélection gardait sa cote sans dire d'où elle venait : le chargeur
-- résout un book par marché (Pinnacle d'abord), puis jetait ce nom. Sans lui,
-- le CLV d'une sélection comparerait sa cote à la clôture d'un autre book, et
-- mesurerait l'écart de marge entre maisons plutôt que la valeur prise. Le
-- moteur écrit désormais `oddsBookmaker` et `oddsSnapshotAt` avec la
-- sélection, et le règlement final écrit la clôture et le CLV, comme sur
-- coupon_proposal_leg (migration 20261007120000).
--
-- Colonnes nullables, aucune ligne réécrite. La vue dédupliquée est
-- recréée pour les exposer (ajout de colonnes en fin de liste, ce que
-- CREATE OR REPLACE VIEW accepte).

ALTER TABLE "channel_selection"
  ADD COLUMN "oddsBookmaker" TEXT,
  ADD COLUMN "oddsSnapshotAt" TIMESTAMP(3),
  ADD COLUMN "closingOdds" DECIMAL(6,3),
  ADD COLUMN "closingBookmaker" TEXT,
  ADD COLUMN "closingObservedAt" TIMESTAMP(3),
  ADD COLUMN "closingLineValue" DECIMAL(6,4);

CREATE OR REPLACE VIEW "channel_selection_deduped" AS
SELECT DISTINCT ON (cd.channel, mr."fixtureId", cs.market, cs.pick)
  cs.id,
  cs."channelDecisionId",
  cd.channel,
  mr."fixtureId",
  mr."analyzedAt",
  f."scheduledAt",
  f."seasonId",
  cs.market,
  cs.pick,
  cs.probability,
  cs.odds,
  cs."impliedProbability",
  cs.ev,
  cs."qualityScore",
  cs.rank,
  cs.result,
  cs."settledAt",
  cs."createdAt",
  cs."oddsBookmaker",
  cs."oddsSnapshotAt",
  cs."closingOdds",
  cs."closingBookmaker",
  cs."closingObservedAt",
  cs."closingLineValue"
FROM channel_selection cs
JOIN channel_decision cd ON cd.id = cs."channelDecisionId"
JOIN model_run mr ON mr.id = cd."modelRunId"
JOIN fixture f ON f.id = mr."fixtureId"
WHERE mr."analyzedAt" < f."scheduledAt"
ORDER BY
  cd.channel, mr."fixtureId", cs.market, cs.pick,
  mr."analyzedAt" DESC, cs.id DESC;
