# Renforcement ETL & cohérence des données — plan d'implémentation

Date : 2026-07-02
Statut : **Planifié — implémentation prévue le 2026-07-03.** Rien de ce document n'est encore codé, à l'exception de l'exposition du flag AVOID dans la fiche d'analyse (fait le 2026-07-02).

---

## Contexte et déclencheur

La fiche d'analyse du 2026-07-02 (matchs du 03/07) a révélé deux failles de données, confirmées par recoupement code + API :

1. **Argentina – Cape Verde : λ corrompus** (home 0.41 / away 0.56, l'Argentine "outsider xG" face au Cap-Vert). Le marché donne l'Argentine à **1.14–1.16** (implied ~87 %). Le canal AVOID a bien neutralisé la fixture au staking (edges 0.312/0.313 ≥ maxEdge 0.3), mais il attrape la **conséquence** (pick à edge implausible), pas la **cause** (stats d'équipe manquantes/inversées en amont, qui polluent le score déterministe et tous les canaux). Rien ne bloque à l'ingestion.
2. **`shadowSignals.lineMovement` est `null` sur 100 % des fixtures.** Le calcul existe (`betting-engine.service.ts`, fenêtre 7 jours, flag `FEATURE_FLAGS.SCORING.LINE_MOVEMENT`) et le gate existe (`value.strategy.ts`, `LINE_MOVEMENT_THRESHOLD`), mais le worker `odds-prematch-sync` ne tourne qu'**une fois par jour (18:00 UTC) sur les fixtures du lendemain** → au plus 1 snapshot par fixture → jamais deux points pour mesurer un mouvement. Toute la chaîne aval est écrite et morte de faim.

## Sondage API-Football du 2026-07-02 (plan Pro)

- **Quota : 7 500 req/jour** (~280 consommées ce jour). ⚠ **Abonnement expire le 2026-07-05** — à renouveler avant d'implémenter quoi que ce soit qui en dépend. ⚠ La clé a circulé en clair (chat/fichiers) : la **régénérer** après les tests.
- `/odds?fixture=` : excellente couverture — 12 bookmakers sur NOR2, jusqu'à 110 marchés (Bet365) en WC. Sert l'état **courant** uniquement (champ `update`, rafraîchi ~3 h) → le line movement doit être construit par nos propres snapshots successifs.
- `/predictions?fixture=` : modèle indépendant d'API-Football (comparaison Poisson, forme, att/déf). Sur Argentina : `poisson_distribution 100 % / 0 %` en faveur de l'Argentine — un cross-check trivial aurait détecté l'inversion.
- `/injuries?league=&season=` : couvert en WC (61 entrées, joueur + raison + fixture), **vide en NOR2** (pas de couverture D2).
- `/fixtures/lineups?fixture=` : vide à H−5 ; disponible ~20–40 min avant le coup d'envoi → exploitable uniquement en passe PRE_KICKOFF.
- `/fixtures/statistics?fixture=` : **xG post-match** disponible (vérifié : Algérie 1.62 / Autriche 1.44) — non ingéré aujourd'hui (`stats.schema.ts` ne mappe pas `expected_goals`).
- The Odds API : **clé désactivée** (`DEACTIVATED_KEY`) — hors jeu.

## État des lieux — ce qui existe déjà (ne pas réinventer)

| Brique | Où | État |
| --- | --- | --- |
| Worker odds prematch (1X2 + O/U + BTTS + HT/FT + DC + CS, multi-books secondaires) | `etl/workers/odds-prematch-sync.worker.ts` | Cron 18:00 UTC, fixtures J+1 uniquement → 1 snapshot/fixture |
| Historisation snapshots (clé `fixtureId, bookmaker, market, pick, snapshotAt`) | `fixture.repository.ts` / `odds_snapshot` | Append-safe : deux `update` différents = deux lignes. Prêt pour le multi-snapshot |
| Calcul + gate line movement | `betting-engine.service.ts` (~L612), `value.strategy.ts` | Écrit, flaggé, jamais alimenté |
| Injuries sync (shadow) | `etl/workers/injuries-sync.worker.ts`, cron 06:00 UTC | Ingéré mais `features.shadow_injuries: null` — non branché au modèle |
| Soft alert EV élevée (anomalie calibration) | `betting-engine.service.ts` (`EV_MAX_SOFT_ALERT`) | Log uniquement, et **canal VALUE uniquement** (Argentina était un pick SAFE → non couvert) |
| Gate AVOID au staking (edge ≥ 0.3) | `avoid.strategy.ts`, `coupon.service.ts`, `signal-window.service.ts` | Actif, backtesté (−20 % ROI sur les picks écartés), kill-switch `COUPON_ENFORCE_AVOID` |
| Flag AVOID visible sur la fiche | `analysis-sheet.render.ts` (`avoidFlag`) | ✅ Fait le 2026-07-02 |

---

## Chantiers

### C1 — Cadence multi-snapshots des cotes (P1, le plus rentable)

Objectif : alimenter `shadowLineMovement` sans toucher au moteur.

- Étendre `odds-prematch-sync` pour couvrir les fixtures de **J+1 à J+3** (paramètre `horizonDays` dans le job data, défaut 3) au lieu de J+1 seul.
- Passer le cron à **2×/jour** (06:00 + 18:00 UTC, `ETL_ODDS_PREMATCH_SYNC_CRON` déjà configurable) → 4 à 8 snapshots par fixture avant kickoff.
- La déduplication est gratuite : `snapshotAt = match.update` et la clé d'upsert incluent déjà le timestamp — si l'API n'a pas rafraîchi, on réécrit la même ligne.
- Budget quota : ~30 fixtures/jour × 3 jours d'horizon × 2 runs = **~180 req/jour** sur 7 500. Négligeable.
- Vérification : après 48 h, `shadowSignals.lineMovement` non-null sur la fiche ; le gate VALUE `line_movement` devient opérant.

### C2 — Gate de cohérence λ↔marché à l'ingestion (P1, le fix "cause" du cas Argentina)

Objectif : détecter les données d'entrée corrompues **avant** le scoring, en amont d'AVOID.

- Stocker le **1X2 de tous les bookmakers prioritaires** (aujourd'hui `extractOneXTwoOdds` n'en garde qu'un seul ; les books secondaires ne stockent que les marchés non-1X2) → permet une **implied probability médiane** robuste aux outliers d'un book isolé.
- Nouveau check dans la passe d'analyse (le point où fixture + λ + cotes coexistent), config dans `config/` (jamais inline) :
  - favori du marché (médiane 1X2) ≠ favori du modèle (λ) avec écart d'implied > seuil → `calibration_alert` ;
  - |proba modèle − implied médiane| > seuil sur le pick argmax → `calibration_alert`.
- Effet d'une alerte : `ModelRun` marqué (champ ou `features.calibration_alert`), fixture **non publiable** sur les canaux misables (même mécanique de suppression qu'AVOID), notification. **Pas de correction automatique des λ** — on bloque, on n'invente pas de données (règle ETL : jamais inférer).
- Étendre la soft alert `EV_MAX_SOFT_ALERT` à **tous les canaux misables** (aujourd'hui VALUE seul — c'est un pick SAFE qui portait l'EV +0.46 d'Argentina).
- Seuils : à définir en s'appuyant sur la distribution observée (l'edge cap AVOID 0.3 et le plancher d'edge VALUE 0.10 servent de bornes de départ) ; **pas de valeur figée sans backtest**.

### C3 — Cross-check `/predictions` (P2)

Objectif : second modèle indépendant comme détecteur d'inversion/corruption.

- 1 req/fixture dans la passe d'analyse (ou le sync fixtures), payload Zod-validé, stocké en `features.shadow_predictions` (shadow strict, jamais dans le scoring — règle : pas de source primaire externe au déterministe).
- Alerte si **conflit directionnel** : leur `poisson_distribution` et nos λ désignent des favoris opposés → renforce `calibration_alert` (C2).
- Coût : ~30 req/jour.

### C4 — Brancher injuries + lineups en shadow (P3 — **Phase 2**, à confirmer avant d'implémenter)

- `shadow_injuries` : le worker existe, les données dorment. Agréger en signal simple (nb de titulaires absents par équipe, si dispo) dans `features.shadow_injuries`. Couverture limitée aux grandes compétitions (rien en NOR2) — le signal doit être explicitement `null` quand la ligue n'est pas couverte, jamais 0.
- `shadow_lineups` : placeholder déjà présent dans les features. Fetch en passe PRE_KICKOFF uniquement (disponibilité H−40 min). À ne faire qu'après validation du cycle PRE_KICKOFF sous cette contrainte horaire.

### C5 — xG post-match pour la calibration (P3)

- Ajouter `expected_goals` au schéma Zod de `stats-sync` et le persister → compare λ prédits vs xG réalisés par fixture. Alimente la boucle d'apprentissage et l'audit de sur-confiance (~8 pp connus), sans toucher au scoring live.

---

## Refonte ETL recommandée (constatée en préparant ce plan)

1. **Client API-Football partagé.** Les 9 workers dupliquent chacun la même plomberie `execFile('curl')` + marqueur HTTP + détection d'erreurs transitoires + détection de quota + `sleep(6s)`. Extraire un `etl/api-football.client.ts` unique (retry, rate-limit, quota, parsing) et faire des workers de purs orchestrateurs *fetch → Zod → repository*. C'est un prérequis sain pour C1–C3 qui ajoutent de nouveaux appels ; sans ça, on duplique une 10ᵉ fois.
2. **Suivi de quota actif.** Le quota n'est détecté qu'en réaction (erreur API). Lire le compteur (`/status` en fin de job ou headers) et alerter à 80 % — d'autant que C1/C3 augmentent la consommation.
3. **1X2 multi-books** (détaillé en C2) — correction d'une limitation du worker actuel plus qu'une feature.
4. **Hygiène clés** : renouveler le plan Pro avant le **2026-07-05** et régénérer `API_FOOTBALL_KEY` (exposée en clair pendant les tests) ; la clé The Odds API est morte, retirer toute référence.

## Impacts sur la fiche d'analyse et le web

État des lieux vérifié le 2026-07-02 : **la page décisions du web est en avance sur la fiche** — elle affiche déjà le canal AVOID avec ses offenders (`channel-selection-row.tsx` parse `reasonDetails.offenders`) et possède déjà un label `reasons.line_movement` (`channel-constants.ts`). La fiche, elle, vient seulement de rattraper AVOID (`avoidFlag`, 2026-07-02).

### Fiche d'analyse (backend `analysis-sheet`)

- **C1 (line movement)** : rien à coder — le rendu affiche déjà `Shadow : line=…` quand non-null et l'historique prob/cote par pick existe. Les champs se rempliront dès que la cadence multi-snapshots tournera.
- **C2 (calibration_alert)** : exposer un flag fixture-level sur le même pattern que `avoidFlag` (`calibrationAlert: { reasonCode, details } | null` dans le JSON + ligne `⚠` dans le TXT + compteur au résumé). Sans ça, l'alerte retomberait dans le même angle mort qu'AVOID avant le fix.
- **C3 (predictions)** : bloc optionnel `model.shadowPredictions` (favori API-Football vs favori modèle) — donne à Eva et aux IA externes un second avis lisible.
- **Prompt Eva (`analysis-sheet.prompt.ts`) — impact comportemental, pas cosmétique** : aucune règle ne dit à Eva d'écarter une fixture flaguée AVOID (ou demain `calibration_alert`) de ses "meilleurs picks". Le cas Argentina (SAFE à 98 %, EV +0.46 → filtre EV ≥ 0.08 franchi haut la main) passerait le prompt actuel. Ajouter une règle : fixture sous `⚠ AVOID`/`⚠ calibration` = exclue des "meilleurs picks", mentionnable uniquement en vigilance, reformulée en langage naturel (la règle 8 anti-jargon s'applique).

### Web (`apps/web`)

- **Types désynchronisés** : `domains/analysis-sheet/types/analysis-sheet.ts` duplique le JSON backend et a déjà dérivé (manque `avoidFlag`, `summary.avoidedFixtureCount`, `history` sur les picks). Faible impact runtime (l'export télécharge un blob sans le parser), mais à resynchroniser — et noter que cette duplication manuelle dérivera à chaque évolution ; un type partagé ou généré serait plus sain à terme.
- **C2** : ajouter le label i18n `calibration_alert` dans `channel-constants.ts`/messages + un badge d'alerte au niveau fixture sur la page décisions (le pattern AVOID existant sert de modèle).
- **Coupons/bet-slip** : l'enforcement AVOID droppe des legs silencieusement côté backend (`signal-window.service.ts`). Un pick visible sur la fiche/décisions mais absent du coupon sans explication = la même confusion que celle des IA externes. Afficher la raison d'exclusion ("écarté — divergence modèle/marché") dans l'UI coupon.
- **C5 (xG post-match)** : à terme, la page performance/audit pourra comparer λ prédits vs xG réalisés — hors périmètre de demain.

## Ordre d'implémentation proposé (2026-07-03)

1. Refonte client partagé (1) — petit, débloque le reste proprement.
2. C1 cadence snapshots (+ suivi quota (2)).
3. C2 gate de cohérence (1X2 multi-books, médiane, alertes, extension soft alert) **+ exposition fiche (`calibrationAlert`) + label/badge web + règle prompt Eva** — livrer le gate et sa visibilité ensemble.
4. C3 cross-check predictions (+ bloc `shadowPredictions` fiche).
5. Resync des types web `analysis-sheet.ts` (rattrape aussi `avoidFlag`/`history` déjà manquants) + raison d'exclusion AVOID dans l'UI coupon.
6. C4/C5 : à planifier séparément (C4 = frontière Phase 2, confirmation explicite requise).

## Garde-fous (rappel des règles projet)

- Zod sur **tout** payload externe avant écriture ; payload partiel = rejet total + alerte.
- Aucun seuil numérique inline — tout dans `config/`.
- `decimal.js` pour cotes/probas/EV ; probas asserties dans `[0, 1]` à l'ingestion.
- Les nouveaux signaux (predictions, injuries, lineups) restent **shadow** : jamais consommés par le scoring tant qu'une amélioration hors échantillon n'est pas démontrée (même doctrine que H2H).
- Ne jamais inférer une donnée manquante : une incohérence détectée **bloque**, elle ne se corrige pas toute seule.
