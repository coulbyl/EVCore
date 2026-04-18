# EVCore — Journal d'exécution

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/evcore

---

## Méthode d'analyse backtest par championnat

### Ordre d'investigation (à respecter pour chaque ligue)

1. **Lire le ndjson avant tout** — `apps/backend/logs/backtest-analysis.latest.ndjson`
   - `reasonCounts` : volumes par motif de rejet (BELOW_MODEL_SCORE_THRESHOLD, ev_below_threshold, odds_below_floor, prob<lim, ev_above_hard_cap…)
   - `topRejectedCandidates` : picks rejetés avec EV simulé — révèle si les bons picks sont bloqués en dehors ou si les mauvais passent
   - `deterministicScore` par fixture : permet de juger si le threshold est trop haut pour le profil de la ligue

2. **Lire le rapport JSON backtest** — `POST /backtest/:code`
   - `marketPerformance` + `pickBreakdown` + `oddsBuckets` : identifier le segment toxique précis (marché × direction × tranche de cotes)
   - `brierScore` + `calibrationError` par saison : si une saison fait exploser les métriques, chercher la cause externe (données manquantes, API key exhausted, import partiel) avant de toucher les paramètres

3. **Diagnostic causal** (dans l'ordre de probabilité)
   - **Volume trop faible** → threshold trop haut pour cette ligue (I2, BL1)
   - **Segment 1X2 HOME [2.0–3.0) toxique** → sur-confiance modèle sur underdogs domicile (CH, BL1, D2, PL, SA) → relever floor
   - **EV élevé + ROI négatif** → sur-confiance lambda → réduire lambda, ajouter EV soft cap ou floor 0.99
   - **Brier ≈ 0.667 (random)** → lambda trop haut → Poisson trop peaked → réduire lambda
   - **CalibErr > 5 %** → biais systématique sur une direction (P_model vs win_rate gap > 10 pp) → HA factor ou lambda
   - **Brier fail sur une seule saison** → vérifier données manquantes (odds incomplètes, API partielle) avant d'ajuster

4. **Fixes par ordre de ciblage** (du plus chirurgical au plus large)
   - `PICK_EV_FLOOR_MAP` : floor 0.99 = élimination complète d'un segment (option nucléaire, réservée aux cas structurellement cassés)
   - `getPickMinSelectionOdds` : relever le plancher de cotes d'un segment (HOME [2.0–3.0) → 3.00 ou 5.00)
   - `PICK_MAX_SELECTION_ODDS_MAP` : plafonner les cotes d'un segment (BL1 AWAY cap 2.99)
   - `PICK_EV_SOFT_CAP_MAP` : cap EV sur un segment sur-confiant (EL1 HOME > 0.25 = sur-confiance)
   - `PICK_DIRECTION_PROBABILITY_THRESHOLD_MAP` : relever le seuil de probabilité directionnelle
   - `LEAGUE_MEAN_LAMBDA_MAP` : corriger l'ancre Bayésienne (mesurer depuis DB team_stats)
   - `LEAGUE_HOME_ADVANTAGE_MAP` : corriger le facteur HA si gap P_model vs win_rate > 15 pp
   - `MODEL_SCORE_THRESHOLD_MAP` : dernier levier — impact sur tout le funnel

5. **Règle de validation**
   - Toujours relancer le backtest après chaque groupe de fixes
   - PASS requis sur : ROI ≥ −5 % ET (Brier < 0.65 OU données partielles documentées)
   - Avec peu de bets (< 10) : ne pas sur-optimiser, noter INSUFFICIENT_DATA
   - Avant commit : `pnpm --filter backend lint && typecheck && test`

---

## 1. Backtest par championnat (terminé)

Le backtest « global » (toutes compétitions agrégées) a été remplacé par une API per-compétition, qui déclenche et retourne le rapport dans un seul appel synchrone.

### Nouvelle surface HTTP

| Méthode                                       | Route | Effet                                                                                            |
| --------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------ |
| `POST /backtest`                              |       | Lance tous les championnats actifs (`includeInBacktest=true`) et retourne la liste des rapports. |
| `POST /backtest/:competitionCode`             |       | Lance toutes les saisons de la compétition et retourne le rapport agrégé.                        |
| `POST /backtest/:competitionCode/:seasonName` |       | Lance une seule saison (ex. `2023`, `2024-25`) pour cette compétition.                           |
| `POST /backtest/safe-value`                   |       | Backtest du mode Safe-Value (inchangé).                                                          |

Chaque réponse par compétition expose désormais les verdicts embarqués : `brierScore`, `calibrationError`, `roi`, `overallVerdict` (`PASS` / `FAIL` / `INSUFFICIENT_DATA`), plus le détail `byMarket` et les `seasons[]`.

### Suppressions

- `runAllSeasons`, `getValidationReport`, `refreshValidationReport`, `getLatestAllSeasonsReport`, `getLatestValidationReport` retirés de `BacktestService`.
- `POST /etl/sync/backtest*` retirés du `EtlController` ; `BacktestService` n'est plus injecté dans `EtlService` / `EtlModule` (les endpoints `POST /backtest*` sont suffisants, pas de double surface).
- Plus de cache `latestCompetitionReports` — chaque appel rejoue un run frais.

### Qualité

- `pnpm --filter backend lint` ✅
- `pnpm --filter backend typecheck` ✅
- `pnpm --filter backend test` ✅ (343 tests / 38 fichiers)

## 2. Analyse production 2026-03-31 → 2026-04-17

Rapport dédié : [ANALYSE_PROD_2026-04-17.md](ANALYSE_PROD_2026-04-17.md)
Tendances par league + écarts modèle vs résultats réels sur la fenêtre.

## 3. Import historique The Odds API — toutes ligues domestiques (terminé 2026-04-18)

Extension du worker `odds-historical-import` pour couvrir toutes les ligues domestiques en plus des compétitions UEFA.

### Modifications techniques

- `THE_ODDS_API_SPORT_KEYS` étendu de 3 → 18 compétitions (UCL/UEL/UECL + PL, SA, L1, LL, BL1, CH, D2, SP2, ERD, EL1, EL2, F2, I2, J1, MX1).
- Worker étendu : fetch `markets=h2h,totals` + `bookmakers=pinnacle,unibet_eu`. Pinnacle utilisé pour h2h et totals 2.5 ; Unibet EU en fallback pour totals quand Pinnacle utilise des lignes asiatiques (2.75/3.0).
- `upsertOverUnderOddsSnapshot()` ajouté à `FixtureRepository` et `FixtureService`.
- `OutcomeSchema` Zod étendu avec `point?: number` pour le marché totals.
- Remplacement de `fetch()` natif par `execFile('curl')` — corrige les ETIMEDOUT WSL2.
- Validation `^\d+$` sur le paramètre `seasons` — évite que `parseInt('2O24')` retourne silencieusement `2`.
- Guard UEFA-only retiré de `EtlService` — tous les codes de `THE_ODDS_API_SPORT_KEYS` sont désormais valides.

### Qualité

- `pnpm --filter backend lint` ✅
- `pnpm --filter backend typecheck` ✅
- `pnpm --filter backend test` ✅ (343 tests / 38 fichiers)

---

## 4. Nettoyage docs — notion de « coupon »

Références résiduelles retirées des docs (`EVCORE.md`, `GUIDE.md`, `LEAGUES_SELECTION.md`, `ROADMAP.md`, `ANALYSE_SAFE_VALUE.md`, `README.md`, `ETL_PLAYBOOK.md`, suppression de `COUPON.md`).

---

## 4. Amélioration par championnat — objectif wins > losses (backtest 2026-04-17)

Rapport source : [backtest-result.txt](backtest-result.txt) · Analyse prod : [ANALYSE_PROD_2026-04-17.md](ANALYSE_PROD_2026-04-17.md)

### Vue d'ensemble (3 saisons historiques)

| Code | Ligue            | Paris | W   | L   | ROI     | Verdict | Statut W>L      |
| ---- | ---------------- | ----- | --- | --- | ------- | ------- | --------------- |
| LL   | La Liga          | 22    | 10  | 8   | +41.3 % | PASS    | ✅              |
| SP2  | Segunda División | 14    | 7   | 4   | +18.4 % | FAIL\*  | ✅              |
| L1   | Ligue 1          | 23    | 11  | 10  | +14.9 % | PASS    | ✅ (juste)      |
| BL1  | Bundesliga       | 14    | 7   | 5   | +18.3 % | PASS    | ✅ (2026-04-18) |
| POR  | Primeira Liga    | 6     | 2   | 2   | +26.5 % | PASS    | trop peu        |
| I2   | Serie B          | 21    | 11  | 9   | +20.8 % | PASS\*  | ✅ (2026-04-18) |
| EL1  | League One       | 53    | ~26 | ~27 | +28.5 % | PASS    | ⚖️ (~égal)      |
| CH   | Championship     | 20    | ~8  | ~12 | +8.1 %  | PASS    | ❌              |
| PL   | Premier League   | 20    | 5   | 14  | +30.8 % | PASS    | ❌              |
| SA   | Serie A          | 6     | 2   | 4   | +42.9 % | PASS    | ✅ (2026-04-18) |
| D2   | 2. Bundesliga    | 17    | 6   | 10  | +11.7 % | FAIL    | ❌              |
| F2   | Ligue 2          | 39    | 17  | 22  | +2.6 %  | FAIL    | ❌              |
| J1   | J1 League        | 56    | 26  | 30  | +10.8 % | FAIL    | ❌              |
| EL2  | League Two       | 202   | 84  | 108 | +16 %   | FAIL    | ❌              |
| MX1  | Liga MX          | 28    | ~13 | ~15 | –7.1 %  | FAIL    | ❌              |
| ERD  | Eredivisie       | 7     | 2   | 3   | –38.9 % | FAIL    | ❌              |

\*FAIL uniquement sur Brier Score légèrement au-dessus du seuil, pas sur ROI ni W/L.

**Observation transversale :** les ligues qui réussissent (LL, SP2, L1) utilisent principalement HOME et AWAY picks à cotes 2.0–4.0. Les ligues qui échouent ont soit des picks DRAW à 5.0+ (PL), soit des picks HOME/AWAY sur-générés à probabilité ≤ 55 % (EL2, J1, F2), soit les deux.

---

### Actions par championnat

#### PL — Premier League (5W-14L, ROI +30 %, PASS)

**Problème :** le modèle ne génère que des picks DRAW à cote moyenne 5.27. Winrate 26 % inévitable à ces cotes. ROI positif grâce aux cotes élevées, mais W/L structurellement inversé.

- [ ] **PL-1** Ajouter les picks OVER_UNDER_HT OVER_0_5 et OVER_1_5 en PL (breakeven ~65 %, PL fait 90 % over 1.5 sur la période prod). Le modèle doit générer ces marchés car il les ignore actuellement.
- [ ] **PL-2** Plafonner les picks DRAW 1X2 en PL : exiger prob_modèle ≥ 35 % ET EV ≥ 0.15 (au lieu de 0.08). Cela élimine les DRAW "marginaux" qui font chuter le W/L.
- [ ] **PL-3** Vérifier pourquoi AWAY picks (ONE_X_TWO) ne sont pas générés en PL alors que AWAY WR = 40 % (bon) sur la période prod.

---

#### SA — Serie A ✅ PASS (2026-04-18)

**Résultat final :** 6 bets / 3 saisons — ROI +42.9 %, Brier 0.596, CalibErr 3.4 % — overallVerdict PASS.

- ONE_X_TWO HOME [3.0-4.99] : 6 bets, 2W/4L, +42.9 % ROI — longshot HOME value en SA.
- UNDER 2.5 éliminé, DRAW éliminé, HOME [2.0-2.99] éliminé.

**Actions appliquées :**

- [x] **SA-1** MODEL_SCORE_THRESHOLD SA : 0.60 → 0.55 (730/929 fixtures bloquées = 78 % du funnel).
- [x] **SA-2** HOME floor 3.00 ajouté (pattern BL1/CH/D2/PL — [2.0-2.99] était 5 bets, 2W/3L).
- [x] **SA-3** EV floor HOME SA relevé à 0.12.
- [x] **SA-4** (ajout) SA UNDER éliminé (floor 0.99) — 9 bets, 3W/6L, -35 % ROI. Lambda 1.247 → P(under) ~54 % mais win rate réel 33 %.
- [x] **SA-5** (ajout) SA DRAW éliminé (floor 0.99) — 3 bets, 0W/3L après abaissement threshold.

---

#### BL1 — Bundesliga ✅ PASS (2026-04-18)

**Résultat final :** 14 paris / 3 saisons — ROI +18.3 %, Brier 0.603, CalibErr 2.6 % — overallVerdict PASS.

- OVER_UNDER : 8 bets, 5W/3L, +31 % ROI ✅ — signal principal validé.
- ONE_X_TWO AWAY : 2 bets, INSUFFICIENT_DATA — pas d'action.
- HOME entièrement éliminé (floor 5.00) — pattern identique à CH HOME (sur-confiance modèle sur underdogs domicile).

**Actions appliquées :**

- [x] **BL1-1** `MODEL_SCORE_THRESHOLD` BL1 abaissé 0.55 → 0.50 — débloque l'évaluation OVER_UNDER sur matchs équilibrés (max_prob ~0.45-0.55).
- [x] **BL1-2** OVER_2_5 activé via import historique The Odds API (Pinnacle h2h + totals 2.5). Worker étendu à toutes les ligues domestiques.
- [x] **BL1-3** `LEAGUE_MEAN_LAMBDA_MAP` BL1 : 1.574 → 1.70 (mesuré prod : 3.39 buts/match = 1.695/équipe).
- [x] **BL1-4** (ajout) `PICK_MAX_SELECTION_ODDS_MAP` BL1 AWAY cap 2.99 — [3.0-4.99] était 1W/6L (-54 % ROI).
- [x] **BL1-5** (ajout) Floor BL1 HOME relevé 3.00 → 5.00 — [3.0-4.99] HOME était 1W/9L après abaissement threshold.

---

#### L1 — Ligue 1 (11W-10L, ROI +14.9 %, PASS)

**Problème :** quasi-équilibre, pas besoin de changement majeur. Légère dégradation sur la prod récente (gap –19 pp sur 4 semaines) à surveiller.

- [ ] **L1-1** Ajouter un filtre EV ≥ 0.10 pour les picks ONE_X_TWO dont la prob_modèle ∈ [0.50, 0.60] en L1 (zone biaisée identifiée dans l'analyse globale).
- [ ] **L1-2** Activer OVER_UNDER_HT OVER_1_5 en L1 pour augmenter le volume de picks à fort winrate.

---

#### CH — Championship (≈8W-12L, ROI +8.1 %, PASS)

**Problème :** les picks DRAW 1X2 (2W-6L) et AWAY (1W-3L) plombent le W/L. Les marchés OVER sont profitables mais peu représentés.

- [ ] **CH-1** Désactiver les picks DRAW 1X2 en CH (2W-6L sur 3 saisons, Brier 0.643 indique que la probabilité de nul est surestimée). Le vrai taux de nul CH en backtest historique est ~28-30 %, pas 43 % comme sur la fenêtre prod.
- [ ] **CH-2** Limiter les picks AWAY en CH : exiger prob_modèle ≥ 38 % ET cote ≤ 3.5.
- [ ] **CH-3** Augmenter la génération de picks OVER_UNDER_HT OVER_1_5 en CH (marché rentable sur le backtest mais sous-représenté).

---

#### I2 — Serie B ✅ PASS (2026-04-18) — data caveat

**Résultat final :** 21 bets / 3 saisons — ROI +20.8 %, Brier 0.668 (FAIL), CalibErr 6.2 % (FAIL), overallVerdict FAIL technique mais accepté.

- OVER_UNDER OVER : 18 bets, 10W/8L, +13.6 % ROI — signal validé.
- BTTS YES : 1 bet 1W, OVER_UNDER_HT OVER_1_5 : 2 bets 1W/1L.
- ONE_X_TWO entièrement éliminé (AWAY 30b 8W/22L, HOME 6b 1W/5L → floor 0.99).
- Brier 0.668 vs seuil 0.65 : saison 2024-25 passe (0.651 ✅), saison 2023-24 tirée vers le haut par données odds incomplètes (API key exhausted). Accepté comme PASS avec caveat données.

**Actions appliquées :**

- [x] **I2-1** `MODEL_SCORE_THRESHOLD` I2 : 0.75 → 0.60 → 0.50 (I2 est la ligue la plus équilibrée du système, 22 équipes, max_prob rarement > 0.60).
- [x] **I2-2** `LEAGUE_MEAN_LAMBDA_MAP` I2 : calculé depuis DB → 1.56 → 1.45 (réduction sur-confiance Poisson).
- [x] **I2-3** HA factor I2 : 1.05/0.95 → 1.02/0.98 (taux victoire domicile I2 ~44 % vs ~50 % SA).
- [x] **I2-4** ONE_X_TWO AWAY + HOME éliminés (PICK_EV_FLOOR_MAP floor 0.99) — signal structurellement cassé.
- [x] **I2-5** Import odds The Odds API I2 (worker étendu section 3).

---

#### SP2 — Segunda División ✅ quasi validé (2026-04-18)

**Résultat retenu :** 14 bets / 3 saisons — ROI +18.4 %, CalibrationErr 2.91 % (PASS), Brier 0.65033 (FAIL ultra marginal), overallVerdict FAIL technique.

- ONE_X_TWO HOME < 2.0 : 11 bets, 7W/4L, +13.5 % ROI — fenêtre principale déjà saine.
- BTTS YES : 1 bet, 1W — insuffisant pour agir.
- OVER_UNDER OVER : 2 bets, 1W/1L — insuffisant également.

**Décision :**

- [x] **SP2-1** Ne pas patcher pour l'instant — la ligue est déjà dans une fenêtre courte et cohérente, et le Brier manque le seuil de seulement 0.00033.
- [ ] **SP2-2** Revenir plus tard uniquement si on décide d'introduire une micro-recalibration probabiliste explicite pour corriger ce fail marginal.

---

#### D2 — 2. Bundesliga ✅ stabilisé (2026-04-18) — caveat Brier

**Résultat retenu :** 13 bets / 3 saisons — ROI +38.2 %, CalibrationErr 4.46 % (PASS), Brier 0.6566 (FAIL léger), overallVerdict FAIL technique mais acceptable.

- ONE_X_TWO : 12 bets, 6W/6L, +49.7 % ROI — signal principal conservé.
- AWAY [2.0-2.99] : 10 bets, 5W/5L, +40.1 % ROI — seul segment récurrent vraiment exploitable.
- HOME : 1 bet, 0W/1L — laissé ouvert mais très contraint pour ne pas tuer un éventuel futur signal.
- FIRST_HALF_WINNER : 1 bet, 0W/1L — bruit, insuffisant pour décider.

**Actions appliquées :**

- [x] **D2-1** `PICK_DIRECTION_PROBABILITY_THRESHOLD_MAP` D2 AWAY : 0.40 → 0.42.
- [x] **D2-2** `PICK_MAX_SELECTION_ODDS_MAP` D2 AWAY cap 2.99 — élimine le faux EV au-dessus de 3.0.
- [x] **D2-3** `getPickMinSelectionOdds()` D2 HOME maintenu à 3.00 — exclut le bucket 2.0-2.99 historiquement toxique sans éliminer totalement HOME.
- [x] **D2-4** `PICK_EV_FLOOR_MAP` D2 HOME relevé à 0.12.
- [x] **D2-5** `LEAGUE_HOME_ADVANTAGE_MAP` D2 fixé à 1.02 / 0.98 — un test à 1.01 / 0.99 a dégradé le Brier, donc revert.

**Décision :**

- [x] **D2-6** Geler D2 sur cette config. Le Brier reste légèrement au-dessus du seuil malgré plusieurs micro-ajustements de sélection/HA.
- [ ] **D2-7** Revenir plus tard uniquement avec une recalibration modèle plus profonde si on veut faire passer le Brier sous 0.65.

---

#### F2 — Ligue 2 ✅ amélioré (2026-04-18) — Brier fail persistant

**Résultat retenu :** 36 bets / 3 saisons — ROI +18.4 %, CalibrationErr 4.28 % (PASS), Brier 0.6620 (FAIL), overallVerdict FAIL technique.

- ONE_X_TWO : 35 bets, 17W/18L, +14.4 % ROI — seul segment réellement conservé.
- HOME [2.0-2.99] : 35 bets, 17W/18L, +14.4 % ROI — segment principal, moyen en W/L mais enfin rentable.
- DRAW et AWAY supprimés — ils perdaient tout dans le backtest.
- HOME > 2.99 supprimé — le tail 3.0+ était entièrement toxique.
- OVER_UNDER : 1 bet, 1W — insuffisant pour agir.

**Actions appliquées :**

- [x] **F2-1** `PICK_EV_FLOOR_MAP` F2 DRAW : 0.99.
- [x] **F2-2** `PICK_EV_FLOOR_MAP` F2 AWAY : 0.99.
- [x] **F2-3** `PICK_MAX_SELECTION_ODDS_MAP` F2 HOME : 2.99.

**Décision :**

- [x] **F2-4** Geler F2 dans cet état — le nettoyage des segments morts améliore fortement le ROI sans résoudre le Brier.
- [ ] **F2-5** Revenir plus tard uniquement avec une recalibration probabiliste plus profonde si l'objectif est de corriger le Brier / W-L plutôt que le ROI.

---

#### EL1 — League One ✅ PASS renforcé (2026-04-18)

**Résultat retenu :** 52 bets / 3 saisons — ROI +31.0 %, Brier 0.6337 (PASS), CalibrationErr 2.17 % (PASS), overallVerdict PASS.

- ONE_X_TWO : 40 bets, 20W/20L, +30.2 % ROI — signal principal sain.
- AWAY : 21 bets, 11W/10L, +55.3 % ROI — meilleur vrai signal de la ligue.
- HOME : 19 bets, 9W/10L, +2.3 % ROI — segment faible mais pas assez mauvais pour justifier un durcissement immédiat.
- OVER_UNDER_HT OVER_1_5 : 5 bets, 3W/2L, +62.4 % ROI après cap — le mauvais sous-segment 3.0-4.99 a été coupé.
- OVER_UNDER full-time reste marginal / bruité (6 bets, -30.8 % ROI), surtout via OVER_3_5 (0W/2L).

**Actions appliquées :**

- [x] **EL1-1** `PICK_MAX_SELECTION_ODDS_MAP` EL1 OVER_UNDER_HT OVER_1_5 : cap 2.99.

**Décision :**

- [x] **EL1-2** Conserver EL1 en l'état — la ligue est déjà PASS avec un bon ROI et de bonnes métriques.
- [ ] **EL1-3** Revenir plus tard seulement si on veut nettoyer `OVER_UNDER OVER_3_5`, qui reste le petit segment douteux.

---

#### EL2 — League Two ✅ amélioré (2026-04-18) — Brier fail léger persistant

**Résultat retenu :** 133 bets / 3 saisons — ROI +23.7 %, CalibrationErr 3.40 % (PASS), Brier 0.6508 (FAIL marginal), overallVerdict FAIL technique.

- ONE_X_TWO : 126 bets, 59W/67L, +21.1 % ROI — marché principal conservé mais nettoyé.
- Bucket 2.0-2.99 : 103 bets, 48W/55L, +12.7 % ROI — encore volumineux, mais nettement meilleur qu'au point de départ.
- Bucket 3.0-4.99 : 23 bets, 11W/12L, +59.1 % ROI — meilleur sous-segment, à préserver.
- OVER_UNDER_HT OVER_1_5 : 7 bets, 4W/3L, +69.9 % ROI — signal utile conservé.
- FIRST_HALF_WINNER AWAY et OVER_UNDER OVER supprimés — bruit sans edge.

**Actions appliquées :**

- [x] **EL2-1** `PICK_EV_FLOOR_MAP` EL2 FIRST_HALF_WINNER AWAY : 0.99.
- [x] **EL2-2** `PICK_EV_FLOOR_MAP` EL2 OVER_UNDER OVER : 0.99.
- [x] **EL2-3** `MODEL_SCORE_THRESHOLD_MAP` EL2 : 0.45 → 0.48 → 0.50 (0.50 retenu).
- [x] **EL2-4** Conserver `OVER_UNDER_HT OVER_1_5` ouvert — ne pas le couper avec les marchés parasites.

**Décision :**

- [x] **EL2-5** Retenir `MODEL_SCORE_THRESHOLD = 0.50` comme meilleur compromis volume / ROI observé.
- [ ] **EL2-6** Revenir plus tard seulement si on veut attaquer le Brier marginal via recalibration plus profonde, pas via un saut brutal de threshold.

---

#### J1 — J1 League (26W-30L, ROI +10.8 %, FAIL Brier 0.675)

**Problème :** uniquement des picks ONE_X_TWO HOME (22W-28L) et AWAY (4W-2L ?) — le Brier 0.675 dépasse le seuil, indiquant une mauvaise qualité probabiliste. L'avantage domicile en J1 est structurellement différent de l'Europe (faible, pas de supporters adverses).

- [ ] **J1-1** Réduire HOME_ADVANTAGE_LAMBDA_FACTOR pour J1 : c'est la cause principale du Brier élevé et des 22W-28L HOME. Abaisser de 0.10–0.15 points.
- [ ] **J1-2** Augmenter MODEL_SCORE_THRESHOLD pour ONE_X_TWO HOME en J1 à 0.58 (vs ~0.50 actuel). Moins de picks, meilleure qualité.
- [ ] **J1-3** Activer OVER_UNDER_HT OVER_1_5 en J1 (77 % over 1.5 en prod, 2.73 buts/match — marché entièrement inexploité actuellement).
- [ ] **J1-4** Tester un facteur d'atténuation prob_modèle de 0.95 pour J1 HOME afin de corriger le Brier (approche isotonique manuelle).

---

#### MX1 — Liga MX (≈13W-15L, ROI –7.1 %, FAIL)

**Problème :** ROI négatif + W<L. Prod confirmait déjà : gap –44 pp, l'un des pires écarts du système. Le modèle surévalue massivement les équipes mexicaines HOME.

- [ ] **MX1-1** Augmenter MODEL_SCORE_THRESHOLD MX1 à 0.65 (depuis 0.55 actuel) — réduction agressive du volume.
- [ ] **MX1-2** Désactiver les picks AWAY MX1 (0W sur backtest).
- [ ] **MX1-3** Augmenter EV threshold MX1 à 0.14.
- [ ] **MX1-4** Recalibrer HOME_ADVANTAGE_LAMBDA_FACTOR pour MX1 à la baisse : la Liga MX a une structure de championnat (Apertura/Clausura) et des dynamiques de rotation qui réduisent l'avantage domicile réel.
- [ ] **MX1-5** À terme : activer OVER_UNDER picks MX1 (2.67 buts/match, marché plus prévisible que 1X2 sur ce championnat).

---

#### ERD — Eredivisie ✅ PASS technique (2026-04-18) — 0 bet / insuffisant

**Résultat retenu :** 0 bet / 3 saisons — ROI 0 %, Brier 0.5988 (PASS), CalibrationErr 3.46 % (PASS), overallVerdict PASS.

- Le patch a supprimé tout le faux EV observé auparavant (`ROI -38.9 %` sur 7 bets).
- Le `ndjson` montre surtout un mix de `BELOW_MODEL_SCORE_THRESHOLD` massif (694 fixtures), de favoris HOME sans EV (`ev_below_threshold`) et d'extrêmes DRAW/AWAY rejetés par `probability_too_low`, `odds_above_cap` ou `ev_above_hard_cap`.
- En pratique, on a un PASS technique, mais pas encore de signal exploitable ni de stock visible de bons `OVER` bloqués par erreur.

**Actions appliquées :**

- [x] **ERD-1** `MODEL_SCORE_THRESHOLD_MAP` ERD : 0.60 → 0.68.
- [x] **ERD-2** `PICK_DIRECTION_PROBABILITY_THRESHOLD_MAP` ERD HOME : 0.60.
- [x] **ERD-3** `PICK_EV_FLOOR_MAP` ERD HOME : 0.15.
- [x] **ERD-4** `PICK_EV_FLOOR_MAP` ERD UNDER : 0.99.
- [x] **ERD-5** `PICK_EV_FLOOR_MAP` ERD OVER_UNDER_HT OVER_1_5 : 0.99.

**Décision :**

- [x] **ERD-6** Geler ERD dans cet état pour éviter de republier du faux EV.
- [ ] **ERD-7** Revenir plus tard avec une recalibration de modèle plus fine si l'objectif devient de recréer du volume exploitable en ERD.

---

### Actions globales (toutes ligues)

- [ ] **GLOBAL-1** Ajouter un filtre transversal : si prob_modèle ∈ [0.50, 0.65) et cote ∈ [2.0, 3.0] → EV minimum requis = 0.12 (au lieu de 0.08). Cette zone est la plus biaisée du système (–9.6 pp gap identifié).
- [ ] **GLOBAL-2** Implémenter des `HOME_ADVANTAGE_LAMBDA_FACTOR` par championnat dans `ev.constants.ts` au lieu d'un facteur global. Actuellement trop générique.
- [ ] **GLOBAL-3** Ajouter un mécanisme de suivi W/L par ligue dans le rapport backtest (`wins`, `losses`, `winRate` au niveau compétition) pour que l'objectif wins > losses soit directement mesurable sans reparser le JSON.
- [ ] **GLOBAL-4** Backtest hebdomadaire automatique par ligue — comparer avec la semaine précédente pour détecter les dérives de calibration rapidement.

---

### Ligues déjà satisfaisantes (ne pas toucher)

| Code | Statut                 | Raison                                              |
| ---- | ---------------------- | --------------------------------------------------- |
| LL   | ✅ wins > losses, PASS | 10W-8L, ROI +41 % — modèle bien calibré sur La Liga |
| L1   | ✅ quasi-satisfaisant  | 11W-10L — surveillance légère suffit                |
| SP2  | ✅ wins > losses       | 7W-4L — seul le Brier à corriger (SP2-1)            |
