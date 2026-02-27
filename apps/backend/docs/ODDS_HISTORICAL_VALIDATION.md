# Odds Historical — Runbook de validation (Semaine 5)

Ce guide permet de valider un run réel du worker `odds_historical_sync`.

## 1) Prérequis

Configurer `apps/backend/.env` (au minimum):

- `DATABASE_URL`
- `REDIS_HOST`, `REDIS_PORT`
- `ODDS_API_KEY`
- `ODDS_API_LEAGUE_ID` (optionnel, défaut EPL = `39`)

Si besoin, démarrer l'infra locale:

```bash
docker compose up -d postgres redis
```

Démarrer l'API backend:

```bash
pnpm --filter backend dev
```

## 2) Déclencher la sync odds

### a) Une seule saison (recommandé pour smoke test)

```bash
curl -X POST http://localhost:3000/etl/sync/odds-historical/2023
```

Réponse attendue:

```json
{"status":"ok","season":2023}
```

### b) Toutes les saisons configurées

```bash
curl -X POST http://localhost:3000/etl/sync/odds-historical
```

Réponse attendue:

```json
{"status":"ok"}
```

## 3) Vérifications DB (PostgreSQL)

Exécuter dans le conteneur Postgres:

```bash
docker exec -it evcore-postgres psql -U postgres -d evcore
```

### a) Volumétrie par saison

```sql
SELECT
  s.name AS season,
  COUNT(*) AS snapshot_count
FROM "OddsSnapshot" os
JOIN "Fixture" f ON f.id = os."fixtureId"
JOIN "Season" s ON s.id = f."seasonId"
GROUP BY s.name
ORDER BY s.name;
```

### b) Doublons (doit retourner 0 ligne)

```sql
SELECT
  os."fixtureId",
  os.bookmaker,
  os.market,
  os."snapshotAt",
  COUNT(*) AS c
FROM "OddsSnapshot" os
GROUP BY os."fixtureId", os.bookmaker, os.market, os."snapshotAt"
HAVING COUNT(*) > 1;
```

### c) Intégrité 1X2 (pas de null sur home/draw/away)

```sql
SELECT COUNT(*) AS invalid_one_x_two
FROM "OddsSnapshot"
WHERE market = 'ONE_X_TWO'
  AND ("homeOdds" IS NULL OR "drawOdds" IS NULL OR "awayOdds" IS NULL);
```

### d) Bornes odds (contrôle rapide)

```sql
SELECT COUNT(*) AS out_of_range
FROM "OddsSnapshot"
WHERE market = 'ONE_X_TWO'
  AND (
    "homeOdds" <= 1 OR "drawOdds" <= 1 OR "awayOdds" <= 1 OR
    "homeOdds" >= 1000 OR "drawOdds" >= 1000 OR "awayOdds" >= 1000
  );
```

### e) Échantillon lisible

```sql
SELECT
  s.name AS season,
  f."externalId" AS fixture_external_id,
  os.bookmaker,
  os."snapshotAt",
  os."homeOdds",
  os."drawOdds",
  os."awayOdds"
FROM "OddsSnapshot" os
JOIN "Fixture" f ON f.id = os."fixtureId"
JOIN "Season" s ON s.id = f."seasonId"
WHERE os.market = 'ONE_X_TWO'
ORDER BY os."snapshotAt" DESC
LIMIT 25;
```

## 4) Critères Go/No-Go Semaine 5

Go si:

- run `/etl/sync/odds-historical/:season` renvoie `status=ok`
- volumétrie non nulle sur la saison testée
- 0 doublon sur `(fixtureId, bookmaker, market, snapshotAt)`
- 0 ligne invalide sur 1X2 (null / odds hors bornes)

No-Go si un des points ci-dessus échoue: corriger mapping provider ou stratégie d'idempotence avant run 3 saisons.
