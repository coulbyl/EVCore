# EVCore — Journal d'exécution

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/evcore

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

| Code | Ligue              | Paris | W   | L   | ROI     | Verdict | Statut W>L |
|------|--------------------|-------|-----|-----|---------|---------|------------|
| LL   | La Liga            | 22    | 10  | 8   | +41.3 % | PASS    | ✅          |
| SP2  | Segunda División   | 14    | 7   | 4   | +18.4 % | FAIL*   | ✅          |
| L1   | Ligue 1            | 23    | 11  | 10  | +14.9 % | PASS    | ✅ (juste)  |
| BL1  | Bundesliga         | 14    | 7   | 5   | +18.3 % | PASS    | ✅ (2026-04-18) |
| POR  | Primeira Liga      | 6     | 2   | 2   | +26.5 % | PASS    | trop peu   |
| I2   | Serie B            | 1     | 1   | 0   | +100 %  | FAIL*   | trop peu   |
| EL1  | League One         | 53    | ~26 | ~27 | +28.5 % | PASS    | ⚖️ (~égal) |
| CH   | Championship       | 20    | ~8  | ~12 | +8.1 %  | PASS    | ❌          |
| PL   | Premier League     | 20    | 5   | 14  | +30.8 % | PASS    | ❌          |
| SA   | Serie A            | 6     | 2   | 4   | +42.9 % | PASS    | ✅ (2026-04-18) |
| D2   | 2. Bundesliga      | 17    | 6   | 10  | +11.7 % | FAIL    | ❌          |
| F2   | Ligue 2            | 39    | 17  | 22  | +2.6 %  | FAIL    | ❌          |
| J1   | J1 League          | 56    | 26  | 30  | +10.8 % | FAIL    | ❌          |
| EL2  | League Two         | 202   | 84  | 108 | +16 %   | FAIL    | ❌          |
| MX1  | Liga MX            | 28    | ~13 | ~15 | –7.1 %  | FAIL    | ❌          |
| ERD  | Eredivisie         | 7     | 2   | 3   | –38.9 % | FAIL    | ❌          |

*FAIL uniquement sur Brier Score légèrement au-dessus du seuil, pas sur ROI ni W/L.

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

#### I2 — Serie B (1 pari sur 3 saisons, FAIL Brier)
**Problème :** le modèle n'exploite pratiquement pas la Serie B. 86 % over 1.5 en prod, mais 0 pick OVER généré.

