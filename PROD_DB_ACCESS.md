# Accès lecture seule à la base de production

Ce document explique comment se connecter en lecture seule à la base Postgres de production, pour faire de l'analyse (post-mortem de coupons, audit du modèle, exploration de données) sans dépendre d'un dump/sync vers la DB locale à chaque fois.

⚠️ **Aucun identifiant réel n'est écrit dans ce fichier** (il est versionné dans git). Les valeurs concrètes (IP serveur, utilisateur SSH, nom de la clé, mot de passe du rôle analyste) sont à conserver dans un endroit non versionné (gestionnaire de mots de passe, fichier local ignoré par git). Remplace les `<PLACEHOLDERS>` ci-dessous par tes propres valeurs à chaque utilisation.

## Pourquoi un tunnel SSH (et pas une connexion directe)

Le port Postgres (5432) **n'est pas publié sur l'hôte** du serveur de prod — seuls les conteneurs du même réseau Docker interne peuvent s'y connecter (`docker ps` montre `evcore-postgres` avec `5432/tcp` sans mapping `->`). Il faut donc :

1. Un tunnel SSH vers le serveur.
2. Faire pointer ce tunnel vers l'**IP interne du conteneur** `evcore-postgres` sur le réseau Docker (pas `localhost`, qui ne route pas vers le conteneur depuis l'hôte via ce chemin).

L'IP interne du conteneur **peut changer** si le conteneur redémarre — à revérifier si le tunnel refuse la connexion (`Connection refused` côté serveur = symptôme typique d'une IP obsolète).

## Étape 1 — Créer (une fois) un rôle Postgres en lecture seule

