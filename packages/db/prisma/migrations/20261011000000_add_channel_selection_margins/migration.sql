-- Marge payée par sélection (plan de rentabilité, chantier E, E-5/E-6).
--
-- Le moteur connaît, à l'instant où il fixe le prix d'une sélection, le
-- groupe d'issues complet du book retenu et celui de chaque autre book du
-- relevé : la marge payée et la meilleure marge disponible se calculent là,
-- sans attendre la clôture. Colonnes nullables (groupe incomplet, marché sans
-- partition), aucune ligne réécrite ; la vue dédupliquée les expose.

ALTER TABLE "channel_selection"
  ADD COLUMN "marginPaid" DECIMAL(5,4),
  ADD COLUMN "marginBest" DECIMAL(5,4);

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
  cs."closingLineValue",
  cs."marginPaid",
  cs."marginBest"
FROM channel_selection cs
JOIN channel_decision cd ON cd.id = cs."channelDecisionId"
JOIN model_run mr ON mr.id = cd."modelRunId"
JOIN fixture f ON f.id = mr."fixtureId"
WHERE mr."analyzedAt" < f."scheduledAt"
ORDER BY
  cd.channel, mr."fixtureId", cs.market, cs.pick,
  mr."analyzedAt" DESC, cs.id DESC;
