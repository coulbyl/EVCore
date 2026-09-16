-- Vue de déduplication des sélections de canal (chantier E, tâche E-8).
--
-- POURQUOI. Une rencontre est ré-analysée cinq à sept fois à l'approche du
-- coup d'envoi, et chaque ModelRun crée sa propre ChannelDecision et sa propre
-- ChannelSelection. Comptée brute, la table donne 182 744 sélections là où il
-- n'y a que 33 197 paris réels.
--
-- L'effet n'est pas cosmétique : les erreurs types sont divisées par ~2,4, et
-- des blocs entièrement corrélés passent pour un échantillon. Concrètement, le
-- canal FIRST_HALF ressortait à +6,0 % par jambe sur « 1 559 sélections » ;
-- dédupliqué, c'est 216 paris et un intervalle de −9,9 % à +21,2 %. La cellule
-- médiane championnat x canal x marché tombe de ~40 à 7 paris.
--
-- CE QUE LA VUE GARDE. La DERNIÈRE analyse d'avant coup d'envoi, celle qui
-- aurait effectivement été jouée. Le filtre `analyzedAt < scheduledAt` écarte
-- en outre ~48 000 lignes rétro-analysées le 2026-06-30 sur des matchs déjà
-- joués : elles ont été produites après les résultats et ne prouvent rien.
--
-- Toute statistique sur channel_selection doit partir d'ici.

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
  cs."createdAt"
FROM channel_selection cs
JOIN channel_decision cd ON cd.id = cs."channelDecisionId"
JOIN model_run mr ON mr.id = cd."modelRunId"
JOIN fixture f ON f.id = mr."fixtureId"
WHERE mr."analyzedAt" < f."scheduledAt"
ORDER BY
  cd.channel, mr."fixtureId", cs.market, cs.pick,
  mr."analyzedAt" DESC, cs.id DESC;

COMMENT ON VIEW "channel_selection_deduped" IS
  'Un pari = une ligne. Dernière analyse d''avant coup d''envoi par (canal, rencontre, marché, choix). Compter channel_selection directement surestime le volume d''un facteur 5 à 7 et divise les erreurs types par ~2,4.';
