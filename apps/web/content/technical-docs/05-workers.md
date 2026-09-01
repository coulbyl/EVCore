# Workers : ml-worker et vantage-worker

EVCore fait tourner deux services autonomes en dehors du backend NestJS : `apps/ml-worker/` (Python) et `apps/vantage-worker/` (TypeScript). Aucun des deux ne se trouve sur le chemin de requête du backend ou du frontend — ils lisent et écrivent directement dans PostgreSQL et communiquent par file BullMQ/Redis. Le backend ne sait pas qu'ils tournent : il ne voit que ce qu'ils écrivent en base.

---

## ml-worker : correction ML shadow

### Rôle

`ml-worker` est une couche de correction probabiliste entraînée sur l'historique des sélections réglées (`channel_selection`). Il apprend où le baseline Poisson du moteur sur/sous-estime la probabilité réelle, en comparant la probabilité annoncée à la probabilité dé-vigée des cotes Pinnacle/Bet365.

Point capital : **ml-worker n'entre jamais dans le scoring actif**. Ses corrections sont exclusivement stockées en mode « shadow » (`ModelRun.features.shadow_ml_by_channel`, `shadow_ml_corrected_p`, `shadow_ml_edge_delta`) par `apps/backend/src/modules/betting-engine/betting-engine.service.ts`, calculées strictement après que les `ChannelDecision` définitives ont déjà été persistées. Aucune décision de canal ne relit cette correction. C'est un signal de mesure, pas un signal de décision.

### Architecture

- Langage : Python 3.12, `fastapi`, `uvicorn`, `bullmq` (client Python), `scikit-learn`, `xgboost`, `psycopg`.
- `apps/ml-worker/src/main.py` lance en parallèle (`asyncio.gather`) :
  - un serveur HTTP FastAPI (port 8000) pour l'inférence synchrone ;
  - un worker BullMQ (`apps/ml-worker/src/worker.py`) qui consomme la file `ml-training` pour les jobs d'entraînement asynchrones.
- `apps/ml-worker/src/inference/registry.py` (`ModelRegistry`) charge en mémoire, au démarrage, tous les modèles actifs depuis la table `ml_model_version` (`WHERE "isActive" = true`), désérialisés via `joblib`. Un endpoint `POST /reload` permet au backend de forcer une resynchronisation après activation, auto-switch ou rollback d'un modèle, sans redémarrer le conteneur.
- `apps/ml-worker/src/inference/server.py` expose trois routes : `GET /health`, `POST /infer` (segment + features → `corrected_probability`), `POST /reload`.
- `apps/ml-worker/src/jobs/train.py` orchestre l'entraînement : extraction du dataset (`data/extract.py`) → entraînement (`models/correction.py`) → persistance (`models/persist.py`).
- `apps/ml-worker/src/models/correction.py` implémente deux algorithmes : régression logistique (par défaut) et XGBoost (`CalibratedClassifierCV`, méthode isotonique) — XGBoost est choisi automatiquement (`algorithm: "auto"`) dès que le segment atteint 200 échantillons avec cote Pinnacle disponible. Un split temporel 70/30 (train sur les données anciennes, test sur les plus récentes) évite la fuite de données.
- Les modèles entraînés sont sérialisés en `.pkl` (`joblib`) dans `/app/models/`, un volume Docker nommé (`ml_models`) pour survivre aux redémarrages.

### Marchés et canaux couverts

`apps/ml-worker/src/jobs/train.py` (`VALID_SEGMENTS`) et `apps/backend/src/modules/ml/ml.constants.ts` (`ML_SEGMENTS`) définissent les segments entraînables :

- `ALL`
- `VALUE:ONE_X_TWO`, `VALUE:OVER_UNDER`, `VALUE:BTTS`, `VALUE:FIRST_HALF_WINNER`
- `SAFE:ONE_X_TWO`, `SAFE:OVER_UNDER`
- `DOMINANT:ONE_X_TWO`
- `BTTS:BTTS`
- `DRAW:ONE_X_TWO`
- `GOALS:OVER_UNDER`
- `CLEAN_SHEET:CLEAN_SHEET_HOME`, `CLEAN_SHEET:CLEAN_SHEET_AWAY`
- `TEAM_TOTAL:TEAM_TOTAL_HOME`, `TEAM_TOTAL:TEAM_TOTAL_AWAY`
- `WIN_EITHER_HALF:TO_WIN_EITHER_HALF`

