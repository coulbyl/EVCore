# Backfill automatique des statistiques de matchs

Dernière mise à jour : 5 octobre 2026.

Remplace l'exécution manuelle de l'ancien runbook « Backfill progressif des
statistiques » (lots lancés à la main via
`POST /etl/sync/stats/:code/backfill?seasons=`). Les sections 1 à 5 décrivent
ce qui tourne désormais seul. La section 6 reprend ce que ce runbook couvrait
et que le planificateur ne couvre pas : la route manuelle y reste le seul
moyen.

Ce backfill appelle exclusivement `API-Football /fixtures/statistics`. Il ne
touche jamais The Odds API.

## 1. Ce que fait le planificateur

Un cron (`*/5 * * * *`, file BullMQ `stats-backfill`, concurrence 1) exécute
**au plus un lot par passage**. Deux lots ne se chevauchent jamais.

À chaque passage :

0. **Synchro de routine.** Si une synchro stats de routine (file
   `league-sync`, 04:00 UTC par défaut) tourne, attend, ou est due dans les
   10 minutes, le passage est sauté : les deux travaillent sur les mêmes
   matchs de la saison courante (appels en double, écritures concurrentes).
1. **Budget.** Lecture de `/status` (non décompté du quota). Si le compteur du
   jour dépasse `limit_day − réserve`, rien n'est lancé. Réserve par défaut :
   **2 500 appels**, laissés aux crons de production. Le quota se renouvelle à
   00:00 UTC ; le backfill reprend seul. Si `/status` est illisible, le
   passage est sauté : on ne dépense jamais à l'aveugle.
2. **Choix de la saison.** Une requête liste, pour chaque saison depuis 2023
   des compétitions actives **incluses dans le backtest** (vagues 1 à 4), le
   nombre de matchs terminés synchronisés, indisponibles et en attente.
   **Toutes les saisons en cours d'abord**, quelle que soit la vague : elles
   nourrissent les prochaines prédictions, alors qu'une saison terminée ne
   sert qu'à la calibration et aux backtests. Puis les saisons terminées dans
   l'ordre du runbook : vague 1 (PL, LL, SA, BL1, L1), vague 2 (Europe
   domestique et D2), vague 3 (UEFA, UNL, WC), vague 4 (le reste du backtest),
   et dans une vague tous les N-1, puis N-2, N-3. (Avant le 5 octobre, une
   N-2 de Premier League passait avant la saison courante de MLS : 165 des
   356 derniers matchs joués attendaient encore leurs statistiques, p90 8
   jours.)
3. **Lot.** Au plus 100 matchs, jamais plus que le budget restant. Une saison
   jamais tentée reçoit d'abord un **lot-sonde** : 20 tentatives au total,
   une sonde interrompue reprenant avec ce qu'il en reste.
4. **Rolling stats.** Saison en cours : recalcul après chaque lot (elle nourrit
   les prochaines prédictions). Saison terminée : recalcul **une seule fois**,
   quand elle est entièrement traitée.

La saison est ciblée par son identifiant en base, jamais par un nom
reconstruit depuis l'année : le piège des saisons calendaires stockées en
`2025-26` (section 6.4) ne s'applique pas au planificateur.

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

**Depuis le dashboard** (compte admin) : `Moteur & ETL` → onglet
`Monitoring` → section « Backfill statistiques ». Elle affiche l'état, le
quota du jour, le budget restant, la progression, les prochaines saisons et
les saisons écartées, avec les boutons Pause / Reprendre / Lancer un passage.
Rafraîchie toutes les 30 secondes.

**En ligne de commande**, sur le serveur de production. Les routes `/etl/stats-backfill/*` sont
réservées aux administrateurs (`AuthSessionGuard` + `AdminGuard`) : passer le
cookie de session `evcore_session` d'un compte admin, copié depuis le
navigateur. Le backfill lui-même n'a besoin d'aucun appel pour tourner ; pour
le couper sans session, `STATS_BACKFILL_ENABLED=false` puis redémarrage.

```bash
EVCORE_SESSION='<cookie evcore_session d’un compte admin>'

# État : budget, saisons suivantes, saisons écartées, totaux
docker exec evcore-backend curl -fsS -b "evcore_session=${EVCORE_SESSION}" \
  'http://127.0.0.1:3000/etl/stats-backfill/status'

# Pause (persistée dans Redis, survit aux redémarrages) / reprise
docker exec evcore-backend curl -fsS -X POST -b "evcore_session=${EVCORE_SESSION}" \
  'http://127.0.0.1:3000/etl/stats-backfill/pause'
docker exec evcore-backend curl -fsS -X POST -b "evcore_session=${EVCORE_SESSION}" \
  'http://127.0.0.1:3000/etl/stats-backfill/resume'

# Lancer un passage tout de suite (mêmes règles de budget)
docker exec evcore-backend curl -fsS -X POST -b "evcore_session=${EVCORE_SESSION}" \
  'http://127.0.0.1:3000/etl/stats-backfill/run'

# Suivre les lots
docker logs --since 30m -f evcore-backend 2>&1 \
  | grep --line-buffered -E 'stats-backfill|stats-sync-worker|429'
```

