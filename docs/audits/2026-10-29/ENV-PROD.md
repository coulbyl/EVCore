# Audit de l'environnement de prod — 29/10/2026

_Lecture des variables de planning et de comportement du backend de prod (fournies sans secret), confrontées au code (`main` au 29/10) et à la copie de prod du 29/10. Deux questions : qu'est-ce qui est mort ou dangereux, et comment en finir avec 62 variables._

## 1. Résumé

- **8 variables de prod ne sont lues nulle part** : les retirer ne change rien.
- **13 variables répètent la valeur par défaut du code** : les retirer ne change rien non plus.
- **6 variables disent vraiment quelque chose** (heure d'analyse 21 h, cotes à 6 h et 19 h, correction ML en ombre, fournisseur LLM et sa chaîne de secours, recherche Tavily, taille du pool). Ce sont des décisions prises : elles ont leur place dans le code, pas dans un fichier que personne ne relit.
- **Un vrai problème de planning**, invisible dans le `.env` : tous les coupons (déterministes et IA) sont composés sur la passe de **17 h UTC**. La passe « d'autorité » de 21 h recompose, puis jette son résultat ; l'IA repasse à 21 h 15 pour rien (appel LLM payé, résultat « PRESERVED » chaque soir).
- **La clé Together est bien réparée** : dernier 401 le 25/10, publication normale depuis le 26/10.
- **Faire comme iddia** : un `.env` racine pour le compose (ports, mots de passe locaux), un `.env` par application de 8 à 12 lignes (URLs, clés, secrets), validé par un schéma Zod au démarrage, et **tout le comportement dans le code**. Cible : backend 62 → 14, vantage-worker 20 → 8.

## 2. Variable par variable

### Mortes (jamais lues par le code)

| Variable | Pourquoi elle est morte |
| --- | --- |
| `KELLY_ENABLED` | Aucun code ne la lit. La frontière de phase (CLAUDE.md) vit dans le code, pas dans l'env. |
| `COUPON_ENFORCE_AVOID`, `COUPON_STAKE_DRAW` | Compositeur LLM retiré ; plus aucun lecteur. `COUPON_ENFORCE_AVOID_FADE` dans `.env.example` est morte aussi. |
| `ODDS_SNAPSHOT_RETENTION_DAYS` | Aucune purge de `odds_snapshot` n'existe. |
| `ETL_ENABLE_ROLLING_HORIZON`, `ETL_ROLLING_HORIZON_DAYS` | L'horizon est toujours planifié ; ses 4 jours sont `ROLLING_HORIZON_DEFAULTS` en code. |
| `ETL_STANDINGS_COMPETITIONS`, `ETL_STANDINGS_SYNC_CRON` | Aucun worker de classements. Et la Coupe du monde est finie depuis juillet. |
| `GROQ_API_KEY` (backend, `.env.example`) | Le backend n'a plus de client LLM depuis le 03/09. Si elle est aussi dans le `.env` de prod, la retirer. |

### Redites de la valeur par défaut (zéro effet)

`ETL_SCHEDULING_ENABLED=true`, `ETL_FIXTURES_SYNC_CRON`, `ETL_PENDING_BETS_SETTLEMENT_CRON`, `ETL_STALE_SCHEDULED_SYNC_CRON`, `ETL_STATS_SYNC_CRON`, `ETL_INJURIES_SYNC_CRON`, `ETL_ODDS_CSV_IMPORT_CRON`, `ETL_ELO_SYNC_CRON`, `ETL_ROLLING_HORIZON_CRON`, `STALE_SCHEDULED_SYNC_LOOKBACK_DAYS=14`, `SHADOW_PREDICTIONS_ENABLED=true`, `VANTAGE_COMPETITION_CODES=` (vide), `GROQ_RESEARCH_MODEL=groq/compound-mini`, `LOG_LEVEL=info`, `LOG_DIR=./logs`.

Chacune répète `ETL_CRON_SCHEDULES` ou le défaut du worker. Leur seul effet est de laisser croire qu'on peut les changer sans conséquence, alors que trois autres passes dépendent de leur heure (§ 3).

### Décisions réelles (différentes du défaut)

| Variable | Prod | Défaut code | Lecture |
| --- | --- | --- | --- |
| `ETL_BETTING_ENGINE_ANALYSIS_CRON` | `0 21` | `0 20` | Le commentaire du `.env` dit encore 20 h. Le vantage-worker suppose 20 h (§ 3). |
| `ETL_ODDS_PREMATCH_SYNC_CRON` | `0 6,19` | `0 6,18` | Cohérent avec 21 h. Le commentaire dit 18 h. |
| `ML_CORRECTION_ENABLED` | `true` | `false` | Ombre seule (journalisée, ne change aucune décision). Un appel ml-worker par match et par analyse, 5 à 7 analyses par match. Lu par les rapports et un script de backtest ; retiré du contexte VANTAGE le 03/09 parce qu'il dégradait DOMINANT quand on le suivait. |
| `LLM_PROVIDER=cerebras`, `LLM_PROVIDER_FALLBACKS=groq,together` | — | `groq`, vide | Juste. Nécessite les trois clés, le worker refuse de démarrer sinon. |
| `VANTAGE_ENABLE_RESEARCH=true`, `VANTAGE_RESEARCH_PROVIDER=tavily` | — | `false`, `groq` | Juste. Tourne sur les grands championnats seulement (`VANTAGE_RESEARCH_COMPETITION_CODES` non posée = top 5 + Ligue des champions). |
| `DATABASE_POOL_MAX=18` | — | — | À garder, c'est de l'infra. |

## 3. Le planning réel, mesuré

Tous horaires UTC. Copie de prod du 29/10, `coupon_generation_attempt` et `model_run` des 14 derniers jours.

```
J−1  06:00  cotes (relevé 1)
     17:00  horizon J+1..J+4 : cotes puis analyse de J, enchaînées
     17:03  ► Favori, Combiné, Cote 2, chasseurs, long : COMPOSÉS et publiés
     19:00  cotes (relevé 2)
     20:30  ► combiné IA : PUBLISHED (sur l'analyse de 17 h)
     21:00  analyse « d'autorité » de J (démarre)
     21:00  Favori, Combiné… : « composed » à nouveau, puis jetés (proposition immuable)
     21:15  combiné IA : appel LLM, puis PRESERVED (rien ne change)
     23:00  l'analyse de 21 h se termine (11 jours sur 14)
J    */30   ré-analyse des matchs à moins de 3 h, règlement
     08:00  résumé du matin ; relevé le lundi
```

**Ce que ça veut dire.**

1. **Les coupons sont des coupons de 17 h.** Cotes de 17 h, analyse de 17 h. Le relevé de 19 h et l'analyse de 21 h ne servent qu'aux écrans Décisions et Matchs. Ce n'est pas forcément faux (le joueur a ses coupons la veille au soir, c'est bien pour le produit), mais ce n'est écrit nulle part, et le commentaire du worker d'analyse croit que c'est la passe de 21 h qui compose.
2. **La passe de 21 h compose pour rien** et écrit `composed` dans `coupon_generation_attempt` alors que le résultat est jeté : la table ment sur ce qui a été publié.
3. **Le vantage-worker tourne à 20 h 30 et 21 h 15 parce que son code suppose une analyse à 20 h** (`VANTAGE_COUPON_CRON`, commentaire de `config.ts`). Avec l'analyse à 21 h qui finit vers 23 h, la passe de 20 h 30 lit l'analyse de 17 h (cohérent avec les autres coupons, par accident), et la passe de 21 h 15 paie un appel LLM chaque soir pour conserver la proposition existante.
4. Si un jour on décale l'analyse ou l'horizon, **rien ne prévient** : les deux applications ne partagent pas leur config.

