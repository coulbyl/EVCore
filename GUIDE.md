# GUIDE.md — Lancer et opérer EVCore

docker exec -i evcore-postgres psql -U postgres -d evcore < /home/fannancoulibaly/lab/coulbyl-studio/evcore/backups/evcore_20260321_152841.sql

> Guide opérationnel basé sur les incidents et découvertes de la session du 13 mars 2026.

---

## 1. Premier démarrage (base vide)

```bash
# 1. Démarrer les services Docker (PostgreSQL + Redis + Mailpit)
docker compose up -d

# 2. Appliquer le schema DB
pnpm --filter @evcore/db db:migrate -- --name init

# 3. Seeder les compétitions (10 ligues actives)
pnpm --filter @evcore/db db:seed

# 4. Démarrer le backend
pnpm --filter backend dev
```

---

## 2. Après un `docker compose down` (données perdues)

Si tu as fait `docker compose down -v` (volume supprimé) ou recréé le container :

```bash
# Resynchroniser le schema (sans -v les données sont intactes, skip cette étape)
pnpm --filter @evcore/db db:migrate -- --name init

# Vérifier que les compétitions sont bien en DB
pnpm --filter @evcore/db db:seed
```

> **Note** : `docker compose down` sans `-v` conserve le volume — les données sont intactes.

---

## 3. Pipeline ETL — ordre obligatoire

Toujours respecter cet ordre. Chaque étape dépend de la précédente.

```
POST /etl/sync/fixtures            ← routine today+tomorrow UTC, ou /fixtures/:competitionCode pour backfill ligue
POST /etl/sync/settlement          ← refresh des fixtures avec bets pending + settlement coupon/bets
POST /etl/sync/stats               ← xG, shots (2s de délai par fixture — prévoir ~2h pour 3 saisons × 10 ligues)
POST /etl/sync/odds-csv            ← odds historiques Pinnacle/Bet365 depuis football-data.co.uk
POST /etl/sync/odds-live           ← cotes pré-match J+1 (corps JSON optionnel : { "date": "YYYY-MM-DD" })
POST /etl/sync/injuries            ← shadow scoring blessures sur la fenêtre today+tomorrow UTC
```

> **Raccourci** : `POST /etl/sync/full` enchaîne tout automatiquement.

> **Routes ETL réduites** : l'API expose maintenant `POST /etl/sync/:type` et
> `POST /etl/sync/:type/:competitionCode` (pour `fixtures`, `stats`, `injuries`).

Surveiller la progression :

```
GET /etl/status    ← jobs BullMQ (active / waiting / completed / failed) par queue
```

---

## 4. Backtest — ordre obligatoire

Les rolling stats doivent être calculées **avant** le backtest.

```
POST /rolling-stats/backfill-all    ← calcule TeamStats pour toutes les ligues × saisons
POST /backtest/run-all              ← lance le backtest sur toutes les saisons
GET  /backtest/validation-report    ← Brier Score / Calibration / ROI
```

### Nettoyage xG historique sans quota API

Si le dataset contient des fixtures avec `homeXg=0` et `awayXg=0` écrits à tort :

```bash
# audit sans écrire
pnpm --filter @evcore/db db:reset-zero-xg --codes=I2,F2,SP2,D2

# application réelle
pnpm --filter @evcore/db db:reset-zero-xg --apply --codes=I2,F2,SP2,D2
```

Ensuite relancer le recalcul des rolling stats :

```bash
POST /rolling-stats/backfill-all
```

Règle importante :

- remettre `homeXg/awayXg` à `null` laisse les fixtures éligibles à un futur `stats-sync`
- mettre `xgUnavailable=true` bloque les retries automatiques

Seuils de validation MVP :

| Métrique    | Seuil PASS |
| ----------- | ---------- |
| Brier Score | < 0.65     |
| Calibration | ≤ 5%       |
| ROI simulé  | ≥ -5%      |

> **Résultats de référence MVP (PL, 3 saisons)** : Brier 0.592 / Calibration 2.5% / ROI +2.28%

---

## 5. Générer un coupon

Le coupon se génère automatiquement à **20:00 UTC** chaque jour (après le odds-live-sync de 18:00 UTC).

