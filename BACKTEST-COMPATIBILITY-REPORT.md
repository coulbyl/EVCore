# Rapport de Compatibilité & Amélioration — Backtest EVCore

**Date** : 16 mai 2026 | Analyse complète du codebase backtest, moteur de paris et logique par championnat.

---

## Score d'état actuel

| Aspect           | Score | Détail                                                                    |
| ---------------- | ----- | ------------------------------------------------------------------------- |
| Coverage         | 7/10  | 20 ligues fully backtestées, 12 avec données insuffisantes                |
| Calibration      | 6/10  | 6 ligues PASS Brier, 3 FAIL, EV surcalibré au-delà de 75%                 |
| Cohérence config | 5/10  | 40+ règles manuelles, conflits entre seuils, drift saisonnier ignoré      |
| Validation edge  | 6/10  | ROI backtest positif global, mais combos désactivés, cold-start non testé |
| Maintenabilité   | 4/10  | Tuning manuel, pas de walk-forward, pas de monitoring continu             |
| Scalabilité      | 3/10  | Chaque nouvelle ligue = audit manuel + règles custom                      |

**Global : 5.8/10 — MVP viable mais dette technique élevée.**

---

## 1. Ce que backteste le système actuel

### Marchés backtestés

- `ONE_X_TWO`, `OVER_UNDER`, `OVER_UNDER_HT`, `BTTS`, `HALF_TIME_FULL_TIME`, `FIRST_HALF_WINNER`, `DOUBLE_CHANCE`

### Ce qui est absent

- **Combos** — `COMBOS_ENABLED = false` → ~10% du volume prod non validé
- **Learning loop** — boucle d'apprentissage jamais intégrée au backtest
- **Cold-start** — matchdays 1-5 exclus par `MIN_PRIOR_TEAM_STATS=5` mais existants en prod
- **Variation des odds** — snapshot Pinnacle unique, pas de bruit de tick movement
- **Walk-forward validation** — seuils calibrés sur S1-S3 puis figés, jamais testés out-of-sample

---

## 2. Volume de données disponible

| Ligue                                                                         | Fixtures    | xG      | Cotes   | Statut                 |
| ----------------------------------------------------------------------------- | ----------- | ------- | ------- | ---------------------- |
| BL1, EL2, L1, I2, MX1, POR, CH, D2, LL, PL, SA, SP2, F2, ERD, TUR1, MLS, POL1 | 900-1700    | 98-100% | 98-100% | ✅ Complet             |
| J1                                                                            | 1246        | 100%    | 91%     | ✅ 4 saisons           |
| SUI1                                                                          | 688         | 100%    | 97%     | ✅ Complet             |
| NOR1, SWE1                                                                    | 748         | 100%    | 60-80%  | ⚠️ Cotes partielles    |
| TUR2                                                                          | 1080        | 98%     | 0.4%    | ❌ Cotes manquantes    |
| UCL                                                                           | 773         | 86%     | 46%     | ⚠️ xG et cotes faibles |
| UECL                                                                          | 1234        | 68%     | 28%     | ⚠️ xG insuffisant      |
| CZE1, SRB1                                                                    | ~900        | 99%     | 0%      | ❌ Pas de cotes        |
| FRI                                                                           | 220         | 26%     | 18%     | ❌ xG inutilisable     |
| **Total**                                                                     | **~31 600** |         |         |                        |

---

## 3. Résultats Brier par ligue (derniers backtests connus)

| Ligue                      | Brier  | Seuil | Verdict                     |
| -------------------------- | ------ | ----- | --------------------------- |
| BL1                        | 0.6509 | 0.655 | ✅ PASS                     |
| D2                         | 0.651  | 0.655 | ✅ PASS                     |
| EL2                        | 0.6506 | 0.655 | ✅ PASS                     |
| I2                         | 0.655  | 0.66  | ✅ PASS (marge 0.005)       |
| SUI1                       | 0.6503 | 0.65  | ❌ FAIL (S2 à 0.6599)       |
| UEL                        | 0.659  | 0.65  | ❌ FAIL (over-predict HOME) |
| J1                         | 0.6741 | 0.67  | ❌ FAIL (cold-start S4)     |
| PL, SA, LL, L1, SP2, CH... | ?      | 0.65  | ❓ Pas de rapport récent    |

---

## 4. Performance live canal (avril–mai 2026)

**Source** : `signal-analysis-2026-04-01_2026-05-10.txt` — 582 picks sur 1511 fixtures