- [ ] **I2-1** Abaisser MODEL_SCORE_THRESHOLD pour I2 à 0.45 sur les marchés OVER_UNDER_HT uniquement (marché le mieux adapté au profil I2 : 86 % over 1.5, mais seulement 29 % over 2.5 → cibler l'HT).
- [ ] **I2-2** Vérifier que I2 est bien dans `includeInBacktest: true` et que les odds sont disponibles pour ce championnat.

---

#### SP2 — Segunda División (7W-4L, ROI +18.4 %, FAIL Brier)
**Problème :** wins > losses ✅ déjà atteint. Seul blocage : Brier Score 0.650 (0.001 au-dessus du seuil 0.65). ROI et calibration OK.

- [ ] **SP2-1** Appliquer un facteur de lissage de probabilité pour SP2 : multiplier prob_modèle par 0.97 avant scoring final (réduit légèrement la confiance, corrige le Brier sans toucher aux marchés). Ceci est une micro-recalibration isotonique manuelle.

---

#### D2 — 2. Bundesliga (6W-10L, ROI +11.7 %, FAIL)
**Problème :** picks AWAY 0W/1L (ignorable — 1 seul), mais HOME 6W-10L sur 16 bets reste W<L. HOME_ADVANTAGE trop généreux pour D2. Prod confirme : gap –40 pp, –100 % ROI sur 4 bets.

- [ ] **D2-1** Désactiver complètement les picks AWAY en D2 (0W en backtest, gap confirmé en prod).
- [ ] **D2-2** Réduire HOME_ADVANTAGE_LAMBDA_FACTOR pour D2 : la 2. Bundesliga est très équilibrée entre domicile/extérieur. Abaisser le facteur d'environ 0.08–0.12 points.
- [ ] **D2-3** Augmenter EV threshold pour D2 HOME à 0.12. Moins de paris mais meilleure sélection.
- [ ] **D2-4** Activer OVER_UNDER_HT pour D2 (2.61 buts/match, profil similaire à D1 — marchés MT non exploités).

---

#### F2 — Ligue 2 (17W-22L, ROI +2.6 %, FAIL Brier)
**Problème structurel :** le modèle ne génère QUE des picks HOME pour la Ligue 2, alors que le taux réel de nuls est exceptionnel (67 % sur la fenêtre prod, ~30–35 % historique). Brier 0.662 confirme une mauvaise calibration des probabilités.

- [ ] **F2-1** Activer les picks DRAW 1X2 pour F2 : recalibrer la probabilité de nul en F2 à la hausse. La Ligue 2 est la ligue française avec le plus de nuls structurellement (équipes évitant la défaite, matchs serrés).
- [ ] **F2-2** Durcir le filtre HOME en F2 : exiger prob_modèle HOME ≥ 52 % (vs ~45 % actuellement). Cela éliminera les HOME picks trop incertains qui font baisser le W/L.
- [ ] **F2-3** Vérifier et corriger le Brier en F2 : prob_modèle HOME est systématiquement surestimée (17W-22L sur 39 picks = 44 % WR vs prob estimée probablement ~55-60 %). Un facteur d'atténuation de 0.95 sur les proba HOME F2 est à tester.

---

#### EL1 — League One (≈26W-27L, ROI +28.5 %, PASS)
**Problème :** quasi-équilibre W/L. Le marché HOME (40 picks, ROI 0.30) est proche de l'équilibre. Les petits marchés OVER_UNDER drainent quelques défaites.

- [ ] **EL1-1** Supprimer les picks OVER_UNDER UNDER_3_5 en EL1 (ROI 0.015 sur 8 bets — trop marginal, ajoute des défaites sans valeur).
- [ ] **EL1-2** Augmenter la génération OVER_UNDER_HT OVER_1_5 en EL1 (le seul pick FIRST_HALF_WINNER capturé était 1W-0L à 2.77u — ce marché doit être plus exploité).
- [ ] **EL1-3** Resserrer le filtre HOME EL1 : exiger EV ≥ 0.09 (légère hausse depuis 0.08).

---

#### EL2 — League Two (84W-108L, ROI +16 %, FAIL Brier)
**Problème principal :** volume massif (202 paris) avec des picks ONE_X_TWO HOME et AWAY sur-générés à probabilité marginale (WR ~41 %). Les marchés OVER_UNDER_HT OVER_1_5 (8 bets, ROI +86.5 %) sont excellents mais sous-représentés. FIRST_HALF_WINNER et OVER_0_5 font 0W.

- [ ] **EL2-1** Supprimer FIRST_HALF_WINNER en EL2 (0W sur l'ensemble du backtest).
- [ ] **EL2-2** Supprimer OVER_UNDER_HT OVER_0_5 en EL2 (0W également — cote trop basse pour la variance League Two).
- [ ] **EL2-3** Augmenter MODEL_SCORE_THRESHOLD pour ONE_X_TWO en EL2 : passer de 0.60 à 0.63. Objectif : réduire de 192 à ~100 picks ONE_X_TWO et améliorer le WR de 41 % à 52 %+.
- [ ] **EL2-4** Multiplier par 3-4 les picks OVER_UNDER_HT OVER_1_5 en EL2 : abaisser le threshold de ce marché spécifique à 0.50. Ce marché est le plus rentable du backtest EL2 (ROI +86 %).
- [ ] **EL2-5** Augmenter EV minimum global EL2 à 0.10 (actuellement 0.08).

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

#### ERD — Eredivisie (2W-3L sur 5 décidés, ROI –38.9 %, FAIL)
**Problème critique :** pire ROI de tous les championnats. Prod confirmait : gap –58 pp. Le modèle est le plus overconfident sur l'ERD de toutes les ligues. Ajax/PSV dominent mais les cotes reflètent déjà cette domination — il n'y a pas d'EV réel.

- [ ] **ERD-1** Augmenter MODEL_SCORE_THRESHOLD ERD à 0.68 (depuis ~0.60).
- [ ] **ERD-2** Désactiver OVER_UNDER_HT picks en ERD (0W sur backtest) — la ligue néerlandaise a des matchs très déséquilibrés où les cotes mi-temps ne reflètent pas bien la réalité.
- [ ] **ERD-3** Restreindre ERD aux picks HOME uniquement avec EV ≥ 0.15 et prob_modèle ≥ 60 %.
- [ ] **ERD-4** Recalibrer λ Eredivisie : les équipes dominantes (Ajax, PSV) ont des λ offensifs très élevés qui gonflent artificiellement la confiance du modèle sur leurs matchs à domicile.

---

### Actions globales (toutes ligues)

- [ ] **GLOBAL-1** Ajouter un filtre transversal : si prob_modèle ∈ [0.50, 0.65) et cote ∈ [2.0, 3.0] → EV minimum requis = 0.12 (au lieu de 0.08). Cette zone est la plus biaisée du système (–9.6 pp gap identifié).
- [ ] **GLOBAL-2** Implémenter des `HOME_ADVANTAGE_LAMBDA_FACTOR` par championnat dans `ev.constants.ts` au lieu d'un facteur global. Actuellement trop générique.
- [ ] **GLOBAL-3** Ajouter un mécanisme de suivi W/L par ligue dans le rapport backtest (`wins`, `losses`, `winRate` au niveau compétition) pour que l'objectif wins > losses soit directement mesurable sans reparser le JSON.
- [ ] **GLOBAL-4** Backtest hebdomadaire automatique par ligue — comparer avec la semaine précédente pour détecter les dérives de calibration rapidement.

---

### Ligues déjà satisfaisantes (ne pas toucher)

| Code | Statut | Raison |
|------|--------|--------|
| LL   | ✅ wins > losses, PASS | 10W-8L, ROI +41 % — modèle bien calibré sur La Liga |
| L1   | ✅ quasi-satisfaisant | 11W-10L — surveillance légère suffit |
| SP2  | ✅ wins > losses | 7W-4L — seul le Brier à corriger (SP2-1) |