**Proposition.** Assumer la passe de 17 h comme la passe des coupons, et l'écrire :
- le worker d'analyse ne lance les générateurs **que** depuis la passe d'horizon (ou n'écrit plus `composed` quand il conserve) ;
- `VANTAGE_COUPON_CRON` passe à **17 h 45**, sur le même vivier, et `VANTAGE_COUPON_RETRY_CRON` disparaît (il n'a jamais rien réparé depuis que les propositions sont immuables) ;
- les deux heures vivent dans **une seule constante** partagée (`packages/analysis-core`), plus dans deux `.env`.

L'autre option, composer à 21 h sur des cotes plus fraîches, impose d'attendre 23 h pour l'IA et retire au joueur ses coupons de la soirée : je ne la recommande pas sans mesure (la clôture est à J, pas à J−1 21 h, l'écart de prix entre 17 h et 21 h la veille est faible).

## 4. Faire comme iddia

Ce que fait iddia, et qui marche :

- **`.env` racine : 18 lignes**, uniquement ce que `compose.yml` lit (ports, identifiants Postgres et Redis locaux, Mailpit, RustFS).
- **Un `.env` par application, 3 à 12 lignes** : URL de base, URL Redis, secrets, URLs des autres apps. Un seul réglage de comportement (`TRUST_PROXY_HOPS`), et il est justifié par une procédure documentée.
- **Un schéma Zod** (`apps/api/src/shared/config/env.ts`) : l'application refuse de démarrer sur une variable manquante ou malformée, et l'env est typé partout.
- **Aucune heure, aucun flag, aucun seuil dans l'env.** Une décision est du code, avec son commentaire et son historique git.

Le même découpage pour EVCore :

| Fichier | Aujourd'hui | Cible | Ce qui reste |
| --- | ---: | ---: | --- |
| `.env` racine (compose) | 7 | 8 | ports, Postgres, Redis, Mailpit, RustFS locaux |
| `apps/backend/.env` | 62 | **14** | `DATABASE_URL`, `PGBOUNCER_URL`, `REDIS_HOST/PORT`, `APP_URL`, `CORS_ORIGINS`, `AUTH_COOKIE_DOMAIN`, `TOTP_APP_SECRET`, `ADMIN_API_TOKEN`, `API_FOOTBALL_KEY`, `RESEND_API_KEY/FROM/ADMIN_TO`, `VAPID_*`, `RUSTFS_*`, `ML_WORKER_URL`, `DATABASE_POOL_MAX` |
| `apps/vantage-worker/.env` | 20 | **8** | `DATABASE_URL`, `REDIS_HOST/PORT`, `LLM_PROVIDER`, `LLM_PROVIDER_FALLBACKS`, les clés des fournisseurs utilisés, `TAVILY_API_KEY` |

Tout le reste devient du code :

- **Les horaires** : `ETL_CRON_SCHEDULES` reçoit les valeurs de prod (21 h, 6 h et 19 h) et les deux crons VANTAGE s'alignent dessus depuis une constante partagée. Plus aucun `ETL_*_CRON` dans l'env.
- **Les flags décidés** : `ML_CORRECTION` (ombre, à trancher : on le garde si les rapports s'en servent encore, sinon on le coupe et on gagne du temps d'analyse), `SHADOW_PREDICTIONS` (gardé, la fiche de match l'affiche), `VANTAGE_ENABLE_RESEARCH` et son fournisseur. `KELLY` reste une constante de phase.
- **Les seuils et fenêtres** : `STALE_SCHEDULED_SYNC_LOOKBACK_DAYS`, les quotas API-Football (`API_FOOTBALL_DAILY_QUOTA`, `_QUOTA_ALERT_PCT`, `_AVG_*`), `ETL_REBUILD_CONCURRENCY`, `STATS_BACKFILL_*`, `SWEEP_INTERVAL_MS`, `VANTAGE_COUPON_INTRADAY_WINDOW_HOURS`, les modèles LLM par fournisseur.
- **Les comptes de départ** (`SEED_ADMIN_*`) : un script d'amorçage qui demande, pas quatre variables.
- **`PORT`, `HOST`, `NODE_ENV`, `LOG_LEVEL`, `LOG_DIR`** : défauts en code, l'image Docker pose `NODE_ENV`.

**Garde-fous** : un schéma Zod par application, qui refuse une variable inconnue (c'est ce qui empêche les mortes de revenir) et qui nomme la variable manquante au démarrage. Le `.env.example` devient la liste exacte du schéma, rien d'autre.

## 5. Ce que je propose de faire, dans l'ordre

1. **Tout de suite, en prod, sans déploiement** : retirer les 8 mortes et les 15 redites du `.env`. Aucun effet, 23 lignes de moins.
2. **Lot « config »** (une PR) : schéma Zod par application, horaires et flags en code avec les valeurs de prod, `.env.example` réduits, `VANTAGE_COUPON_CRON` à 17 h 45 depuis une constante partagée, retrait du cron de reprise, le worker d'analyse n'écrit plus `composed` quand il conserve. Ce lot touche des jobs planifiés : revue `/code-review high` avant fusion.
3. **À trancher avant le lot** : `ML_CORRECTION` reste-t-elle en ombre ? C'est un appel ml-worker par match et par analyse, pour un signal retiré de VANTAGE le 03/09.

## 6. Décisions du 29/10

L'utilisateur tranche : **tout ce qui peut l'être devient immuable**, et les quelques réglages qu'un exploitant doit pouvoir changer sans déploiement passent par **une interface d'administration**, pas par le `.env`. Le `.env` ne garde que ce qui ne peut être ni dans le code ni en base : secrets et adresses.

Trois tiroirs, et une règle pour y ranger chaque variable :

| Tiroir | Règle | Contenu |
| --- | --- | --- |
| **`.env`** | Un secret, ou une adresse qui change avec la machine | `DATABASE_URL`, `PGBOUNCER_URL`, Redis, `APP_URL`, `CORS_ORIGINS`, `AUTH_COOKIE_DOMAIN`, `TOTP_APP_SECRET`, `ADMIN_API_TOKEN`, `API_FOOTBALL_KEY`, Resend, VAPID, RustFS, `ML_WORKER_URL`, `DATABASE_POOL_MAX`, clés LLM et Tavily |
| **Code** (`config/`) | Une décision mesurée, qui ne change qu'avec une PR et son argument | Tous les horaires (21 h, 6 h et 19 h, 17 h 45 pour l'IA, 8 h pour la matinée), les fenêtres et seuils (3 h de ré-analyse, 14 jours de rattrapage, quotas moyens API-Football), les frontières de phase (`KELLY`), les modèles LLM par fournisseur |
| **Réglages admin** (table `app_setting`, écran Pilotage › Réglages) | Un bouton qu'un exploitant doit pouvoir toucher le soir même, sans déploiement, et dont l'historique compte | Fournisseur LLM et chaîne de secours (les clés restent dans `.env`), recherche web (on/off, fournisseur, championnats), ~~correction ML en ombre~~ (tranché le 29/10 : constante `false` en code, voir ML-UTILITE.md), seuil d'alerte du quota API-Football, réserve quotidienne du rattrapage de stats, **interrupteur général des passes planifiées** (`ETL_SCHEDULING_ENABLED`, à n'utiliser qu'en incident) |

Règles de la table `app_setting` : une ligne par clé, typée (booléen, entier, texte, liste), avec sa valeur par défaut en code (le code marche sans la table), **qui** a changé quoi et quand (journal d'audit, déjà présent dans l'admin), et un rechargement à chaud côté backend et vantage-worker (lecture en base à chaque passe, pas au démarrage). Aucune clé secrète n'y entre jamais.

L'écran lui-même s'écrit avec le reste de l'admin dans la refonte UI (`docs/refonte-ui/00-sommaire.md`, section Admin).