Lignes de log utiles : `Stats backfill lot complete` (count, backlog,
remainingAfterJob, updated, skipped, statisticRows, abortReason),
`Stats backfill budget exhausted`, `Stats backfill season parked`,
`Routine stats sync running or due`.

## 5. Configuration

| Variable                       | Défaut        | Effet                                   |
| ------------------------------ | ------------- | --------------------------------------- |
| `STATS_BACKFILL_ENABLED`       | `true`        | `false` retire le cron au démarrage     |
| `STATS_BACKFILL_DAILY_RESERVE` | `2500`        | Appels toujours laissés à la production |
| `ETL_STATS_BACKFILL_CRON`      | `*/5 * * * *` | Cadence des passages                    |
| `ETL_SCHEDULING_ENABLED`       | `true`        | `false` coupe aussi ce cron             |

Les constantes (taille de lot, sonde, seuil de couverture, vagues, saison
minimale) sont dans `STATS_BACKFILL`, `apps/backend/src/config/etl.constants.ts`.

## 6. Route manuelle : ce que le planificateur ne couvre pas

Le planificateur ne traite que les compétitions **incluses dans le backtest**
(vagues 1 à 4) et les saisons **depuis 2023**. Tout le reste passe par la
route manuelle, qui existe toujours et consomme le même quota API-Football.

Hors périmètre du planificateur :

- la vague 5, c'est-à-dire les compétitions actives mais hors backtest
  (section 6.3) ;
- les saisons antérieures à 2023, dont WC 2022 ;
- les saisons dont les fixtures n'ont jamais été importées (section 6.5) ;
- les requêtes groupées `GET /fixtures?ids=` (20 matchs par appel), prévues
  comme étape suivante après un canari comparant leurs statistiques à celles
  de `/fixtures/statistics`.

### 6.1 Règles d'exploitation

1. **Mettre le planificateur en pause** avant un lot manuel
   (`/etl/stats-backfill/pause`, section 4) : les deux tournent sur la même
   file de synchronisation et se disputeraient le budget.
2. Ne lancer qu'un lot à la fois. Attendre `Stats sync complete`, puis
   `Rolling-stats backfill complete`, avant de relancer.
3. Un lot traite au maximum 100 matchs. Répéter une saison jusqu'à ce que
   `remainingAfterJob` soit égal à zéro.
4. Si `skipped` est supérieur à zéro, relancer même si `remainingAfterJob`
   affichait zéro : cette valeur est calculée avant le traitement et ne
   réintègre pas les appels qui ont échoué.
5. Arrêter la session au premier `429` ou quota épuisé (section 2), puis
   attendre le renouvellement à 00:00 UTC. Ne pas marteler l'endpoint.
6. Ne jamais lancer `/etl/sync/odds-historical/...` dans ce cadre : cette
   route dépend de The Odds API.
7. Garder 500 à 1 000 matchs par journée de backfill manuel comme cadence
   prudente, en plus de la réserve laissée aux crons.

### 6.2 Commandes

Toutes les commandes s'exécutent sur le serveur de production.

Terminal A, surveiller les logs :

```bash
docker logs --since 5m -f evcore-backend 2>&1 \
  | grep --line-buffered -E 'stats-sync-worker|rolling-stats-service|429|remainingAfterJob'
```

