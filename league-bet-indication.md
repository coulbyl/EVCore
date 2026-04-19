# EVCore — Guide de sélection des picks par ligue

> Document de référence pour interpréter les picks générés par le moteur.
> Mis à jour : 2026-04-19 — basé sur le backtest 3 saisons (2022-25) + données The Odds API.
>
> **Lecture rapide :** 🟢 = prendre si le modèle propose | 🔴 = ignorer même si EV positif | ⚠️ = prudence, volume insuffisant

---

## Règles globales (s'appliquent à toutes les ligues)

| Paramètre           | Valeur           | Pourquoi                                      |
| ------------------- | ---------------- | --------------------------------------------- |
| EV minimum          | 0.08             | Seuil de base contre Pinnacle                 |
| EV hard cap         | 0.90             | EV > 0.90 = anomalie modèle, pas un vrai edge |
| Cotes globales      | 2.00–4.00        | Par défaut — overrides par ligue ci-dessous   |
| Quality score min   | 0.06             | Filtre EV × score × longshotPenalty           |
| Under 2.5 à λ élevé | EV ≥ 0.20 requis | Poisson surestime P(under) à haut scoring     |

**Ne jamais prendre un pick qui déclenche `ev_above_hard_cap`** — c'est une erreur de calibration, pas de la valeur.

---

## Premier League (PL) ✅ PASS — +69.9% ROI, 114 bets (baseline propre sans combos, 2026-04-19)

**Profil :** ligue efficiente, signaux uniquement sur longshots. DRAW [5-8] est le moteur principal. AWAY fonctionne sur toute la fenêtre [3-7], pas seulement au-dessus de 5.

| Pick                          | Cotes window  | ROI backtest         | Statut                               |
| ----------------------------- | ------------- | -------------------- | ------------------------------------ |
| 🟢 ONE_X_TWO DRAW             | **5.00–7.99** | **+83.8%** (74 bets) | Driver principal — 22W/52L           |
| 🟢 ONE_X_TWO AWAY             | **3.00–6.99** | **+61.8%** (24 bets) | Valide sur toute la fenêtre — 9W/15L |
| 🟢 BTTS YES                   | 2.00–2.99     | +16.6% (12 bets)     | Sain — 6W/6L                         |
| ⚠️ OVER_UNDER_HT OVER_1_5     | 2.00–2.99     | +62% (3 bets)        | INSUFFICIENT_DATA                    |
| 🔴 ONE_X_TWO DRAW             | ≥8.00         | -100% (anciens)      | Stop net — cap 7.99 actif            |
| 🔴 ONE_X_TWO AWAY             | ≥7.00         | cassé                | Cap 6.99 actif                       |
| 🔴 BTTS NO                    | toutes        | -34% (anciens)       | Éliminé floor 0.99                   |
| 🔴 FIRST_HALF_WINNER (toutes) | —             | -22% (anciens)       | Éliminé floor 0.99                   |

> **Lecture PL :** DRAW [5-8] est le signal dominant (74 bets sur 114). AWAY [3-7] est profitable sur toute la fenêtre — le [3-5] représente 17/24 bets à +33.4%. BTTS YES est un signal faible mais positif. HOME n'apparaît plus (floor 3.0 + cap EV).

---

## Ligue 1 (L1) ✅ PASS — +31.9% ROI (25 bets, baseline propre sans combos, 2026-04-19)

**Profil :** calibration globale saine (`Brier PASS`, `Calibration PASS`), mais la sélection devait être nettoyée. Après suppression des marchés secondaires toxiques, il reste deux branches lisibles : `ONE_X_TWO HOME` à cotes moyennes et `BTTS YES` avec floor relevé à `2.10`.

| Pick                      | Cotes window  | ROI backtest                 | Statut                               |
| ------------------------- | ------------- | ---------------------------- | ------------------------------------ |
| 🟢 ONE_X_TWO HOME         | **2.00–2.99** | **+46.8%** (18 bets, 11W/7L) | Signal principal retenu              |
| 🟢 BTTS YES               | **2.10–2.99** | **+9.2%** (6 bets, 3W/3L)    | Signal secondaire léger mais positif |
| 🔴 ONE_X_TWO HOME         | **≥3.00**     | 0W/1L                        | Cap 2.99 actif                       |
| 🔴 ONE_X_TWO DRAW         | toutes        | 0W/1L                        | Inactif                              |
| 🔴 BTTS NO                | toutes        | 2W/6L, ROI -23.8%            | Éliminé                              |
| 🔴 FIRST_HALF_WINNER      | toutes        | 5W/20L, ROI -25.1%           | Éliminé                              |
| 🔴 OVER_UNDER             | toutes        | négatif                      | Éliminé                              |
| 🔴 OVER_UNDER_HT OVER_1_5 | toutes        | 0W/2L                        | Éliminé                              |