| Canal    | Picks | HR%       | Signal          |
| -------- | ----- | --------- | --------------- |
| **EV**   | 302   | **36.2%** | ❌ Sous-calibré |
| **SV**   | 134   | **74.4%** | ✅ Fort         |
| **BB**   | 53    | 61.5%     | ✅ Stable       |
| **CONF** | 88    | 65.9%     | ✅ Bon          |
| **NUL**  | 5     | 20.0%     | ❌ Très faible  |

**Calibration EV — zones problématiques** :

- 75-80% confidence → 36.4% réalisé (-41pp) → overconfidence catastrophique
- 50-55% → 41.7% réalisé (-11pp) → sous-réalisé
- 55-60% → 58.6% réalisé → seule zone calibrée

---

## 5. Problèmes de configuration identifiés

### 5.1 Explosion des règles manuelles

`ev.constants.ts` — 1122 lignes, 40+ maps customs :

- `LEAGUE_MEAN_LAMBDA_MAP` — ancres xG par ligue
- `LEAGUE_HOME_ADVANTAGE_MAP` — facteurs HA/Away
- `THREE_WAY_EMPIRICAL_BLEND_WEIGHT_MAP` — blend Poisson vs empirique
- `MODEL_SCORE_THRESHOLD_MAP` — seuil d'entrée par ligue
- `PICK_EV_FLOOR_MAP` — EV min par (ligue, marché, pick)
- `PICK_MIN_SELECTION_ODDS` / `PICK_MAX_SELECTION_ODDS` — par tuple
- `PICK_DIRECTION_PROBABILITY_THRESHOLD_MAP` — 139 lignes
- `LEAGUE_EV_THRESHOLD_MAP` — override global par ligue

Résultat : 40+ règles calibrées sur 3-50 bets chacune, sans validation statistique, sans walk-forward.

### 5.2 Conflits détectés

| Conflit                              | Description                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| ERD threshold vs floor               | MODEL_SCORE_THRESHOLD=0.55 mais max observé=0.679 → EV_FLOOR=0.15 ne débloque rien              |
| I2 double-correction                 | HA=1.0/1.0 + blend 0.45 vers empirique, mais empirique porte déjà un HA implicite               |
| LEAGUE_EV_THRESHOLD vs PICK_EV_FLOOR | FRI=0.15 (global) + EL1\|AWAY=0.18 (pick) → pool toujours sous le floor                         |
| CONF/DRAW sémantique                 | DRAW threshold = 1/drawOdds (probabilité implicite), pas un hit rate — nommage confus           |
| OVER/UNDER désactivé                 | D2, EL1, ERD, MX1 : UNDER_3_5 EV floor = 0.99 → effectivement désactivé mais sans documentation |

### 5.3 Architecture des features figée

- Poids `{form: 30%, xG: 30%, domExt: 25%, volatilité: 15%}` identiques pour toutes les ligues
- SA (tactique, bas scoring) et BL1 (haut scoring) ont les mêmes poids → sous-optimal
- Indépendance Poisson → miscalibration des OVER/UNDER à λ élevé (ERD, BL1, MLS)

---

## 6. Ligues sans backtest recent

Ces ligues ont des données complètes mais aucun rapport Brier communiqué depuis le lancement Phase 2 :

**PL, SA, LL, L1, SP2, CH, POR, MX1, MLS, ERD, TUR1, SWE1, NOR1, POL1**

→ On ne sait pas si ces ligues PASS ou FAIL le backtest actuellement.

---

## 7. Durée de backtest — Recommandation

### Question : combien d'années ?

**Fenêtre recommandée : 3 saisons glissantes récentes (pas fixes)**

| Saison  | Statut                      | Raison                                      |
| ------- | --------------------------- | ------------------------------------------- |
| 2019-20 | ❌ Exclure                  | COVID — arrêt de saison mi-chemin           |
| 2020-21 | ❌ Exclure                  | Huis clos complets — stats dom/ext faussées |
| 2021-22 | ⚠️ Optionnel                | Semi-retour public, légèrement bruité       |
| 2022-23 | ✅ Inclure                  | Saison normale, données propres             |
| 2023-24 | ✅ Inclure                  | Saison normale                              |
| 2024-25 | ✅ Inclure                  | Saison normale                              |
| 2025-26 | 🔬 Validation out-of-sample | Ne jamais calibrer dessus                   |

**Principe** : toujours garder la saison en cours comme validation out-of-sample. Ne jamais entraîner et valider sur le même dataset.

**Walk-forward manquant** (critique) : les seuils sont calibrés sur S1-S2 et testés sur S3 — mais jamais inversé. Une validation S1 train / S2+S3 test révèlerait si les règles généralisent ou s'overfittent.

---

## 8. Améliorations prioritaires

### P1 — Bloquants majeurs (1-2 mois)

#### P1.1 Grid Search systématique des seuils

