# Nettoyage des `.env` de prod — 31/10/2026

_Suite du lot config (15-todo.md, F1 à F5) et de l'audit [ENV-PROD](../2026-10-29/ENV-PROD.md). Ce document dit quoi retirer, quoi garder et quoi transformer en réglage, et dans quel ordre. Aucune de ces opérations n'est faite par le code : c'est à toi de les faire sur le serveur._

## L'ordre

1. **Déployer** la PR. Rien ne change de comportement. Au démarrage, le backend et le vantage-worker écrivent dans leur journal la liste des variables qu'ils ne lisent plus (« Environment variables no longer read » côté backend, `retiredEnv` dans la ligne de démarrage du worker). Ils ne refusent jamais de démarrer pour ça.
2. **Lancer la migration** `20261031140000_add_app_setting` (le backend l'applique à son démarrage, comme les autres).
3. **Lancer les deux rattrapages**, une fois :
   - `POST /coupons/settle-range?from=2026-09-17&to=<jour>` remplit `product_day` et les prix 1xBet manquants ;
   - `POST /channel-decisions/settle-range?from=2026-09-08&to=<jour>` règle l'historique figé de l'IA. Sans lui, le bilan « Avis IA » ne compte que les avis réglés depuis le déploiement : 5 sur la copie du 29/10, alors que plus de 5 000 avis joués portent sur des matchs terminés.

   Tous deux prennent l'en-tête `x-admin-token`, sont rejouables, et ne touchent aucun montant.
4. **Écrire les réglages** (§ 3) qui reprennent les valeurs de prod, en SQL tant que l'écran Réglages n'existe pas (il vient avec la refonte de l'admin).
5. **Retirer** les variables du § 1, puis celles du § 3 une fois leurs lignes écrites. Redémarrer, puis vérifier que le journal de démarrage ne nomme plus aucune variable.

## 1. À retirer — plus aucun effet

**Backend** (`apps/backend/.env`) :

- Mortes depuis avant le lot : `KELLY_ENABLED`, `COUPON_ENFORCE_AVOID`, `COUPON_ENFORCE_AVOID_FADE`, `COUPON_STAKE_DRAW`, `ODDS_SNAPSHOT_RETENTION_DAYS`, `ETL_ENABLE_ROLLING_HORIZON`, `ETL_ROLLING_HORIZON_DAYS`, `ETL_STANDINGS_COMPETITIONS`, `ETL_STANDINGS_SYNC_CRON`, `GROQ_API_KEY`, `GROQ_RESEARCH_MODEL`, `VANTAGE_COMPETITION_CODES`.
- Passés en code avec les valeurs de prod :
  - **tous les horaires `ETL_*_CRON`** : l'analyse à 21 h et les cotes à 6 h et 19 h sont désormais les valeurs du code ;
  - `SLIP_DIGEST_CRON`, `WEEKLY_STATEMENT_CRON`, `FOLLOWED_SETTLED_CRON` ;
  - `ETL_STATS_BACKFILL_CRON`, `ETL_REBUILD_CONCURRENCY`, `STALE_SCHEDULED_SYNC_LOOKBACK_DAYS` ;
  - `SHADOW_PREDICTIONS_ENABLED` (vrai en code) et `ML_CORRECTION_ENABLED` (faux en code) ;
  - `API_FOOTBALL_DAILY_QUOTA`, `API_FOOTBALL_AVG_DAILY_FIXTURES_PER_LEAGUE`, `API_FOOTBALL_AVG_DAILY_STATS_FIXTURES_PER_LEAGUE`. **À vérifier avant** : le code compte sur un quota de **7 500 appels par jour**. Si le `.env` de prod en dit un autre (un plan plus grand), dis-le-moi, la constante change par PR ; sinon l'alerte de quota sonnerait à tort.
- `STATS_BACKFILL_ENABLED` : encore honorée si elle vaut `false`, parce que sa valeur de prod n'est pas connue. Si elle est à `true` ou absente, la retirer.
- `ETL_SCHEDULING_ENABLED=true` : redite, à retirer. La variable ne sert plus qu'à couper les passes sur une copie locale. En prod, l'interrupteur est la ligne `scheduling.enabled` (§ 3).

**vantage-worker** (`apps/vantage-worker/.env`) : `GROQ_MODEL`, `CEREBRAS_MODEL`, `TOGETHER_MODEL`, `FIREWORKS_MODEL`, `GROQ_RESEARCH_MODEL`, `SWEEP_INTERVAL_MS`, `VANTAGE_COMPETITION_CODES`, `VANTAGE_COUPON_CRON`, `VANTAGE_COUPON_RETRY_CRON`, `VANTAGE_COUPON_INTRADAY_WINDOW_HOURS`. La passe IA tourne désormais à **17 h 45**, depuis une constante partagée avec le backend. La reprise de 21 h 15 est supprimée, et son ancienne planification est retirée de Redis au démarrage.

## 2. À garder — secrets et adresses

**Backend** : `DATABASE_URL`, `PGBOUNCER_URL`, `DATABASE_POOL_MAX`, `REDIS_HOST`, `REDIS_PORT`, `APP_URL`, `CORS_ORIGINS`, `AUTH_COOKIE_DOMAIN`, `TOTP_APP_SECRET` (obligatoire en production), `ADMIN_API_TOKEN`, `API_FOOTBALL_KEY`, `THE_ODDS_API_KEY` (seulement pour l'import historique), `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_ADMIN_TO`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `RUSTFS_*`, `ML_WORKER_URL`, `NODE_ENV`, `PORT`, `HOST`, `LOG_LEVEL`, `LOG_DIR`. Le démarrage vérifie leur forme (port numérique, URL valide). Une valeur vide compte comme absente.

**vantage-worker** : `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `LOG_LEVEL`, les clés `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `TOGETHER_API_KEY` et `TAVILY_API_KEY`. Un fournisseur nommé dans un réglage sans sa clé ici est écarté.

## 3. À transformer en réglage, puis retirer

Tant qu'aucune ligne n'est écrite, le code lit encore ces variables : rien ne change au déploiement. Une fois la ligne écrite, elle prime ; la variable peut alors partir.

| Réglage | Remplace | Valeur de prod à écrire |
| --- | --- | --- |
| `llm.providers` | `LLM_PROVIDER`, `LLM_PROVIDER_FALLBACKS` (worker) | `{"primary": "cerebras", "fallbacks": ["groq", "together"]}` |
| `research` | `VANTAGE_ENABLE_RESEARCH`, `VANTAGE_RESEARCH_PROVIDER`, `VANTAGE_RESEARCH_COMPETITION_CODES` (worker) | `{"enabled": true, "provider": "tavily", "competitionCodes": ["PL","LL","BL1","SA","L1","UCL","UEL","UECL"]}` |
| `apiFootball.quotaAlertPct` | `API_FOOTBALL_QUOTA_ALERT_PCT` (backend) | `80` |
| `statsBackfill.dailyReserve` | `STATS_BACKFILL_DAILY_RESERVE` (backend) | la valeur actuelle, `2500` si elle n'est pas posée |
| `scheduling.enabled` | (nouveau) | `true` ; `false` met en pause toutes les files du backend dans la minute |

En SQL, sur la base de prod :

```sql
INSERT INTO app_setting (key, value) VALUES
  ('llm.providers', '{"primary": "cerebras", "fallbacks": ["groq", "together"]}'),
  ('research', '{"enabled": true, "provider": "tavily", "competitionCodes": ["PL","LL","BL1","SA","L1","UCL","UEL","UECL"]}'),
  ('apiFootball.quotaAlertPct', '80'),
  ('statsBackfill.dailyReserve', '2500'),
  ('scheduling.enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now();
```

Vérifier d'abord les valeurs actuelles du `.env` de prod (fournisseur, chaîne de secours, liste des championnats de recherche, réserve) et les recopier telles quelles. Une ligne mal formée est ignorée et signalée dans le journal ; la variable reprend alors la main.

## 4. À décider ensemble

- **Le conteneur ml-worker** : la correction ML est coupée et le réentraînement n'est plus planifié. Le backend ne l'appelle plus que pour sa vérification de santé (un avertissement s'il ne répond pas) et pour un entraînement lancé à la main. On peut le retirer du compose de prod : c'est un changement de déploiement, pas de code.
- **Couper les passes planifiées longtemps** : l'interrupteur `scheduling.enabled` est fait pour un incident. Au rallumage, chaque passe arrivée à échéance pendant la coupure tourne une fois, aussitôt (la composition de 17 h comprise). Ne pas le laisser coupé à cheval sur 17 h sans y penser.
- **La composition de 21 h** : les générateurs tournent encore à 21 h, retrouvent le coupon de 17 h et écrivent désormais `preserved`. Les retirer de cette passe économiserait une composition jetée par soir, sans effet pour le joueur.