> **Lecture L1 :** le coeur de la ligue est `ONE_X_TWO HOME` en `2.0-2.99`. `BTTS YES` reste jouable, mais uniquement au-dessus de `2.10` ; le sous-bucket `2.00-2.09` faisait `0W/2L` et a été retiré.

---

## Segunda División (SP2) ⚠️ Brier marginal FAIL — +27.8% ROI (32 bets, baseline propre sans combos, 2026-04-19)

**Profil :** ligue équilibrée à 22 équipes. Deux signaux propres : HOME favoris francs [<2.0] + OVER 2.5 à cotes courtes. Brier FAIL marginal (0.6501 vs 0.65) persistant malgré tests sur le shrinkage lambda et le home advantage. La sélection est validée, mais la calibration globale reste légèrement au-dessus du seuil.

| Pick               | Cotes window  | ROI backtest                 | Statut                                             |
| ------------------ | ------------- | ---------------------------- | -------------------------------------------------- |
| 🟢 ONE_X_TWO HOME  | **1.50–1.99** | **+34.1%** (12 bets, 9W/3L)  | Signal principal — meilleur hit rate de la ligue   |
| 🟢 OVER_UNDER OVER | **2.00–2.99** | **+19.9%** (19 bets, 11W/8L) | Signal secondaire — volume utile, toujours positif |
| ⚠️ BTTS YES        | 2.00–2.99     | 1 bet, 1W                    | INSUFFICIENT_DATA                                  |
| 🔴 ONE_X_TWO HOME  | ≥2.00         | instable                     | Hors fenêtre                                       |
| 🔴 ONE_X_TWO AWAY  | toutes        | éliminé                      | Branche toxique supprimée                          |
| 🔴 ONE_X_TWO DRAW  | toutes        | —                            | Inactif                                            |

> **Lecture SP2 :** HOME [<2.0] est le signal principal retenu. OVER 2.5 [2.0-2.99] complète utilement le volume sans ouvrir les cotes courtes <2.0, qui dégradent le ROI. L’élimination de `ONE_X_TWO AWAY` améliore le profil win/loss global.
>
> **Brier FAIL :** marginal (0.0001 au-dessus du seuil) mais non corrigé par les leviers globaux testés (`LEAGUE_MEAN_LAMBDA_MAP`, `LEAGUE_HOME_ADVANTAGE_MAP`). Le statut retenu est donc : sélection exploitable, calibration globale légèrement au-dessus du seuil.

---

## Bundesliga (BL1) ✅ PASS — +23.4% ROI (87 bets, baseline propre sans combos, 2026-04-19)

**Profil :** ligue à haut scoring (3.39 buts/match). Signaux : BTTS (YES + NO à cote longue) et FHW AWAY. Le 1X2 est inactif sur les singles — aucun HOME single ne passe le floor 5.0, aucun AWAY single ne passe le cap 2.99.

| Pick                      | Cotes window | ROI backtest         | Statut                                               |
| ------------------------- | ------------ | -------------------- | ---------------------------------------------------- |
| 🟢 BTTS YES               | 2.00–2.99    | **+48.1%** (10 bets) | Signal principal — 7W/3L                             |
| 🟢 BTTS NO                | 3.00–4.99    | **+68.1%** (8 bets)  | Floor 3.0 actif — 4W/4L, avg 3.30                    |
| 🟢 FIRST_HALF_WINNER AWAY | 3.00–4.99    | **+21.9%** (27 bets) | Signal secondaire validé                             |
| ⚠️ FIRST_HALF_WINNER DRAW | 3.00–4.99    | **-4.9%** (29 bets)  | Borderline -5% — variance (S1 +5%, S2 -19%, S3 +13%) |
| ⚠️ OVER_UNDER OVER 2.5    | 2.00–2.99    | +21% (7 bets)        | INSUFFICIENT_DATA — tendance positive                |
| ⚠️ OVER_UNDER_HT OVER_1_5 | 2.00–2.99    | +43.2% (5 bets)      | INSUFFICIENT_DATA — signal prometteur                |
| 🔴 BTTS NO                | 2.00–2.99    | toxique estimé       | Floor 3.00 actif                                     |
| 🔴 FIRST_HALF_WINNER HOME | toutes       | **-71.6%**           | Éliminé floor 0.99                                   |
| 🔴 ONE_X_TWO              | toutes       | 1 bet total          | Inactif en singles — floor HOME ≥5.0, cap AWAY ≤2.99 |

