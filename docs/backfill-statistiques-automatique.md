# Backfill automatique des statistiques de matchs

Dernière mise à jour : 28 septembre 2026.

Remplace l'exécution manuelle du runbook « Backfill progressif des
statistiques » (lots lancés à la main via
`POST /etl/sync/stats/:code/backfill?seasons=`). La route manuelle existe
toujours ; ce document décrit ce qui tourne désormais seul.

Ce backfill appelle exclusivement `API-Football /fixtures/statistics`. Il ne
touche jamais The Odds API.

## 1. Ce que fait le planificateur

Un cron (`*/5 * * * *`, file BullMQ `stats-backfill`, concurrence 1) exécute
**au plus un lot par passage**. Deux lots ne se chevauchent jamais.

À chaque passage :

1. **Budget.** Lecture de `/status` (non décompté du quota). Si le compteur du
   jour dépasse `limit_day − réserve`, rien n'est lancé. Réserve par défaut :
   **2 500 appels**, laissés aux crons de production. Le quota se renouvelle à
   00:00 UTC ; le backfill reprend seul. Si `/status` est illisible, le
   passage est sauté : on ne dépense jamais à l'aveugle.
2. **Choix de la saison.** Une requête liste, pour chaque saison depuis 2023
   des compétitions actives **incluses dans le backtest** (vagues 1 à 4), le
   nombre de matchs terminés synchronisés, indisponibles et en attente.
   L'ordre suit le runbook : vague 1 (PL, LL, SA, BL1, L1), puis vague 2
   (Europe domestique et D2), vague 3 (UEFA, UNL, WC), vague 4 (le reste du
   backtest). Dans une vague : toutes les saisons courantes, puis tous les
   N-1, puis N-2, N-3.
3. **Lot.** Au plus 100 matchs, jamais plus que le budget restant. Une saison
   jamais tentée reçoit d'abord un **lot-sonde de 20**.
4. **Rolling stats.** Saison en cours : recalcul après chaque lot (elle nourrit
   les prochaines prédictions). Saison terminée : recalcul **une seule fois**,
   quand elle est entièrement traitée.

La saison est ciblée par son identifiant en base, jamais par un nom
reconstruit depuis l'année : le piège des saisons calendaires stockées en
`2025-26` (section 6 de l'ancien runbook) ne s'applique plus.

## 2. Garde-fous qui évitent de gaspiller le quota

- **Quota épuisé ou `429`.** API-Football signale un quota épuisé par un `200`
  dont `errors` est un objet et `response` est vide. Avant ce changement, ce
  corps échouait la validation Zod et le match était marqué
  `statisticsUnavailable` **définitivement**. Désormais le lot s'arrête au
  premier signal et ne marque rien (vaut aussi pour la synchro quotidienne).
- **Couverture absente.** Une saison dont moins de 20 % des matchs tentés
  (après au moins 20 tentatives) ont renvoyé des statistiques est écartée, et
  une alerte ETL est envoyée une fois. Coût maximal pour la découvrir : le
  lot-sonde de 20.
- **Match qui échoue en boucle.** Après 3 échecs hors quota (réseau, 5xx), un
  match est ignoré jusqu'au prochain redémarrage du backend : il ne bloque pas
  sa saison et ne brûle pas un appel toutes les 5 minutes.

## 3. Débit attendu

Un lot de 100 dure environ 3 min 30 (2 s entre deux appels). Avec 7 500
appels/jour, 2 500 de réserve et la consommation propre des crons, le
backfill dispose d'environ 3 000 à 4 500 appels par jour, ce qui représente
autant de matchs. Pendant une trêve internationale, les crons consomment
moins et la marge disponible augmente d'elle-même.

## 4. Commandes

Toutes sur le serveur de production.

```bash
# État : budget, saisons suivantes, saisons écartées, totaux
docker exec evcore-backend curl -fsS \
  'http://127.0.0.1:3000/etl/stats-backfill/status'

# Pause (persistée dans Redis, survit aux redémarrages) / reprise
docker exec evcore-backend curl -fsS -X POST \
  'http://127.0.0.1:3000/etl/stats-backfill/pause'
docker exec evcore-backend curl -fsS -X POST \
  'http://127.0.0.1:3000/etl/stats-backfill/resume'

# Lancer un passage tout de suite (mêmes règles de budget)
docker exec evcore-backend curl -fsS -X POST \
  'http://127.0.0.1:3000/etl/stats-backfill/run'

# Suivre les lots
docker logs --since 30m -f evcore-backend 2>&1 \
  | grep --line-buffered -E 'stats-backfill|stats-sync-worker|429'
```

Lignes de log utiles : `Stats backfill lot complete` (count, backlog,
remainingAfterJob, updated, skipped, statisticRows, abortReason),
`Stats backfill budget exhausted`, `Stats backfill season parked`.

## 5. Configuration

| Variable                       | Défaut        | Effet                                   |
| ------------------------------ | ------------- | --------------------------------------- |
| `STATS_BACKFILL_ENABLED`       | `true`        | `false` retire le cron au démarrage     |
| `STATS_BACKFILL_DAILY_RESERVE` | `2500`        | Appels toujours laissés à la production |
| `ETL_STATS_BACKFILL_CRON`      | `*/5 * * * *` | Cadence des passages                    |
| `ETL_SCHEDULING_ENABLED`       | `true`        | `false` coupe aussi ce cron             |

Les constantes (taille de lot, sonde, seuil de couverture, vagues, saison
minimale) sont dans `STATS_BACKFILL`, `apps/backend/src/config/etl.constants.ts`.

## 6. Hors périmètre

- Vague 5 (compétitions actives hors backtest) et saisons antérieures à 2023,
  dont WC 2022. Elles restent accessibles par la route manuelle.
- Saisons dont les fixtures n'ont jamais été importées : le backfill ne voit
  que les matchs déjà présents dans `fixture`. Importer d'abord via
  `POST /etl/sync/fixtures/:code/backfill?seasons=`.
- Requêtes groupées `GET /fixtures?ids=` (20 matchs par appel) : prévues comme
  étape suivante, après un canari comparant leurs statistiques à celles de
  `/fixtures/statistics`.
