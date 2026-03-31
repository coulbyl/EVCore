# EVCore — TODO

## Amélioration continue du modèle — Audit 20-28 mars 2026

Basé sur l'analyse des 6 audits (41 bets, 26.8% win rate global). Objectif : amélioration continue
sans désactivation de marchés — relèvement de seuils et extension des mécanismes existants.

### 1. Guard xG coverage par compétition ✅ IMPLÉMENTÉ (2026-03-29)

`getLeagueEvThreshold(competitionCode)` dans `ev.constants.ts` — EV threshold relevé par ligue :

- FRI / WCQE → 0.15 (xG coverage sparse : FRI 4%, WCQE ~9% zero-xG records)
- UNL → 0.12
- EL2 / F2 → 0.10 (sparser odds coverage, xG noise)
- Autres ligues → EV_THRESHOLD par défaut (0.08)

Propagé dans `listEvaluatedPicks` / `listViablePicks` / `selectBestViablePick` via `competitionCode`.

### 2. Brier score et calibration par marché ✅ IMPLÉMENTÉ (2026-03-29)

`CalibrationService.computeAllMarkets()` — calcule le Brier score pour ONE_X_TWO, OVER_UNDER
et BTTS indépendamment, avec exclusion des bets `lambdaFloorHit=true` par défaut.

**Reste à faire** : intégrer `computeAllMarkets()` dans `AdjustmentService.settleAndCheck()` pour
que la calibration par marché déclenche des proposals ciblés (pas seulement global).

### 3. lambdaFloorHit — isolation dans la calibration ✅ IMPLÉMENTÉ (2026-03-29)

`lambdaFloorHit` était déjà persisté dans le JSON `features` de `ModelRun`.
`computeForMarket(market, { excludeLambdaFloorHit: true })` filtre ces bets via Prisma JSON path.
`computeAllMarkets()` l'exclut par défaut.

**Reste à faire** : alerte `NotificationService` si taux de lambdaFloorHit > seuil (ex. > 20%)
sur une compétition donnée sur les 7 derniers jours.

### 4. Seuil de probabilité directionnelle par marché ✅ IMPLÉMENTÉ (2026-03-29)

`MIN_DRAW_DIRECTION_PROBABILITY = 0.28` dans `ev.constants.ts`.
`getPickRejectionReason` : si `pick === 'DRAW' && isCombo && P(draw) < 0.28` → `probability_too_low`.
Élimine les NUL+MOINS à P(nul)=19-27% qui passaient uniquement via cotes élevées (0/3 win rate).

### 5. EV threshold par ligue ✅ IMPLÉMENTÉ (2026-03-29)

Voir item 1 — couvert par `getLeagueEvThreshold()`.
`LEAGUE_MIN_ODDS_COVERAGE` non implémenté : couvert indirectement par la hausse du seuil EV.
EL1 (5 fixtures avec odds) : laissé à EV_THRESHOLD (0.08) — win rate 50% sur l'échantillon actuel.

### 6. Fallback FRI sans xG/statistiques ❗ À PRIORISER

Constat confirmé par `db-stats.txt` et les audits FRI : la compétition `FRI` n'est pas exploitable
via le pipeline Poisson principal (`xG coverage = 4%`, matchs du jour souvent sans `model run`).
Pour les amicaux internationaux, il faut assumer un mode de prédiction fallback explicite au lieu
de laisser les fixtures en attente de stats qui n'arriveront pas.

Travail déjà lancé dans `packages/db/scripts/fri-elo-audit.ts` :

- filtre `FRI seniors` vs `Uxx` / clubs
- `Elo réel` via `World.tsv` (eloratings.net)
- `Elo interne` bootstrappé depuis `WCQE` / `UNL` / `FRI`
- benchmark contre `Pinnacle` dé-vigué
- métriques `Brier score` pour comparer les approches

Décision de design proposée :

- `FRI seniors` → source primaire = `Elo réel`
- fallback si mapping Elo absent = `Pinnacle dé-vigué`
- fallback si pas de cotes 1X2 complètes = `NO_BET`
- `FRI U17/U21` → pas de modèle maison pour l'instant ; au mieux `Pinnacle dé-vigué` avec
  confiance basse et garde-fous stricts

Intégration produit à faire :

- ajouter `predictionSource` / `fallbackSource` au moteur (`FRI_ELO_REAL`, `FRI_ELO_INTERNAL`,
  `ODDS_DEVIG`, `POISSON_MAIN`)
- brancher le fallback avant la logique Poisson quand `competitionCode === 'FRI'`
- limiter la V1 aux marchés `ONE_X_TWO` uniquement
- exiger des cotes Pinnacle complètes (`home/draw/away`) avant de calculer un `devig`
- garder des seuils plus stricts que le moteur principal (`EV`, confiance, cap de cote)
- persister dans `features` la source utilisée pour audit / calibration

Questions techniques à traiter avant merge :

- compléter et fiabiliser le mapping `TEAM_NAME_TO_ELO_CODE`
- décider si `Elo interne` peut être utilisé en prod ou reste un benchmark d'audit
- vérifier la fraîcheur / stratégie de snapshot Pinnacle à utiliser pour le `devig`
- définir si `FRI` produit des `BET` ou seulement des `NO_BET` qualifiés tant que l'échantillon
  calibré reste trop faible

Plan d'implémentation concret dans le codebase :

1. Brancher le fallback au point d'entrée du moteur