> **Lecture BL1 :** BTTS YES (short) + BTTS NO (long) + FHW AWAY sont les trois picks à jouer. ONE_X_TWO est structurellement inactif sur les singles en BL1 — les bets HOME "longshots" qui apparaissaient avant étaient des combos (désactivés). FHW DRAW est à surveiller mais la variance inter-saison ne justifie pas encore l'élimination.

---

## Serie A (SA) ✅ PASS — +59.4% ROI (39 bets, baseline propre sans combos, 2026-04-19)

**Profil :** ligue tactique, lambda faible (1.247, ~2.5 buts/match). Signaux principaux : BTTS YES et FHW DRAW longshots. Le modèle Poisson sous-estime P(draw) aux cotes longues [5.0-6.0] — signal latent non encore actionnable.

| Pick                      | Cotes window  | ROI backtest                  | Statut                                                                        |
| ------------------------- | ------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| 🟢 BTTS YES               | **2.00–2.99** | **+107.7%** (11 bets, 9W/2L)  | Signal principal — cohérent 2 saisons                                         |
| 🟢 FIRST_HALF_WINNER DRAW | **3.00–4.99** | **+77.3%** (7 bets, 4W/3L)    | Signal secondaire — S2 +57% · S3 +104%                                        |
| ⚠️ FIRST_HALF_WINNER HOME | **3.00–4.99** | +40.3% (7 bets, 3W/4L)        | Variance inter-saison (S2 +101%, S3 -5.5%) — surveiller                       |
| ⚠️ BTTS NO                | **2.00–2.99** | +12.7% (9 bets, 5W/4L)        | Borderline — signal faible, ne pas forcer                                     |
| ⚠️ ONE_X_TWO AWAY         | **3.00–3.99** | +10.7% simulé (47 bloqués)    | Bloqué `probability_too_low` — signal marginal, non actionnable sans cap 3.99 |
| 🔴 ONE_X_TWO AWAY         | ≥4.00         | -65.6% (39 bloqués [4.0-5.0]) | Très toxique — `probability_too_low` actif, ne pas lever                      |
| 🔴 FIRST_HALF_WINNER AWAY | ≥4.00         | -62% à -100% ([4.0-7.0])      | Cap actif — ne pas lever                                                      |
| 🔴 ONE_X_TWO DRAW         | 2.00–4.99     | -1.9% à -34%                  | `ev_below_threshold` — EV insuffisant                                         |
| 🔴 ONE_X_TWO HOME         | toutes        | -0.7% à -100%                 | Quasi-inactif — EV insuffisant                                                |

> **Lecture SA :** BTTS YES [2-3] est le driver principal (9W/2L sur 2 saisons). FHW DRAW [3-5] est le signal secondaire le plus fiable. FHW HOME est positif mais instable — prendre si le modèle propose, ne pas chercher à forcer.
>
> **Signal latent DRAW [5.0-6.0] :** le ndjson révèle 43 DRAW [5.0-5.99] bloqués par `ev_below_threshold` avec un ROI simulé de +41.5%. Le modèle Poisson sous-estime P(draw) sur les matchs équilibrés en SA. Non actionnable sans recalibration lambda — à surveiller lors du prochain batch de données.
>
> **AWAY : ne pas toucher.** [4.0+] est structurellement toxique (-65%). [3.0-3.99] est marginal (+10.7%) et nécessiterait un fix bi-clé (baisser probability threshold + ajouter cap 3.99) pour un gain incertain.

---

## 2. Bundesliga (D2) ⚠️ Brier FAIL — +49.7% ROI (12 bets, baseline propre sans combos, 2026-04-19)