Sur le serveur, dans un `psql` connecté à la base (`docker exec -it evcore-postgres psql -U postgres -d evcore`, ou `docker ps | grep postgres` d'abord pour confirmer le nom du conteneur) :

```sql
CREATE ROLE evcore_analyst WITH LOGIN PASSWORD '<CHOISIS_UN_MOT_DE_PASSE_FORT>';
ALTER ROLE evcore_analyst SET statement_timeout = '30s';
ALTER ROLE evcore_analyst SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE evcore TO evcore_analyst;
GRANT USAGE ON SCHEMA public TO evcore_analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO evcore_analyst;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO evcore_analyst;
```

- `default_transaction_read_only = on` bloque toute écriture même par erreur.
- `statement_timeout = '30s'` tue une requête d'analyse trop lourde avant qu'elle ne pèse sur la prod.
- Le mot de passe doit être un vrai secret — ne jamais réutiliser un placeholder comme mot de passe final, et le faire tourner (`ALTER ROLE ... WITH PASSWORD ...`) si jamais il a transité en clair dans un chat ou un terminal partagé.

## Étape 2 — Trouver l'IP interne du conteneur Postgres

Sur le serveur :

```bash
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' evcore-postgres
```

→ donne un truc du style `172.19.0.3`. À refaire si le tunnel échoue après un redéploiement/redémarrage du conteneur.

## Étape 3 — Ouvrir le tunnel SSH (depuis la machine d'analyse)

```bash
ssh -i ~/.ssh/<CLE_SSH> -L 5433:<IP_INTERNE_CONTENEUR>:5432 <USER_SSH>@<HOST_PROD> -N
```

- `-N` : pas de shell, juste le forward. Laisser tourner dans un terminal dédié pendant toute la session d'analyse.
- Port local `5433` choisi pour ne pas entrer en conflit avec un Postgres local sur `5432`.
- Si plusieurs clés SSH existent et qu'on ne sait pas laquelle est acceptée :
  ```bash
  for k in <CLE_1> <CLE_2> <CLE_3>; do
    echo "== $k =="; ssh -i ~/.ssh/$k -o BatchMode=yes -o ConnectTimeout=5 <USER_SSH>@<HOST_PROD> "echo OK"
  done
  ```

Vérifier que le tunnel est bien monté avant de requêter :

```bash
(echo > /dev/tcp/127.0.0.1/5433) 2>&1 && echo "tunnel OK" || echo "tunnel DOWN"
```

## Étape 4 — Requêter

Le `psql` client n'est pas forcément installé sur la machine d'analyse (WSL2 minimal, pas de `sudo` interactif disponible). Le repo a déjà `pg` comme dépendance transitive (pnpm) — on peut s'en servir directement en Node sans rien installer :

```bash
PGPASSWORD='<MOT_DE_PASSE>' node -e "
const { Client } = require(require.resolve('pg', { paths: ['$(pwd)/node_modules/.pnpm'] }));
"
# En pratique le chemin résolu ressemble à :
# ./node_modules/.pnpm/pg@<version>/node_modules/pg
```

Script réutilisable (à adapter, exécuter avec `PGPASSWORD='<mdp>' node script.js`) :

```js
const {
  Client,
} = require("/chemin/vers/node_modules/.pnpm/pg@<version>/node_modules/pg");
const client = new Client({
  host: "127.0.0.1",
  port: 5433,
  user: "evcore_analyst",
  password: process.env.PGPASSWORD,
  database: "evcore",
});

client
  .connect()
  .then(() => client.query("SELECT ..."))
  .then((res) => {
    console.log(JSON.stringify(res.rows, null, 2));
    return client.end();
  })
  .catch((err) => {
    console.error("ERROR:", err.message);
    process.exit(1);
  });
```

Si `postgresql-client` est installé (`sudo apt install postgresql-client`), on peut aussi faire du `psql -h 127.0.0.1 -p 5433 -U evcore_analyst -d evcore` classique, plus confortable pour de l'exploration interactive.

## Règles de sécurité

- **Toujours** passer par `evcore_analyst` (ou un rôle read-only équivalent), jamais par le superuser `postgres`, même pour une requête "juste en lecture".
- Ne jamais coller le mot de passe du rôle dans un fichier versionné (ce fichier y compris).
- Couper le tunnel SSH en fin de session.
- Si le mot de passe a été partagé en clair dans un chat/terminal à un moment donné (ça a été le cas lors de la mise en place initiale), le faire tourner dès que possible.

## Tables utiles pour l'analyse (repérées en explorant le schéma)

| Table                                                                            | Utilité                                                                                                                                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fixture`                                                                        | Matchs, scores, **`leg`/`round`/`aggregateHomeGoals`/`aggregateAwayGoals`** — essentiel pour le contexte aller/retour en coupe d'Europe                                              |
| `model_run`                                                                      | Une ligne par analyse (rolling horizon, 5 à 7 par match avant le coup d'envoi), `features` JSON contient `calibration_alert`, lambda, etc.                                           |
| `channel_decision` / `channel_selection`                                         | Décisions par canal (DOMINANT/BTTS/DRAW/GOALS/TEAM_TOTAL/VANTAGE/..., VALUE/SAFE en observation seulement), avec `probability`, `odds`, `ev`, `result`                               |
| `coupon_proposal`                                                                | Coupons générés automatiquement (`source` : PRICE_COMPOSER, ENGINE ; LLM pour l'ancien combiné de l'IA, coupé le 03/11), avec **`jointProbability`** et `combinedOdds` déjà calculés |
| `coupon_proposal_leg`                                                            | Jambes d'un coupon automatique, avec `isCorrect` par jambe                                                                                                                           |
| `team_stats`, `standing`, `national_team_elo_rating`                             | Contexte forme/classement, utile pour comprendre une dérive de calibration                                                                                                           |
| `odds_snapshot`                                                                  | Historique des cotes captées, partitionné par mois ; les mois anciens sont archivés en Parquet (`odds_archive_month` : fichier, lignes gardées)                                      |
| `vantage_decision_history`                                                       | Une ligne figée par avis de l'IA (VANTAGE) — c'est là que se lit son bilan, jamais sur la ligne vivante de `channel_decision`                                                        |
| `fixture_event` / `fixture_lineup` / `fixture_player_statistic` / `player_squad` | Événements, compositions, stats joueurs (`/fixtures?ids=`) et effectifs — règlement des nouveaux marchés (buteurs, tirs, minute…)                                                    |

## Rappels avant toute statistique

1. **Ne jamais compter `channel_selection` brut** : chaque ré-analyse écrit sa ligne (5 à 7 par pari réel). Lire la vue `channel_selection_deduped`, ou reproduire ses deux filtres (`DISTINCT ON (channel, fixtureId, market, pick)` sur la dernière analyse, et `mr."analyzedAt" < f."scheduledAt"` pour exclure les rétro-analyses).
2. **Clôture et ouverture** : `odds_closing_line` / `odds_opening_line` donnent le dernier et le premier prix avant le coup d'envoi par match, book, marché, pick et ligne — **toujours filtrer sur `hoursBeforeKickoff`** (un dernier relevé à 24 h n'est pas une clôture). Pour les marchés récents (Asian Handicap…), la ligne est dans `odds_snapshot.line`, jamais à parser dans `pick`.
3. **Juger par jambe** (réalisé ÷ annoncé), jamais sur un ROI de coupon : il n'a aucune puissance statistique à nos volumes.

_Fichier à mettre à jour si l'architecture d'accès change (rotation de clé, changement d'hébergeur, port Postgres publié différemment, etc.)._