- fichier : `apps/backend/src/modules/betting-engine/betting-engine.service.ts`
- point actuel : `analyzeFixture()` skip immédiatement si `homeStats` ou `awayStats` manquent
- changement :
  - détecter `competitionCode === 'FRI'` avant le `return missing_team_stats`
  - si `FRI`, router vers une branche dédiée `analyzeFriFixture(...)`
  - conserver le chemin Poisson actuel pour toutes les autres compétitions

2. Introduire un type explicite de source de prédiction

- fichiers :
  - `apps/backend/src/modules/betting-engine/betting-engine.types.ts`
  - `apps/backend/src/utils/model-run.utils.ts`
  - `apps/backend/src/modules/audit/audit.types.ts`
- changement :
  - ajouter un enum/union applicatif du style
    `POISSON_MAIN | FRI_ELO_REAL | FRI_ELO_INTERNAL | ODDS_DEVIG`
  - persister `predictionSource` dans `ModelRun.features` sans migration Prisma dans un premier temps
  - exposer cette source dans les diagnostics audit/coupon pour rendre le fallback visible

3. Isoler la logique FRI dans un composant dédié

- nouveau fichier recommandé :
  `apps/backend/src/modules/betting-engine/fri-fallback.service.ts`
- responsabilités :
  - filtrer `seniors` vs `Uxx` / équipes club
  - résoudre le mapping équipe -> code Elo
  - charger les ratings réels depuis `packages/db/scripts/World.tsv` ou déplacer ce dataset dans un
    emplacement backend stable
  - calculer `pHome/pDraw/pAway` via formule Elo
  - fallback sur `devig` Pinnacle si mapping absent ou fixture non senior
- objectif : éviter de mélanger une logique Elo spécifique dans le cœur Poisson déjà dense

4. Réutiliser la couche odds existante au lieu de dupliquer l'accès base

- fichier : `apps/backend/src/modules/betting-engine/betting-engine.service.ts`
- point actuel : `findLatestOddsSnapshot()` exige déjà `home/draw/away` non nuls et choisit le meilleur bookmaker
- décision :
  - garder cette méthode comme source de snapshot 1X2
  - pour la V1 FRI, ne consommer que `homeOdds/drawOdds/awayOdds`
  - ne pas ouvrir `OVER_UNDER`, `BTTS`, `HT/FT` au fallback dans un premier temps

5. Ajouter une fabrique de probabilités 1X2 non-Poisson

- fichiers :
  - `apps/backend/src/modules/betting-engine/betting-engine.service.ts`
  - éventuellement `apps/backend/src/modules/betting-engine/betting-engine.utils.ts`
- changement :
  - introduire une structure légère de probas FRI `home/draw/away`
  - soit adapter `listEvaluatedPicks()` pour accepter un mode `1X2-only`
  - soit créer `listEvaluatedOneXTwoPicks()` pour le fallback FRI
- recommandation :
  - créer `listEvaluatedOneXTwoPicks()` ; c'est plus propre que de forcer de faux `lambdaHome/lambdaAway`
    uniquement pour satisfaire les marchés dérivés

6. Décision produit V1 : 1X2 uniquement pour FRI fallback

- dans `analyzeFriFixture(...)` :
  - `Elo réel` pour `FRI seniors` si mapping complet
  - `Pinnacle dé-vigué` sinon, si snapshot 1X2 complet disponible
  - `NO_BET` sinon
- garde-fous recommandés :
  - reprendre `getLeagueEvThreshold('FRI')`
  - conserver `MIN_SELECTION_ODDS`, `MAX_SELECTION_ODDS`
  - conserver les filtres de probabilité directionnelle sur `HOME/DRAW/AWAY`
  - durcir éventuellement `MIN_QUALITY_SCORE` ou imposer un seuil FRI dédié si les premiers audits restent faibles

7. Persistance des diagnostics pour audit et coupon

- fichier : `apps/backend/src/modules/betting-engine/betting-engine.service.ts`
- enrichir `features` avec :
  - `predictionSource`
  - `fallbackReason`
  - `eloDelta` si source Elo
  - `eloHome` / `eloAway` si source Elo
  - `devigBookmaker` si source odds
  - `lambdaHome` / `lambdaAway = null` sur fallback non-Poisson
- fichiers consommateurs à ajuster :
  - `apps/backend/src/utils/model-run.utils.ts`
  - `apps/backend/src/modules/coupon/coupon.service.ts`
  - `apps/backend/src/modules/audit/audit.repository.ts`
  - `packages/db/scripts/audit-fixtures.ts`

8. Tests à écrire avant activation

- fichier principal :
  `apps/backend/src/modules/betting-engine/betting-engine.service.spec.ts`
- cas minimaux :
  - FRI sans team stats + Elo réel dispo -> `analyzed`, `predictionSource=FRI_ELO_REAL`
  - FRI sans mapping Elo + odds Pinnacle complètes -> `analyzed`, `predictionSource=ODDS_DEVIG`
  - FRI sans odds 1X2 complètes -> `NO_BET`
  - FRI U21 -> pas d'Elo senior, fallback odds only
  - non-FRI sans team stats -> comportement actuel inchangé (`skipped`)
  - audit/coupon affichent bien la source de prédiction

Ordre de livraison recommandé :

- étape 1 : persister `predictionSource` + rendre visible la source dans les diagnostics
- étape 2 : brancher `ODDS_DEVIG` FRI 1X2-only
- étape 3 : brancher `FRI_ELO_REAL` pour seniors
- étape 4 : décider, à la lumière des audits, si `FRI_ELO_INTERNAL` mérite une activation produit