**Profil :** ligue équilibrée. Le seul signal propre retenu est `ONE_X_TWO AWAY` à cotes courtes. Les extensions au-dessus de 3.0 ont été testées puis abandonnées, car elles dégradent fortement le ratio wins/losses. Les side markets `UNDER`, `FIRST_HALF_WINNER AWAY` et `OVER_UNDER_HT OVER_1_5` sont coupés.

| Pick                      | Cotes window  | ROI backtest                  | Statut                                 |
| ------------------------- | ------------- | ----------------------------- | -------------------------------------- |
| 🟢 ONE_X_TWO AWAY         | **2.00–2.99** | **+40.1%** (10 bets, 5W/5L)   | Signal principal retenu                |
| ⚠️ ONE_X_TWO DRAW         | 3.95          | 1 bet, 1W                     | INSUFFICIENT_DATA                      |
| 🔴 ONE_X_TWO AWAY         | **≥3.00**     | extension testée puis retirée | Dégrade fortement le ratio wins/losses |
| 🔴 OVER_UNDER UNDER       | toutes        | 0W/2L                         | Éliminé                                |
| 🔴 FIRST_HALF_WINNER AWAY | toutes        | 0W/1L                         | Éliminé                                |
| 🔴 OVER_UNDER_HT OVER_1_5 | toutes        | 0W/1L                         | Éliminé                                |

> **Lecture D2 :** la valeur exploitable est concentrée sur `ONE_X_TWO AWAY` dans la fenêtre `2.0-2.99`. Les essais d’ouverture au-dessus de `3.0` ont immédiatement dégradé le ratio wins/losses, donc le cap `2.99` reste la bonne borne.

---

## Primeira Liga (POR) ✅ PASS — +65.4% ROI (19 bets, baseline propre sans combos, 2026-04-19)

**Profil :** ligue très sélective mais propre. Le levier utile a été double : baisser le `MODEL_SCORE_THRESHOLD` à `0.58` pour laisser entrer plus de fixtures équilibrées, puis ouvrir `ONE_X_TWO DRAW` dans une fenêtre serrée où le ndjson montrait un vrai signal.

| Pick                    | Cotes window  | ROI backtest                | Statut                                   |
| ----------------------- | ------------- | --------------------------- | ---------------------------------------- |
| 🟢 ONE_X_TWO DRAW       | **3.00–4.99** | **+109.7%** (9 bets, 4W/5L) | Signal principal retenu                  |
| 🟢 ONE_X_TWO HOME       | **2.00–2.99** | **+16.1%** (8 bets, 4W/4L)  | Signal secondaire acceptable             |
| ⚠️ OVER_UNDER UNDER     | 3.27          | 1 bet, 1W                   | INSUFFICIENT_DATA                        |
| 🔴 ONE_X_TWO HOME       | **≥3.00**     | 0W/1L                       | Cap 2.99 actif                           |
| 🔴 OVER_UNDER UNDER_1_5 | 3.49          | 0W/1L                       | Bruit, non actionnable                   |
| 🔴 ONE_X_TWO AWAY       | toutes        | rejeté                      | Branches longues toxiques dans le ndjson |

> **Lecture POR :** la vraie valeur est sur `ONE_X_TWO DRAW` dans `3.0-4.99`. `HOME [2.0-2.99]` complète le volume sans être le driver principal. Ne pas rouvrir `HOME >=3.0` ni les branches `AWAY` tant que le ndjson reste aussi mauvais sur les longs shots.

---

## Championship (CH) ✅ PASS — +38.4% ROI (70 bets, baseline propre sans combos, 2026-04-19)

**Profil :** ligue à haut volume de sélection (70 bets sur 3 saisons) avec deux signaux clairs après nettoyage. Le modèle sur-estime massivement P(home HT win) → FHW AWAY/DRAW éliminés. HOME 1X2 floored à 5.00 (biais home-overconfidence). Le signal restant est propre et cohérent sur les deux saisons observées.