Remplacer les 40+ règles manuelles par une grid search par (ligue, marché, pick) :

- Test `[EV_floor, EV_cap, odds_floor, odds_cap]` sur 3 saisons
- Retenir la config maximisant ROI avec Brier < seuil et volume > 10 bets/saison
- Walk-forward validation : S1+S2 train → S3 test

#### P1.2 Intégrer le Learning Loop dans le backtest

- Simuler la boucle d'apprentissage : @fixture N, si 50+ bets settled, proposer adjustment
- Comparer ROI pre vs post adjustment
- Vérifier si la boucle converge ou introduit de l'instabilité

#### P1.3 Activer et backtester les Combos

- Ajouter `Market.COMBO` dans le rapport backtest
- Comparer combo ROI vs single-leg équivalent
- Si combo ROI < single-leg : confirmer la désactivation et documenter pourquoi

### P2 — Calibration (2-3 mois)

#### P2.1 Per-Season Model Retuning

- Flaguer les saisons où Brier >> moyenne comme "low-confidence"
- Option A : relax MODEL_SCORE_THRESHOLD -0.05 pour ces saisons
- Option B : raise EV_THRESHOLD +0.05 pour compenser
- Test empirique par ligue

#### P2.2 Résoudre J1 & I2

- J1 : grid search blend [0.45-0.55] + HA [1.0-1.05]
- I2 : revoir lambda 0.95 → [0.90-1.00] + blend [0.40-0.50]
- Contrainte : >50 bets/saison minimum

#### P2.3 Étendre UCL/UEL/UECL

- Importer 3 saisons supplémentaires (back to 2020-21)
- Grid search `EUROPEAN_CROSS_COMP_FORM_WEIGHT` [0.4-0.7]
- Compléter xG manquant via proxy shots × 0.35

### P3 — Robustesse (3-4 mois)

#### P3.1 Backtest Cold-Start

- Subset "fixtures [1-10] de chaque saison"
- Si cold-start ROI < saison avg -10% → "season_open_risk_warning"
- Seuils +0.05 MODEL_SCORE les 3 premières semaines ?

#### P3.2 Backtest avec odds bruitées ±2%

- Générer 100 variantes aléatoires ±2% sur les cotes
- Si ROI dégrade >20% → EV brittle → raise EV_THRESHOLD +0.05
- Documente : "EV robustness: ROBUST | BRITTLE"

#### P3.3 Brier Score par bucket d'odds

- Ajouter `brierScoreByOddsBucket` dans CompetitionBacktestReport
- Flag automatique si bucket Brier > seuil + 0.05
- Réduire le cap de sélection pour ce bucket au prochain backtest

### P4 — Scaling (4+ mois)

#### P4.1 Auto-tuning des canaux CONF/DRAW/BTTS

- Scanner automatique thresholds dans backtest
- Output : `{ enabled, threshold, hit_rate, coverage }` par (ligue, canal)
- Supprimer le tuning manuel, scale vers nouvelles ligues automatiquement

#### P4.2 Daily Monitoring Dashboard

- Rolling 7-day Brier/ROI/ECE par ligue
- Alerte si rolling Brier diverge >0.05 du backtest
- Signal early de concept drift

#### P4.3 Documentation des seuils (`THRESHOLDS_BY_LEAGUE.md`)

- Extract auto des 40+ règles depuis `ev.constants.ts`
- Format : ligue | métrique | seuil | raison | date audit | statut

---

## 9. Risques majeurs

| Risque                               | Probabilité         | Impact                 | Mitigation              |
| ------------------------------------ | ------------------- | ---------------------- | ----------------------- |
| EV surcalibré (75%+ proba)           | Haute               | Pertes investisseurs   | P2.1 re-tuning immédiat |
| Compétitions européennes peu fiables | Moyenne             | 10-15% volume à risque | P2.3 data expansion     |
| Cold-start non validé                | Basse               | Pertes début de saison | P3.1 backtest dédié     |
| Learning loop inefficace             | Basse mais critique | Produit core cassé     | P1.2 valider ASAP       |

---

## 10. Livrables immédiats (avant fin mai 2026)

- [ ] Lancer backtest complet sur PL, SA, LL, L1, SP2, CH pour avoir les Brier manquants
- [ ] Implémenter P3.3 (Brier par bucket d'odds) — 1 sprint
- [ ] Générer `THRESHOLDS_BY_LEAGUE.md` auto-documenté (P4.3) — 1 sprint
- [ ] Alerter sur le canal EV : HR live 36.2% vs attente ~50% — mesure intérimaire
- [ ] Flaguer les picks early-season comme "risque élevé" en attendant P3.1