Pour déclencher manuellement :

```
POST /coupon/generate-tomorrow
```

> Plusieurs coupons par jour sont possibles — chaque appel génère un nouveau coupon indépendamment.

Si le coupon retourne `NO_BET`, vérifier :

```sql
-- Fixtures SCHEDULED pour demain avec odds disponibles
SELECT COUNT(*) as scheduled, COUNT(o.id) as with_odds
FROM fixture f
LEFT JOIN odds_snapshot o ON o."fixtureId" = f.id AND o.market = 'ONE_X_TWO'
WHERE f.status = 'SCHEDULED'
  AND f."scheduledAt" >= 'YYYY-MM-14 00:00:00'
  AND f."scheduledAt" < 'YYYY-MM-15 00:00:00';
```

Si `with_odds = 0` → relancer `POST /etl/sync/odds-live` avec `{ "date": "YYYY-MM-DD" }`.

---

## 6. Logs

Les logs sont à deux endroits :

| Destination | Format                    | Chemin                      |
| ----------- | ------------------------- | --------------------------- |
| Console     | pino-pretty colorisé      | terminal                    |
| Fichier     | JSON brut (grep-friendly) | `apps/backend/logs/app.log` |

Variables d'env disponibles :

- `LOG_LEVEL=debug` — plus de verbosité
- `LOG_DIR=/chemin/vers/logs` — changer le dossier

---

## 7. Pièges connus

### Quota API-Football dépassé

L'API renvoie HTTP 200 avec `errors: { requests: "..." }`. Le worker `odds-live-sync` détecte ça, arrête le job et envoie une alerte. Les autres workers (fixtures, stats, injuries) ne le détectent pas encore.

### `stats-sync` lent

2 secondes de délai entre chaque appel API. Pour 3 saisons × 10 ligues (~4000 fixtures) : **prévoir ~2h**.

### `expected_goals: null` n'est pas `0`

Le worker `stats-sync` ne convertit plus `expected_goals: null` en `0`. Le fixture est marqué comme xG indisponible pour éviter de polluer les `teamStats` et les lambdas du moteur.

### `pending-bets-settlement-sync` — jobs en `failed`

Après un redémarrage à froid, certains jobs peuvent échouer si la table n'existe pas encore. Relancer `POST /etl/sync/settlement` une fois la DB prête.

### `injuries-sync` trop bavard

Le worker `injuries-sync` est maintenant limité à la fenêtre UTC `today + tomorrow`.
Il ne parcourt plus toutes les fixtures `SCHEDULED` de la saison courante.

### Pinnacle odds à 0 (depuis juillet 2025)

`football-data.co.uk` envoie `0` pour les cotes Pinnacle manquantes. Le schema les traite comme absents — les lignes sont importées avec Bet365 uniquement.

### BullMQ lock expiré (`could not renew lock`)

Se produit quand un job dure plus longtemps que le `lockDuration`. BullMQ replace le job en queue automatiquement. Si récurrent, augmenter `lockDuration` dans les options du worker.

### `etl.constants.ts` et `seed.ts` doivent être synchronisés

Les ligues actives sont définies à **deux endroits** :

- `packages/db/src/seed.ts` — état en DB
- `apps/backend/src/config/etl.constants.ts` — état utilisé par les workers ETL

Activer une ligue dans le seed sans mettre à jour `etl.constants.ts` = les workers l'ignorent.

---

## 8. Commandes qualité (avant tout commit)

```bash
pnpm --filter backend lint        # ESLint (--max-warnings 0)
pnpm --filter backend typecheck   # tsc --noEmit
pnpm --filter backend test        # Vitest (237 tests)
```

---

## 9. Prisma — workflow critique

Après tout changement de schema :

```bash
pnpm --filter @evcore/db db:generate   # regénère src/generated/prisma/
pnpm --filter @evcore/db build         # recompile dist/ → types visibles par le backend
```

En cas de drift entre migrations et DB (après `docker compose down -v`) :

```bash
pnpm --filter @evcore/db exec prisma db push   # applique le schema sans migration
```

Pour créer une migration nommée (toujours passer `--name`) :

```bash
pnpm --filter @evcore/db db:migrate -- --name <nom_descriptif>
```