| Pick                      | Cotes window  | ROI backtest                  | Statut                                                 |
| ------------------------- | ------------- | ----------------------------- | ------------------------------------------------------ |
| 🟢 FIRST_HALF_WINNER HOME | **2.00–4.99** | **+43.9%** (35 bets, 17W/18L) | Signal principal — cohérent S2 +48.5% et S3 +37.1%     |
| 🟢 BTTS NO                | **2.00–2.99** | **+41.4%** (22 bets, 14W/8L)  | Signal secondaire — cohérent S2 +51.3% et S3 +27.0%    |
| ⚠️ ONE_X_TWO AWAY         | **3.50–4.99** | +77% (2 bets)                 | INSUFFICIENT_DATA — EV moyen 0.805 (anomalie possible) |
| ⚠️ OVER_UNDER UNDER       | **2.00–4.99** | +80% (3 bets)                 | INSUFFICIENT_DATA                                      |
| ⚠️ OVER_UNDER_HT OVER_1_5 | 3.0–4.99      | -21.75% (4 bets)              | INSUFFICIENT_DATA — signal négatif, surveiller         |
| 🔴 FIRST_HALF_WINNER AWAY | —             | -86.8% (22 bets)              | Éliminé floor 0.99 — catastrophique, 1W/21L            |
| 🔴 FIRST_HALF_WINNER DRAW | —             | -19% (7 bets)                 | Éliminé floor 0.99 — négatif cohérent 2 saisons        |
| 🔴 ONE_X_TWO DRAW         | —             | -56.9% (9 bets)               | Éliminé floor 0.99 — 1W/8L                             |
| 🔴 ONE_X_TWO HOME         | ≥5.00         | 0 bets placés                 | Floor 5.00 actif — biais structural sur les longshots  |
| 🔴 BTTS YES               | —             | -100% (4 bets)                | Éliminé floor 0.99 — 0W/4L                             |

> **Lecture CH :** deux signaux complémentaires. `FHW HOME` est le driver principal (35 bets, profitable dans les deux buckets — y compris [3.0-4.99] à +48%). `BTTS NO` est un signal secondaire robuste en court-range [2.0-2.99]. Ne pas prendre de DRAW 1X2 ni de FHW AWAY/DRAW — tous les trois sont structurellement cassés. Si EV AWAY 1X2 dépasse 0.60, vérifier la lambda (anomalie).

---

## Récapitulatif de confiance par ligue

| Ligue   | Statut         | Marchés actifs                                | Action                                                                        |
| ------- | -------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| **PL**  | ✅ +70%        | DRAW [5-8], AWAY [3-7], BTTS YES              | Confiance haute (baseline propre)                                             |
| **L1**  | ✅ +32%        | HOME [2-3], BTTS YES [2.1-3]                  | Confiance haute                                                               |
| **POR** | ✅ +65%        | DRAW [3-5], HOME [2-3]                        | Confiance haute                                                               |
| **SA**  | ✅ +59%        | BTTS YES [2-3], FHW DRAW [3-5]                | Confiance haute (baseline propre)                                             |
| **BL1** | ✅ +23%        | BTTS YES [2-3], BTTS NO [3-5], FHW AWAY [3-5] | Confiance haute (baseline propre)                                             |
| **SP2** | ⚠️ +28%        | HOME [<2.0], OVER [2-3]                       | Sélection exploitable, Brier marginal                                         |
| **CH**  | ✅ +38%        | FHW HOME [2-5], BTTS NO [2-3]                 | Confiance haute (baseline propre)                                             |
| **D2**  | ⚠️ +50%        | AWAY [2-3]                                    | Sélection exploitable, Brier fail                                             |
| **I2**  | ❌ Observation | —                                             | Triple FAIL. Lambda recalibré 1.45→1.1, OVER éliminé. Attendre import S1 odds |

> Les autres ligues ont été retirées de ce récapitulatif tant qu'elles n'ont pas été re-backtestées récemment sur la baseline sans combos.

---

## Comment lire un pick du moteur

1. **Vérifier la ligue** → colonne statut ci-dessus. Si ❌ → ignorer.
2. **Vérifier le marché + direction** → est-il dans la zone 🟢 de la ligue ?
3. **Vérifier la cote** → est-elle dans la fenêtre indiquée ?
4. **Vérifier l'EV** → entre le floor et le hard cap (0.08–0.90 par défaut) ?
5. **Vérifier le deterministicScore** → au-dessus du threshold de la ligue ?

Si tout est vert → pick valide. Si un paramètre est en dehors → ne pas forcer.

> Les picks générés par le moteur respectent déjà toutes ces règles automatiquement.
> Ce document sert à comprendre POURQUOI un pick est proposé ou absent,
> et à évaluer les picks manuellement si nécessaire.