`CLEAN_SHEET`, `TEAM_TOTAL` et `WIN_EITHER_HALF` ont été ajoutés le 2026-07-24, une fois le volume réel de sélections réglées et la couverture de cotes Pinnacle/Bet365 confirmés sur ces marchés (`apps/ml-worker/src/data/extract.py`).

`CORRECT_SCORE` reste explicitement exclu au moment de la rédaction : un marché à ~50 scores concurrents nécessite une logique de dé-vig différente des marchés à deux/trois issues gérés aujourd'hui — c'est un chantier différé, pas un oubli.

Pour l'inférence en temps réel (`predictShadowCorrection`), `ML_SHADOW_CHANNELS` dans `apps/backend/src/modules/ml/ml.constants.ts` liste les canaux réellement branchés : `VALUE`, `DOMINANT`, `BTTS`, `DRAW`, `GOALS`, `CLEAN_SHEET`, `TEAM_TOTAL`, `WIN_EITHER_HALF`. `SAFE` est entraîné mais volontairement exclu de l'inférence live.

### Accès base de données

- `apps/ml-worker/src/data/extract.py` construit le dataset d'entraînement en joignant `model_run` → `channel_decision` → `channel_selection` → `fixture` → `season` → `competition`, plus une jointure latérale sur `odds_snapshot` (Pinnacle prioritaire, Bet365 en repli) pour dé-viger la cote de chaque pick.
- Le registre de modèles lit `ml_model_version` (colonnes `segment`, `modelPath`, `isActive`).
- Chaque entraînement réussi insère une nouvelle ligne dans `ml_model_version` avec les métriques (`brierScore`, `calibrationError`, `roiShadow`, tailles d'échantillon).
- Toutes les requêtes passent par `psycopg` (connexion directe, pas Prisma — ml-worker est Python).

### Déclenchement

- Entraînement : jobs BullMQ sur la file `ml-training` (nom de job `train`), poussés par le backend NestJS (`apps/backend/src/modules/ml/ml.service.ts`) selon un planning cron (`ML_CRON_SCHEDULES` : vérification hebdomadaire le lundi 03:00 UTC, rattrapage horaire, health-check toutes les 15 minutes) et les règles de ré-entraînement (`ML_RETRAIN_MIN_NEW_BETS = 50`, `ML_COOLDOWN_DAYS = 7`, amélioration minimale de Brier `ML_MIN_BRIER_IMPROVEMENT = 0.05`).
- Inférence : appel HTTP synchrone du backend vers `ml-worker` (`ML_WORKER_URL`, défaut `http://ml-worker:8000`) via `apps/backend/src/modules/ml/ml.inference.service.ts`, avec un timeout de 500 ms pour `/infer` et de 5 s pour `/reload`. Un échec ou un timeout ne bloque jamais le scoring — la méthode retourne `null` et le pipeline continue sans correction.

---

## vantage-worker : le canal LLM VANTAGE

### Rôle

`vantage-worker` fait tourner **VANTAGE**, le 20ᵉ canal du système (`docs/prediction-engine-families.md` en dénombre 19 déterministes ; VANTAGE s'ajoute comme le seul dont la décision provient d'un LLM). Contrairement à ml-worker, VANTAGE **est** un canal à part entière : il écrit ses propres lignes `ChannelDecision` / `ChannelSelection` (avec `channel: VANTAGE`), suivies en historique exactement comme n'importe quel autre canal (même ROI, même hit-rate, même règle « un canal qui perd se recalibre, ne se désactive pas »). Il n'a aucun statut spécial dans l'admission par calibration.

Ce que VANTAGE ne fait jamais (`apps/vantage-worker/docs/architecture.md`) :

- il ne modifie jamais le score, le pick ou la probabilité d'un autre canal ;
- il n'influence jamais la boucle de scoring déterministe — `ModelRun.llmDelta` / `ModelRun.openclawRaw` (réservés pour une future intégration LLM au scoring, EVCORE.md §14.3) restent intouchés ;
- il ne « picke » jamais par défaut : le cas courant est `verdict: "no_play"`, stocké en `status: REJECTED` ;
- il n'invente jamais de marché ou de pick illégal (double validation Zod + légalité de pick, voir plus bas).

VANTAGE lit, pour un match donné, les décisions des 19 autres canaux plus leur fiabilité mesurée sur cette compétition (approche « match-first », par opposition à l'approche « market-first » des autres canaux qui scannent tous les matchs pour un seul marché).

### Architecture

- Langage : TypeScript, importe directement `@evcore/analysis-core` et `@evcore/db` (pas de réimplémentation d'enums, contrairement à ml-worker qui doit dupliquer les noms de canaux côté Python).
- `apps/vantage-worker/src/main.ts` : démarre un worker BullMQ (`src/queue/worker.ts`) et programme lui-même un job répétable `sweep` (auto-planification, pas besoin de cron externe) toutes les `SWEEP_INTERVAL_MS` (défaut 300 000 ms).
- **Sweep** (`src/queue/find-eligible-fixtures.ts`, `src/queue/run-sweep-once.ts`) : trouve les fixtures dans les prochaines 48h (ou les 2 dernières heures) qui ont au moins une décision d'un canal non-VANTAGE et aucune décision VANTAGE. Tourne sur toutes les compétitions actives par défaut.
- **Recherche web optionnelle** (`src/research/`) : avant l'appel de verdict, une recherche peut être lancée pour donner du contexte (actualités, blessures, enjeu).
- **Analyse** (`src/vantage/analyze-fixture.ts`) : construit le contexte du match (`src/context/build-match-context.ts`), interroge le LLM (`src/groq/client.ts`), valide la réponse contre un schéma Zod (`src/vantage/response-schema.ts`), vérifie la légalité du pick pour son marché (`src/vantage/known-picks.ts`), puis persiste (`src/vantage/persist-decision.ts`) uniquement si les deux validations passent. Une réponse non conforme est journalisée et abandonnée, jamais persistée à moitié.
- `temperature: 0` sur chaque appel LLM, pour que chaque décision VANTAGE soit rejouable depuis son entrée journalisée.
- Le sweep et l'analyse sont idempotents : rejouer un job pour une fixture qui a déjà une décision VANTAGE l'écrase simplement (même contrainte d'unicité `(modelRunId, channel)` que tout autre canal).

### Providers LLM et chaîne de fallback

`apps/vantage-worker/src/config.ts` définit quatre providers compatibles OpenAI pour l'appel de verdict, tous servant le même modèle `gpt-oss-120b` : `groq`, `cerebras`, `together`, `fireworks`. Le provider primaire est sélectionné via `LLM_PROVIDER` (défaut `groq`), avec sa clé API dédiée (`GROQ_API_KEY`, `CEREBRAS_API_KEY`, etc.).

`LLM_PROVIDER_FALLBACKS` (liste séparée par virgules, vide par défaut) définit une chaîne de secours essayée en séquence sur une erreur transitoire (429, 5xx, timeout/connexion — voir `isRetryableProviderError` dans `src/groq/client.ts`). Chaque fallback nécessite sa propre clé API configurée : un fallback qui ne fonctionne pas silencieusement est jugé pire que pas de fallback.

Depuis le 2026-08-28, la production tourne avec `LLM_PROVIDER=cerebras` comme primaire et Groq en fallback (`LLM_PROVIDER_FALLBACKS=groq`), suite à la fermeture des inscriptions au palier Developer de Groq et à la limite de 8000 TPM du palier partagé qui rendait le sweep peu fiable à pleine échelle (68 compétitions).

### Recherche web (Tavily / Groq) et le bug du gate corrigé le 2026-08-29

La recherche situationnelle (`VANTAGE_ENABLE_RESEARCH`, désactivée par défaut) ajoute un appel de recherche web avant le verdict. Le backend de recherche est indépendant du provider LLM du verdict et se règle via `VANTAGE_RESEARCH_PROVIDER` :

- `groq` (par défaut) : utilise `groq/compound-mini`, la recherche web agentique native de Groq (elle-même adossée à Tavily en interne) — facturée 5 à 8 $ pour 1000 requêtes.
- `tavily` : appel direct à l'API `/search` de Tavily (`src/research/tavily.ts`), totalement indépendant du provider LLM du verdict — palier gratuit de 1000 crédits/mois, suffisant pour le volume par défaut de VANTAGE.

Un bug corrigé le 2026-08-29 : le contrôle de démarrage (le « gate ») ne vérifiait que le provider LLM **primaire** pour décider si la recherche `groq` était réellement utilisable. Or, en production, Groq était configuré uniquement en **fallback** (primaire = Cerebras) — la recherche web tournait donc réellement (Groq servait bien les appels de secours), mais le gate affichait un avertissement erroné laissant croire qu'aucune recherche n'avait jamais fonctionné. Le correctif introduit `findProviderClient` (`apps/vantage-worker/src/groq/client.ts`), qui recherche le provider demandé dans l'ensemble primaire + fallbacks avant d'émettre l'avertissement. Ce contrôle est exécuté au démarrage du process (`apps/vantage-worker/src/main.ts`), pas seulement de façon informative — s'il ne trouve aucun client `groq` configuré (primaire ou fallback) alors que `VANTAGE_RESEARCH_PROVIDER=groq`, il journalise un avertissement explicite ; de même si `VANTAGE_RESEARCH_PROVIDER=tavily` sans `TAVILY_API_KEY`.

`VANTAGE_RESEARCH_COMPETITION_CODES` limite la recherche (indépendamment du périmètre du verdict, qui couvre toutes les compétitions actives) aux « grands championnats » par défaut : `PL, LL, BL1, SA, L1, UCL, UEL, UECL`. Le commit `9b1fd685` a câblé `VANTAGE_RESEARCH_PROVIDER` et `TAVILY_API_KEY` dans `docker-compose.prod.yml`.

### Position dans les phases de canaux

VANTAGE n'est ni un canal Phase 1 (Poisson plein-match / mi-temps / implicite marché), ni un filtre Phase 2 (VALUE/SAFE), ni un méta-canal Phase 3 (CONSENSUS/CONTRARIAN/AVOID) au sens strict de `docs/prediction-engine-families.md`. C'est un canal ordinaire dans le processus d'admission (calibration par ratio réel/annoncé, jamais par ROI), mais son fonctionnement ressemble structurellement aux méta-canaux car il lit `previousDecisions` avant de statuer — sans pour autant appartenir à `META_STRATEGY_CHANNELS`, puisqu'il produit une vraie sélection jouable, contrairement à CONSENSUS/CONTRARIAN/AVOID qui n'émettent aucun pick propre.

### Proposition d'élargissement de contexte (non implémentée)

`apps/vantage-worker/docs/context-expansion-proposal.md` (statut : **proposition, rien codé**, daté du 2026-08-29) documente deux pistes pour enrichir le contexte que VANTAGE reçoit :

- **Piste C** : exposer aux prompts les probabilités internes qu'un canal calcule même quand il abstient (`REJECTED`), aujourd'hui perdues car aucune `ChannelSelection` n'est écrite sur un rejet.
- **Piste A** : donner à VANTAGE l'accès à des signaux bruts que les canaux déterministes ne modélisent pas, notamment `ModelRun.features.shadow_predictions` (second avis d'API-Football, vraiment indépendant du pipeline λ maison) et `shadow_ml_by_channel` (la correction ml-worker décrite plus haut — jamais injectée dans un canal, donc une information réellement nouvelle pour VANTAGE).

Le document signale aussi que la table `standing` n'est peuplée que pour la Coupe du Monde 2026 et ne doit pas être traitée comme une source disponible en dehors de ce tournoi, et rappelle que tout signal de cotes brutes doit être présenté comme « ce que le marché prix », jamais comme un edge — la règle CLAUDE.md sur l'edge anti-prédictif s'applique à VANTAGE comme à tout canal.

---

## Déploiement

### Développement (`docker-compose.yml`, racine du repo)

- **ml-worker** : construit depuis `apps/ml-worker/Dockerfile`, démarré par défaut avec un `docker compose up` classique. Exposé sur le port hôte `8001` (mappé vers `8000` dans le conteneur). Variables : `DATABASE_URL`, `PGBOUNCER_URL`, `REDIS_HOST`, `REDIS_PORT`, `LOG_LEVEL`. Volume nommé `ml_models` monté sur `/app/models`. Dépend de `pgbouncer` (démarré) et `redis` (healthy).
- **vantage-worker** : **opt-in** via un profil Compose (`profiles: ["vantage"]`) — il ne démarre pas sur un `docker compose up` nu, car `GROQ_API_KEY` est requis et la plupart des sessions de dev n'en ont pas besoin. Démarrage explicite :
  ```bash
  GROQ_API_KEY=... docker compose --profile vantage up -d vantage-worker
  ```
  Variables en dev : `DATABASE_URL`, `PGBOUNCER_URL`, `REDIS_HOST`, `REDIS_PORT`, `GROQ_API_KEY` (défaut vide), `GROQ_MODEL` (défaut `openai/gpt-oss-120b`), `LOG_LEVEL`. En alternative, `pnpm --filter vantage-worker dev` se connecte directement au Postgres/Redis du compose sans construire d'image.

### Production (`docker-compose.prod.yml`)

Les deux services sont câblés en continu, sans profil :

- **ml-worker** : image `ghcr.io/${GHCR_OWNER}/evcore-ml-worker:latest`, mêmes variables qu'en dev (`DATABASE_URL`, `PGBOUNCER_URL`, `REDIS_HOST`, `REDIS_PORT`, `LOG_LEVEL`), volume `ml_models` conservé, pas de port exposé côté hôte (accès uniquement via le réseau Docker interne, contrairement au dev où `8001` est publié). Dépend de `pgbouncer` et `redis`.
- **vantage-worker** : image `ghcr.io/${GHCR_OWNER}/evcore-vantage-worker:latest`. Variables critiques :
  - `LLM_PROVIDER` (défaut `groq`, prod actuelle sur `cerebras`) et les quatre paires clé/modèle (`GROQ_API_KEY`/`GROQ_MODEL`, `CEREBRAS_API_KEY`/`CEREBRAS_MODEL`, `TOGETHER_API_KEY`/`TOGETHER_MODEL`, `FIREWORKS_API_KEY`/`FIREWORKS_MODEL`) — seule la clé du provider réellement sélectionné est exigée par l'application elle-même au démarrage (Compose ne peut pas rendre une variable conditionnellement obligatoire).
  - `LLM_PROVIDER_FALLBACKS` (chaîne de secours, vide par défaut).
  - `SWEEP_INTERVAL_MS`, `VANTAGE_COMPETITION_CODES` (vide = toutes les compétitions actives).
  - `VANTAGE_ENABLE_RESEARCH` (défaut `false`), `VANTAGE_RESEARCH_PROVIDER` (défaut `groq`), `GROQ_RESEARCH_MODEL`, `TAVILY_API_KEY`, `VANTAGE_RESEARCH_COMPETITION_CODES` (vide = défaut « grands championnats »).
  - Les deux services partagent le même Postgres/PgBouncer/Redis que le `backend`, et dépendent de `pgbouncer` (démarré) et `redis` (healthy).
- `.github/workflows/deploy.yml` construit et pousse les deux images (`evcore-ml-worker`, `evcore-vantage-worker`) sur GHCR à chaque déploiement, au même titre que les autres services.

---

## État de calibration connu

- **ml-worker / shadow ML** : le flag `ML_CORRECTION_ENABLED=true` est actif en production (confirmé 2026-08-30). La correction n'a jamais été relue par aucune décision de canal — c'est une mesure pure, sans effet sur le scoring.
- **VANTAGE** : déployé en production depuis le 2026-08-28. Le premier contrôle de calibration (2026-08-29, `n=158`) montrait une calibration globale proche du parfait (53.3 % réel vs 53.2 % annoncé), mais aucun marché individuel n'avait encore atteint le seuil minimal de 50 sélections réglées nécessaire pour un jugement fiable par marché. `BTTS` en était proche ; `CLEAN_SHEET_HOME` était jugé suspect à ce stade. Ces chiffres datent du tout début du déploiement et doivent être vérifiés à nouveau en base avant toute conclusion.
- Le même audit (2026-08-29) a mesuré que 92 % des verdicts `no_play` de VANTAGE (942/1020) étaient justifiés par « les canaux convergent, pas de tension » — un artefact direct du prompt actuel, qui ne cherche que la tension inter-canaux (voir la proposition d'élargissement de contexte ci-dessus).