Terminal B, lancer un lot (modifier uniquement le code et l'année) :

```bash
BACKFILL_CODE=PL
BACKFILL_SEASON=2025

docker exec evcore-backend curl -fsS -X POST \
  "http://127.0.0.1:3000/etl/sync/stats/${BACKFILL_CODE}/backfill?seasons=${BACKFILL_SEASON}"
```

La réponse HTTP confirme seulement la mise en file :

```json
{ "status": "ok", "competitionCode": "PL", "seasons": [2025] }
```

Elle ne signifie pas que le lot est terminé. Les logs du terminal A sont la
source de vérité. Avant un nouveau lot, vérifier que la file n'a plus de job
`active` ou `waiting` correspondant au lot précédent :

```bash
docker exec evcore-backend curl -fsS \
  'http://127.0.0.1:3000/etl/status'
```

Lecture d'un lot sain :

```text
count: 100
backlog: 380
remainingAfterJob: 280
updated: 100
skipped: 0
statisticRows: 3398
```

380 matchs étaient sans statistiques au démarrage, 100 ont été sélectionnés
et enregistrés, 280 restent à traiter. Une saison est terminée seulement quand
le dernier lot affiche `remainingAfterJob: 0` **et** `skipped: 0`.

`teamStatsWritten` ne compte pas les matchs enrichis dans le lot : le rolling
backfill recalcule toute la saison après chaque lot et peut afficher 760
lignes pour une saison de 380 matchs.

### 6.3 Compétitions et saisons particulières

**Vague 5, actives mais hors backtest** (`includeInBacktest=false`), à
traiter seulement après les 52 compétitions des vagues 1 à 4, sauf besoin
produit spécifique :

```text
ARG2, CHI2, CHN2, EST1, FIN2, FRI, ISL1, KOR2,
LAT1, USA2, WCQAF, WCQAS, WCQCA, WCQE, WCQOC, WCQSA
```

Les qualifications internationales utilisent des années d'édition
particulières. N'utiliser que les saisons réellement présentes en base :

| Code  | Paramètres de saison connus |
| ----- | --------------------------- |
| WCQAF | 2023, 2022                  |
| WCQAS | 2023, 2022                  |
| WCQCA | 2024, 2022                  |
| WCQE  | 2024, 2020                  |
| WCQOC | 2024, 2022                  |
| WCQSA | 2023, 2022                  |

**Compétitions UEFA** : nommées sur deux années en base, mais la route reçoit
toujours l'année de départ, `2025` pour `2025-26`.

**`J1`** : la compétition porte `apiSeasonOverride=2027`. Commencer par
`2027`, puis vérifier les logs avant d'appeler une autre année.

### 6.4 Piège des anciennes saisons calendaires

La base contient des saisons historiques créées avant la correction de la
convention de nommage. Certaines ligues calendaires possèdent par exemple une
saison nommée `2025-26`, alors que la route manuelle cherchera `2025`. Le
planificateur n'est pas concerné (il cible la saison par identifiant), la
route manuelle l'est.

Ligues potentiellement touchées, saison commençant entre janvier et juin :

```text
ARG1, ARG2, BRA1, BRA2, CHI1, CHI2, CHN2, CSL,
EST1, FIN1, FIN2, IRL1, ISL1, J1, KOR1, KOR2,
LAT1, MLS, NOR1, NOR2, SWE1, SWE2, USA2
```

Procédure pour ces ligues :

1. lancer uniquement la saison courante en canari ;
2. vérifier que `backlog` correspond au nombre de matchs attendu ;
3. si le job affiche `count: 0` alors que la base contient des matchs
   terminés, arrêter ;
4. ne pas lancer les autres années : il faut d'abord normaliser les saisons
   ou adapter le worker pour retrouver la saison existante par dates.

Un `count: 0` inattendu n'est pas une réussite.

### 6.5 Fixtures manquantes

Le backfill ne voit que les matchs terminés déjà présents dans `fixture`. Si
une saison attendue affiche zéro match, importer d'abord ses fixtures, attendre
la fin du job, puis relancer le backfill `stats` :

```bash
BACKFILL_CODE=LL
BACKFILL_SEASON=2024

docker exec evcore-backend curl -fsS -X POST \
  "http://127.0.0.1:3000/etl/sync/fixtures/${BACKFILL_CODE}/backfill?seasons=${BACKFILL_SEASON}"
```

### 6.6 Vérification SQL d'une saison

Valable pour les deux modes. Remplacer le code et le nom de saison :

```sql
SELECT
  c.code,
  s.name AS season,
  COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'FINISHED') AS finished,
  COUNT(DISTINCT f.id) FILTER (
    WHERE f.status = 'FINISHED'
      AND f."statisticsSyncedAt" IS NOT NULL
  ) AS statistics_synced,
  COUNT(DISTINCT f.id) FILTER (
    WHERE f.status = 'FINISHED'
      AND f."statisticsUnavailable" = true
  ) AS statistics_unavailable,
  COUNT(DISTINCT fs."fixtureId") AS fixtures_with_statistic_rows,
  COUNT(fs.id) AS statistic_rows
FROM competition c
JOIN season s ON s."competitionId" = c.id
LEFT JOIN fixture f ON f."seasonId" = s.id
LEFT JOIN fixture_statistic fs ON fs."fixtureId" = f.id
WHERE c.code = 'PL'
  AND s.name = '2025-26'
GROUP BY c.code, s.name;
```

Critères de réception :

- `statistics_synced + statistics_unavailable = finished` ;
- `statistics_unavailable` reste faible et chaque cas est expliqué ;
- `fixtures_with_statistic_rows` est proche de `statistics_synced` ;
- aucun `429` ou échec transitoire n'est resté sans nouvelle tentative ;
- le rolling backfill s'est terminé sans erreur.
