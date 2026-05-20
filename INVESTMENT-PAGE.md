# INVESTMENT-PAGE.md

Spécification de la page Investissement et refonte de la logique coupon.

## Statut

`À VALIDER PAR BACKTEST` — Analyse effectuée le 19 mai 2026. Implémentation bloquée jusqu'à ce que les gates de validation soient passées, avec hyperparamètres calibrés via backtest sur l'historique complet (33k+ fixtures depuis fév 2023).

---

## Contexte et diagnostic

### Problème : coupons perdants en série

Audit des 43 coupons settlés (mai 2026 — feature coupon récente, c'est tout l'historique de la table `coupon_proposal`) :

| Résultat | Count | Avg odds | Avg signal | Avg joint_prob |
| -------- | ----- | -------- | ---------- | -------------- |
| WON      | 6     | 3.02     | 0.636      | 0.475          |
| PARTIAL  | 9     | 3.44     | 0.621      | 0.411          |
| LOST     | 28    | 8.30     | 0.658      | 0.370          |

Note : le diagnostic ci-dessous part de ces 43 coupons réels, mais la **calibration des hyperparamètres** s'appuie sur l'ensemble des `prediction` et `bet` settled depuis fév 2023 — voir section "Calibration et backtest" pour le détail.

**Trois causes racines identifiées :**

### 1. jointProbability calculé sur des probabilités non calibrées

`CouponComposerService.buildCoupon()` calcule :

```
jointProbability = product(leg.probEstimated)
```

`probEstimated` est la probabilité brute du modèle Poisson — **non calibrée sur les outcomes réels**.

Écart mesuré pour SV:UNDER_4_5 :

| Source             | Probabilité |
| ------------------ | ----------- |
| Modèle Poisson     | ~0.88-0.92  |
| Bookmaker (1/cote) | 0.727       |
| **Hit rate réel**  | **0.515**   |

Un coupon 3 legs SV affiche `jointProbability = 0.73` (modèle) alors que la vraie probabilité calibrée est `0.515³ = 0.14`. Le filtre `jointProbability ≥ 0.45` est donc inopérant.

### 2. CONF détruit les coupons

Hit rate CONF en contexte coupon : **4% (1/25 legs corrects)**.  
Le signalScore CONF (~0.65) est identique aux autres canaux, donc le scorer ne le pénalise pas. Sans exclusion explicite ou calibration, CONF se retrouve dans des coupons à 30x de cote (tous LOST).

### 3. Trop de coupons, trop de legs

- 13 coupons générés par jour → rangs 6-13 : **100% LOST**
- Coupons 4-5 legs perdent systématiquement
- Coupons WON : quasi tous 2-3 legs, odds 2.68-3.18

---

## Solution : probabilités calibrées avec lissage bayésien

`SignalWindowService` calcule déjà les vrais hit rates dans `canalLeagueHitRates`.  
Remplacer `probEstimated` par ces taux dans le calcul de `jointProbability` — mais **pas en hit rate brut**.

### Problème du hit rate brut

Le hit rate brut sur 38 jours est trop nerveux sur les petits échantillons :

- `SV:HOME = 7/7 → 1.00` — probablement pas une vraie proba de 100%
- `CONF = 1/25 → 0.04` — peut amplifier une mauvaise période instable
- `EV = 5/7 → 0.71` — échantillon trop petit pour être fiable

### Formule : lissage bayésien

```
calibratedHitRate = (wins + k × priorCanal) / (n + k)

priorCanal  = hit rate global du canal — hiérarchie stricte :
              1. fenêtre longue (≥ 365 jours) si n ≥ 100 sur cette fenêtre
              2. sinon CANAL_BASE_WEIGHT (constante statique dans coupon-composer.service.ts)
k           = force du prior  (calibré par backtest — voir section "Calibration et backtest")
wins        = vrais positifs dans la fenêtre courte (38 jours)
n           = total observations dans la fenêtre courte (38 jours)
```

`k` n'est pas choisi a priori. La grid search sur l'historique teste `k ∈ {5, 10, 20, 50}` et retient la valeur qui maximise le ROI out-of-sample (voir section "Calibration et backtest"). Les exemples ci-dessous utilisent `k=10` à titre illustratif uniquement.

**Exemples illustratifs (k=10) :**

| Canal   | Brut (38j)   | Prior canal | Calibré (k=10)             |
| ------- | ------------ | ----------- | -------------------------- |
| SV:HOME | 7/7 = 1.00   | 0.74        | (7 + 7.4) / 17 = **0.79**  |
| EV      | 5/7 = 0.71   | 0.36        | (5 + 3.6) / 17 = **0.51**  |
| BB      | 19/30 = 0.63 | 0.62        | (19 + 6.2) / 40 = **0.63** |
| CONF    | 1/25 = 0.04  | 0.66        | (1 + 6.6) / 35 = **0.22**  |
| NUL     | 0/4 = 0.00   | 0.20        | (0 + 2.0) / 14 = **0.14**  |

Effet attendu : CONF passe de 0.04 à 0.22 — toujours mauvais mais pas définitivement tué par un seul mauvais mois. La valeur finale dépend de `k` retenu par le backtest.

### Règles de calcul

- Si `n < N_LEAGUE_MIN` pour un sous-segment `canal + league` : ignorer la ligue, utiliser le hit rate canal seul. `N_LEAGUE_MIN` est calibré par backtest (range testé : 10-30).
- Caps sur les probas calibrées : `[capMin, capMax]` calibrés par backtest (ranges testés : `capMin ∈ {0.05, 0.10, 0.15}`, `capMax ∈ {0.80, 0.85, 0.90}`). Valeurs initiales pour développement : `[0.12, 0.85]`.
- Pondération par récence : tester `flat` vs `decay exponentiel (demi-vie 14j)` pendant le backtest. La variante retenue est celle qui maximise le ROI out-of-sample.

### Threshold `calibratedJointProbability ≥ X`

`X` est un output du backtest, pas un input. Range testé : `[0.25, 0.45]` par pas de 0.05. Valeur initiale pour développement : `0.35`, à confirmer par grid search.

**Impact illustratif sur les coupons (hit rates calibrés k=10, threshold 0.35) :**

| Combo                 | Joint prob calibrée     | Verdict   |
| --------------------- | ----------------------- | --------- |
| SV + BB (2 legs)      | 0.79 × 0.63 = **0.50**  | ✓ viable  |
| SV + BB + BB (3 legs) | 0.79 × 0.63² = **0.31** | ✗ filtré  |
| SV + CONF (2 legs)    | 0.79 × 0.22 = **0.17**  | ✗ filtré  |
| CONF × 3              | 0.22³ = **0.01**        | ✗ éliminé |

CONF reste pénalisé par ses vrais résultats. La question "CONF doit-il être globalement exclu des coupons ou seulement filtré" est tranchée par le backtest (voir section dédiée).

---

## Changements backend

### `CouponComposerService` (refonte)

```
buildCoupon(legs, calibratedWindow) {
  // Utiliser les hit rates déjà lissés — jamais les bruts
  jointProbability = product(
    calibratedWindow.calibratedCanalLeagueHitRates[leg.canal][leg.competition]
    ?? calibratedWindow.calibratedCanalHitRates[leg.canal]
  )
  // Note : le fallback final (CANAL_BASE_WEIGHT) est absorbé dans calibratedCanalHitRates
  // au moment du calcul — il n'y a pas de brut qui "fuite" ici
}

scorePicks(picks, window, date) {
  // Inchangé
}

compose(scoredPicks, oddsMin, oddsMax) {
  // Toutes les valeurs ci-dessous sont OUTPUTS du backtest sur l'historique complet
  // (voir section "Calibration et backtest"). Les ranges sont les valeurs testées.
  //
  // - MAX_LEGS                       (range : 2-3)            défaut dev : 3
  // - MAX_COUPONS                    (range : 2-5)            défaut dev : 3
  // - minCalibratedJointProbability  (range : 0.25-0.45)      défaut dev : 0.35
  // - maxCombinedOdds                (range : 4.0-8.0)        défaut dev : 6.0
  // - Supprimer les 4 ODDS_TIERS (ils forcent des coupons improbables)
  // - Sélection : top MAX_COUPONS par (calibratedJointProbability × signalScore) desc

  // Règles anti-corrélation déterministes (non déléguées au prompt Claude) :
  // - Max 1 leg par (canal + market) dans un coupon (ex: pas 2× SV:UNDER_4_5)
  // - Max N_PER_CANAL legs du même canal par coupon  (N calibré par mesure
  //   empirique de corrélation par paire de canaux — voir backtest)
  // - Max 2 legs d'une même compétition par coupon
  // - 0 leg d'une fixture déjà présente dans un autre leg du même coupon
}
```

**Renommage dans `SignalWindow` :** les champs `canalHitRates` et `canalLeagueHitRates` deviennent `calibratedCanalHitRates` et `calibratedCanalLeagueHitRates` — ils contiennent les valeurs lissées, jamais les bruts. Les bruts ne sortent pas du `SignalWindowService`.

**Éligibilité coupon par canal :** chaque canal nécessite `n ≥ COUPON_MIN_SAMPLE[canal]` observations dans la fenêtre courte pour être éligible aux coupons (pas aux picks individuels). En dessous, le `calibratedHitRate` est trop incertain même avec lissage.

Les seuils par canal sont calibrés via backtest — on cherche le `n` minimum à partir duquel la variance du hit rate observé tombe sous un seuil acceptable (ex: écart-type ≤ 0.10). Valeurs initiales pour développement :

```
COUPON_MIN_SAMPLE: Record<Canal, number> = {
  SV: 10, BB: 10, EV: 5, CONF: 20, NUL: 20
}
```

Cas particulier CONF : voir section "Calibration et backtest" — le backtest tranche si CONF doit être globalement exclu du module investissement ou simplement filtré par seuil.

Signature de `compose` et `scorePicks` : passer `calibratedWindow: CalibratedSignalWindow` (nouveau type qui remplace `SignalWindow` dans ce contexte).

### `InvestmentService` (nouveau, dans `ai-engine`)

```
getInvestmentDay(date, windowDays) → InvestmentDayDto
  1. Charge TOUS les picks du jour : SignalWindowService.getTodayPool()
  2. Enrichit chaque pick avec les signaux calibrés : SignalWindowService.computeSignalWindow()
     → calibratedHitRateCanal, calibratedHitRateCanalLeague, signalScore, lambdaHome, lambdaAway
  3. Appel unique Claude API avec le pool complet enrichi
  4. Zod-valide la réponse Claude
  5. Validation métier après Zod (voir section "Invariants backend obligatoires")
  6. Fallback déterministe si erreur/timeout/invariant échoue
     (tri par calibratedHitRate × signalScore desc, compose par jointProbability calibrée)
  7. Retourne InvestmentDayDto
```

### Rôle de Claude (sélection, pas cosmétique)

Claude reçoit **tous les picks du jour** avec leurs features, sans présélection.  
Il est responsable de :

- Choisir **quels picks retenir** par canal (max SV=5, BB=5, CONF=5, DRAW=5, EV=2)
- Choisir **quels picks exclure** (mauvaise forme récente d'une ligue, lambdas incohérents, pick type sur série perdante, corrélation avec d'autres picks retenus)
- Composer les **3 coupons** à partir des picks retenus en minimisant les corrélations entre legs
- Fournir un **raisonnement court** par pick retenu et par coupon

**Input Claude — structure distillée par fixture (pas le raw `features` blob)**

Le raw `features` contient ~7KB de bruit (matrice HT/FT, picks rejetés, shadow features désactivées). On construit un `InvestmentFixtureInput` qui extrait uniquement ce dont Claude a besoin :

```json
{
  "fixtureId": "...",
  "homeTeam": "...",
  "awayTeam": "...",
  "competition": "PL",
  "scheduledAt": "2026-05-20T20:00:00Z",
  "model": {
    "lambdaHome": 1.84,
    "lambdaAway": 1.05,
    "probHome": 0.558,
    "probDraw": 0.228,
    "probAway": 0.214,
    "probBttsYes": 0.547,
    "probOver25": 0.551,
    "recentForm": 0.26
  },
  "candidatePicks": [
    {
      "canal": "SV",
      "market": "OVER_UNDER",
      "pick": "UNDER_4_5",
      "probability": 0.834,
      "oddsSnapshot": 1.38
    }
  ],
  "calibration": {
    "calibratedHitRateCanal": 0.61,
    "calibratedHitRateCanalLeague": 0.52,
    "signalScore": 0.74
  }
}
```

Estimation : ~500 tokens/fixture × 20 fixtures = ~10K tokens input. Haiku 4.5 (200K contexte) traite ça en quelques secondes.

**Output Claude (Zod-validé) :**

```json
{
  "selections": {
    "SV":   [{ "fixtureId": "...", "reasoning": "..." }, ...],
    "BB":   [...],
    "CONF": [...],
    "DRAW": [...],
    "EV":   [...]
  },
  "coupons": [
    {
      "rank": 1,
      "legs": [{ "fixtureId": "...", "canal": "SV" }, ...],
      "reasoning": "..."
    }
  ]
}
```

**Contraintes dans le prompt :**

- Max SV=5, BB=5, CONF=5, DRAW=5, EV=2
- Max 3 coupons, max 3 legs par coupon
- Pas 2 legs du même fixture dans un coupon
- Favoriser la diversité de compétitions dans les coupons
- Temperature : `0`

### Claude API

- Modèle : `claude-haiku-4-5-20251001`
- Temperature : `0`
- **1 seul appel/jour** — reçoit tous les picks, rend toutes les décisions
- Zod schema strict sur le retour — si parse fail : fallback déterministe
- Fallback déterministe : tri par `calibratedHitRate × signalScore` desc + compose calibrée (voir `CouponComposerService`)
- Package : `@anthropic-ai/sdk`
- **Pas de recherche web** — les analyses se font à la veille ou tôt le matin : les compositions ne sont pas connues, les blessures de dernière minute n'existent pas encore. La recherche web n'apporterait que du bruit. Claude raisonne uniquement sur les données structurées du moteur.

### Modèle et configuration

- **Modèle principal : `claude-haiku-4-5-20251001`**
- Temperature : `0`
- maxTokens : `4000`
- Configurable via variable d'environnement `AI_MODEL` — ne pas hardcoder dans le code

**Pourquoi Haiku et pas Sonnet :** la tâche est de la curation structurée sur un JSON préparé avec des contraintes strictes et une sortie JSON validée. Ce n'est pas du raisonnement complexe. Passer à Sonnet uniquement si les benchmarks montrent que Haiku rate trop les corrélations entre legs.

### Gestion des refus de modèle

Claude peut refuser des requêtes liées aux paris sportifs selon le contexte du prompt.

**Règle de framing — system prompt :**

Positionner Claude comme **analyste de données sportives statistiques**, jamais comme conseiller de pari :

| À éviter                          | À utiliser                                         |
| --------------------------------- | -------------------------------------------------- |
| "sélectionne les meilleurs paris" | "évalue la qualité statistique de ces prédictions" |
| "coupons gagnants"                | "combinaisons à forte probabilité jointe calibrée" |
| "maximise les gains"              | "minimise l'incertitude statistique"               |
| "bets", "gambling"                | "predictions", "selections", "picks"               |

**Stratégie de fallback (simplifiée) :**

```
1. Appel claude-haiku-4-5 avec framing statistique
   → succès + invariants backend OK : InvestmentDayDto avec sélections IA + reasoning

2. Si refus, erreur, Zod parse fail, ou invariant backend échoue
   → fallback déterministe immédiat (pas de retry Sonnet — complexité inutile)

3. Fallback déterministe :
   - Sélection : tri par (calibratedHitRate × signalScore) desc, top N par canal
   - Coupons : CouponComposerService calibré (jointProbability calibrée)
   - reasoning : null
   - Badge "Sélection automatique" discret sur la page
```

Le fallback est transparent pour l'utilisateur — la page s'affiche dans tous les cas.

### Valeur mesurable de Claude

Claude n'est pas présumé utile. Il doit battre le fallback déterministe calibré en backtest ou en shadow mode avant d'être activé comme moteur principal de curation.

**Baseline obligatoire :** `CouponComposerService` calibré sans Claude.

**Critères d'activation Claude :**

- delta ROI simulé ≥ +2 points vs baseline déterministe sur l'échantillon de test, ou réduction mesurable des coupons corrélés/perdants sans dégradation du ROI ;
- taux de fallback/refus Claude ≤ 5% ;
- aucune violation métier acceptée après validation backend.

Si Claude ne bat pas la baseline, la page Investissement démarre en mode déterministe (`reasoning: null`) et Claude reste désactivé.

---

## Page frontend

### Route

`/dashboard/investissement`

### Structure

```
Page Investissement
│
├── Section "Top picks du jour" (groupé par canal)
│   ├── Canal SV  — jusqu'à 5 picks
│   ├── Canal BB  — jusqu'à 5 picks
│   ├── Canal CONF — jusqu'à 5 picks
│   ├── Canal DRAW — jusqu'à 5 picks
│   └── Canal EV  — jusqu'à 2 picks
│
│   Chaque card pick :
│   - Fixture (logo + noms équipes)
│   - Canal badge
│   - Cote + probabilité calibrée (pas le probEstimated brut du modèle)
│   - Explication IA (si disponible, sinon absent — pas de placeholder vide)
│   - Bouton panier
│
└── Section "Coupons du jour" — 3 cards max
    - Combined odds
    - Joint probability calibrée
    - Liste des legs (fixture, canal, pick, cote)
    - Statut (PENDING / WON / LOST / PARTIAL)
```

**États UI à gérer explicitement :**

| État                              | Comportement attendu                                                   |
| --------------------------------- | ---------------------------------------------------------------------- |
| Chargement                        | Skeleton cards par canal                                               |
| Aucun pick du jour                | Message "Pas de pick éligible aujourd'hui"                             |
| Fallback déterministe (Claude KO) | Badge discret "Sélection automatique" sur les picks, pas d'explication |
| Erreur partielle Claude           | Picks affichés, section coupons masquée si coupons invalides           |
| Coupon PENDING                    | Statut visible, pas de résultat                                        |
| Coupon settled (WON/LOST/PARTIAL) | Badge résultat coloré                                                  |

### Navigation

Ajouter entrée dans le sidebar : **Investissement** (icône TrendingUp ou Sparkles).

---

## Gates de validation

Ces gates sont bloquantes : si l'une échoue, la feature ne passe pas en exposition utilisateur principale.

### Gate 0 — Phase produit

Clarifier dans `EVCORE.md` si la page Investissement est MVP, Phase 2 ou expérimental interne.

Décision par défaut : **expérimental interne** tant que le backtest et le shadow mode ne sont pas validés. Claude reste une couche de curation optionnelle, pas une dépendance du pipeline betting engine principal.

### Gate 1 — Anti-fuite temporelle

Avant de croire au backtest, prouver que `SignalWindow_J` est reconstruit uniquement avec des données connues avant `J`.

Exigences :

- fixtures settled utilisées pour calibration : date strictement antérieure à `J` ;
- `model_run`, lambdas, `recentForm` et features : version disponible avant kickoff du fixture évalué ;
- aucun outcome de `J` ou postérieur à `J` ne peut modifier les hit rates calibrés ;
- tests unitaires avec fixtures artificielles post-`J` : ajouter ces fixtures ne doit pas changer `SignalWindow_J` ;
- audit manuel de 10 dates historiques : inputs, fenêtre utilisée, picks générés, outcomes exclus.

Sans cette gate, aucun résultat de backtest n'est considéré valide.

### Gate 2 — Exit criteria du backtest

Le backtest doit définir quoi faire si la logique ne marche pas.

- Si ROI out-of-sample ≤ -5% sur toutes les configurations : ne pas exposer la page coupons.
- Si le composer calibré ne bat pas le composer actuel : ne pas remplacer la génération quotidienne BullMQ.
- Si Claude ne bat pas le fallback déterministe : mode déterministe only.
- Si CONF dégrade le ROI dans la majorité des configurations robustes : CONF reste visible en pick individuel, mais exclu des coupons.
- Si le meilleur résultat dépend d'une configuration isolée et instable : rejeter la configuration, élargir l'échantillon ou garder la baseline.

### Gate 3 — MarketSuspension, odds et staking

Avant exposition UI :

- exclure du pool tout fixture/pick dont le marché est suspendu ou dont `oddsSnapshot` est absent ;
- ne jamais laisser Claude réactiver un marché suspendu ;
- ne pas afficher de conseil de mise tant que la politique bankroll n'est pas définie ;
- ne pas afficher Kelly ou staking dynamique ;
- si une mise indicative est nécessaire plus tard, démarrer par une règle flat stake explicite et bornée.

### Gate 4 — Recalibration

Les hyperparamètres ne sont pas permanents. Relancer le backtest :

- mensuellement ;
- après changement significatif de modèle, scoring ou source de données ;
- si le ROI simulé sur 14 jours glissants passe sous -5% ;
- si la calibration predicted vs realized dérive fortement ;
- si la matrice de corrélation des canaux s'écarte des valeurs backtestées.

---

## Ordre d'implémentation

1. **Audit des données disponibles** — `scripts/backtest-data-audit.ts` (volume settled par canal × ligue × mois) — bloque l'étape 2 si couverture insuffisante.
2. **Backtest + grid search** — `scripts/backtest-investment.ts` produit `backtest-selected-params.json` et `backtest-correlation-matrix.csv`. **Pré-requis dur** à toute la suite.
3. **Refonte `CouponComposerService`** — probabilités calibrées + hyperparamètres issus du backtest (jamais de valeurs codées en dur, toutes lues depuis config).
4. **`InvestmentService`** — sélection top picks + appel Claude.
5. **Endpoint `GET /ai-engine/investment`**.
6. **Page frontend `/dashboard/investissement`**.
7. **Entrée navigation sidebar**.
8. **Shadow mode** — 2-4 semaines : la nouvelle compose tourne en parallèle de l'ancienne, on compare ROI réel sans router le trafic. Puis switch.

---

## Invariants backend obligatoires

Validation métier appliquée **après** le Zod parse de la réponse Claude. Claude propose, le backend dispose.

```
Pour chaque fixtureId dans selections :
  ✓ La fixture existe en base et est SCHEDULED
  ✓ Le canal est autorisé pour cette fixture (bet ou prediction existant)
  ✓ Le pick (market + pick) correspond à un candidat réel du pool du jour
  ✓ Pas de pick inventé par Claude absent du pool
  ✓ Le marché n'est pas suspendu et dispose d'un oddsSnapshot exploitable

Pour chaque coupon :
  ✓ Max 3 legs
  ✓ Pas 2 legs du même fixtureId
  ✓ Pas 2 legs avec (canal + market) identiques
  ✓ Les odds sont présentes (oddsSnapshot non null)
  ✓ combinedOdds recomputed côté backend — ne pas faire confiance à la valeur Claude
  ✓ calibratedJointProbability recomputed côté backend

Si un invariant échoue → rejeter la réponse entière, activer le fallback déterministe.
```

Le modèle de noms est configurable via `AI_MODEL` en variable d'environnement — ne pas hardcoder le nom de modèle dans le code.

---

## Calibration et backtest

Cette section est le cœur de la spec — pas une vérification finale. Les hyperparamètres (k, threshold, MAX_LEGS, caps, COUPON_MIN_SAMPLE, etc.) sont des **outputs** du backtest, pas des choix a priori. La feature `coupon_proposal` est récente (43 coupons réels en base), mais les tables `prediction`, `bet`, `model_run`, `fixture` couvrent depuis février 2023 — soit ~33 500 fixtures finished et plusieurs milliers de picks settlés par canal. C'est ce que le backtest exploite.

### Données disponibles pour le backtest

| Table                  | Volume        | Période                  | Usage backtest                     |
| ---------------------- | ------------- | ------------------------ | ---------------------------------- |
| `fixture` (FINISHED)   | ~33 500       | 2023-02 → 2026-05        | Univers des matchs                 |
| `model_run`            | ~4 500        | depuis activation engine | Snapshots des features             |
| `prediction` (settled) | TBD via query | depuis activation        | Hit rates par canal CONF/BTTS/DRAW |
| `bet` (settled)        | TBD via query | depuis activation        | Hit rates par canal SV/EV          |
| `odds_snapshot`        | TBD via query | —                        | Reconstitution des cotes du jour J |

Un script de discovery `scripts/backtest-data-audit.ts` doit produire en sortie le volume settled par canal × ligue × mois pour confirmer la couverture avant de lancer le grid search.

### Principe du backtest

```
Pour chaque jour J dans [2023-08-01 → 2026-04-01]  (train)
                    et [2026-04-01 → 2026-05-19]   (test out-of-sample) :

  1. Reconstituer SignalWindow_J en utilisant UNIQUEMENT les predictions/bets
     settled AVANT J. Aucune fuite temporelle (pas d'outcome de J ni d'après J
     dans le calcul des hit rates calibrés).

  2. Charger le pool de picks réels disponibles à J (via model_run et bet/prediction
     créés à J, avant kickoff).

  3. Appliquer le nouveau CouponComposerService avec un jeu d'hyperparamètres P.

  4. Pour chaque coupon généré : confronter aux outcomes réels
     (bet.status, prediction.correct).

  5. Agréger ROI, hit rate, distribution par canal, drawdown max.
```

### Grid search

```
HYPERPARAM_SPACE = {
  k                                ∈ {5, 10, 20, 50},
  minCalibratedJointProbability    ∈ {0.25, 0.30, 0.35, 0.40, 0.45},
  MAX_LEGS                         ∈ {2, 3},
  maxCombinedOdds                  ∈ {4.0, 5.0, 6.0, 8.0},
  capMin                           ∈ {0.05, 0.10, 0.15},
  capMax                           ∈ {0.80, 0.85, 0.90},
  recencyWeighting                 ∈ {flat, exponential_decay_14d},
  N_LEAGUE_MIN                     ∈ {10, 15, 20, 25, 30},
  COUPON_MIN_SAMPLE[canal]         ∈ {5, 10, 15, 20, 25}  par canal,
  includeConfInCoupons             ∈ {true, false}
}
```

Ne pas exécuter cet espace comme produit cartésien brut. La recherche se fait par étapes :

1. fixer les contraintes métier conservatrices (`MAX_LEGS`, `MAX_COUPONS`, `maxCombinedOdds`) ;
2. chercher `k`, `capMin`, `capMax` et `minCalibratedJointProbability` ;
3. tester `COUPON_MIN_SAMPLE` par canal ;
4. tester inclusion/exclusion CONF ;
5. tester la pondération par récence en dernier.

Sélection : combinaison qui maximise le **ROI out-of-sample** sous contraintes :

- Hit rate ≥ 35% sur l'ensemble des coupons
- Drawdown max ≤ 30% du capital initial simulé
- Au moins 50 coupons générés sur la période test (sinon échantillon insuffisant)

### Mesure empirique de la corrélation des legs

L'hypothèse d'indépendance entre legs (`joint = product(hitRates)`) est **testable sur les données**, pas seulement à atténuer.

Pour chaque paire de canaux `(A, B)` :

```
correlationFactor(A, B) =
   P(A correct ET B correct | mêmes jours observés)
   / [P(A correct) × P(B correct)]   (sous indépendance, ratio = 1.0)
```

Si `correlationFactor(SV, SV) > 1.3` → règle dure "max 1 SV par coupon" validée empiriquement.  
Si `correlationFactor(SV, BB) ≈ 1.0` → indépendants, combinaison sûre.  
Si `correlationFactor(SV, CONF) < 0.8` → anti-corrélés (peu probable mais à vérifier).

Cette matrice de corrélation est un output du backtest et alimente `N_PER_CANAL` dans `CouponComposerService.compose()`. Elle est recalculée mensuellement après déploiement.

### CONF : tranchage empirique

Le hit rate brut CONF de 4% (1/25, mai 2026) peut cacher différents scénarios. Le backtest répond :

1. Calculer le hit rate CONF par mois × ligue sur 2023-2026.
2. Si CONF performe ≥ 50% sur certaines ligues stables → calibration ligue-spécifique, garder dans les coupons.
3. Si CONF est globalement ≤ 30% ou très volatile → `includeConfInCoupons = false`, CONF reste dans les picks individuels mais hors coupons.
4. Si CONF s'est dégradé récemment (était ≥ 50% en 2024, ≤ 20% en 2026) → enquête backend séparée sur le canal avant tout déploiement de la page.

### Test de stationnarité

Avant de retenir des hyperparamètres sur 2023-2026, vérifier que le régime de données n'a pas changé au point d'invalider le backtest.

Contrôles minimaux :

- comparer les distributions de cotes, probabilités modèle, ligues et canaux par semestre ;
- comparer les hit rates canal par semestre et par saison ;
- isoler les périodes où le modèle, le fournisseur de données ou la logique de scoring a changé ;
- si un changement structurel est détecté, pondérer les périodes récentes ou exclure les anciennes périodes non comparables.

Si les performances varient fortement selon la période, préférer une configuration plus simple et robuste à une configuration qui maximise uniquement le train historique.

### Out-of-sample et anti-overfit

- Split train (2023-08 → 2026-04) / test (2026-04 → 2026-05) strict.
- La sélection des hyperparamètres se fait uniquement sur le train, le test n'est utilisé qu'une fois.
- Si la performance test diffère de >30% du train → soupçon de surapprentissage, élargir la fenêtre ou simplifier l'espace de recherche.
- Cross-validation rolling sur 6 windows train/test possible pour robustesse (optionnel).

### Script et outputs

```
scripts/backtest-investment.ts

Outputs :
  - reports/backtest-grid-search.csv     (toutes les combinaisons et leurs métriques)
  - reports/backtest-correlation-matrix.csv  (correlationFactor par paire de canaux)
  - reports/backtest-conf-by-league.csv  (hit rate CONF par mois × ligue)
  - reports/backtest-selected-params.json  (hyperparamètres retenus + justification)
```

Le contenu de `backtest-selected-params.json` est versionné — toute modification ultérieure des hyperparamètres en config doit référencer un nouveau backtest, jamais une décision arbitraire.

---

## Hypothèses et limites

- **Indépendance imparfaite entre legs** : mesurée empiriquement par `correlationFactor(A, B)` dans le backtest (voir section "Calibration et backtest"). Si la mesure révèle une corrélation forte intra-canal, la règle `N_PER_CANAL` cap le nombre de legs du même canal par coupon. Pas une hypothèse à atténuer — un paramètre dérivé des données.
- **Fenêtre courte de 38 jours** : capte le signal récent. Le lissage bayésien + le prior issu de la fenêtre longue (≥ 365j) compense les petites séries. La fenêtre courte est configurable via `DEFAULT_WINDOW_DAYS` dans `AiEngineService` et la longueur optimale peut être testée par le backtest (range `{21, 38, 60, 90}` jours).
- **Petits échantillons sur canal + league** : géré par `N_LEAGUE_MIN` calibré au backtest. Sous ce seuil, fallback au hit rate canal seul. Les canaux à faible volume (EV, NUL) ont des intervalles de confiance plus larges — le backtest doit vérifier que leur ROI reste positif sur l'out-of-sample.
- **Train/test split fixe** : le test out-of-sample (2026-04 → 2026-05) couvre ~6 semaines, ce qui reste limité. Cross-validation rolling recommandée pour robustesse si la simple validation montre de la variance entre folds.
- **Régime de données** : le backtest suppose que la distribution des matchs/cotes/résultats est stationnaire entre 2023 et 2026. Si des changements structurels existent (saison COVID, nouvelles ligues ajoutées en cours de route), pondérer ou exclure les périodes concernées.

---

## Métriques de succès post-implémentation

À suivre après déploiement pour valider la refonte. Les cibles sont calibrées sur le ROI/hit rate observés dans le backtest sur l'out-of-sample — pas des valeurs arbitraires.

| Métrique                                                      | Cible                                   | Fréquence       | Source de la cible              |
| ------------------------------------------------------------- | --------------------------------------- | --------------- | ------------------------------- |
| ROI réel coupons                                              | ≥ ROI backtest out-of-sample - 5pp      | Hebdo + mensuel | `backtest-selected-params.json` |
| Hit rate coupons                                              | ≥ hit rate backtest out-of-sample - 5pp | Hebdo           | `backtest-selected-params.json` |
| Distribution résultats par canal sur picks investissement     | ≥ hit rate calibré - 10pp               | Mensuel         | matrice calibration             |
| Brier score picks investissement                              | ≤ Brier score backtest + 0.05           | Mensuel         | backtest                        |
| Drawdown max sur 30 jours glissants                           | ≤ drawdown max backtest × 1.3           | Quotidien       | backtest                        |
| Taux de refus Claude (fallback déterministe activé)           | ≤ 5%                                    | Hebdo           | observation                     |
| Drift de corrélation (`correlationFactor` actuel vs backtest) | écart ≤ 0.2 sur paires majeures         | Mensuel         | recalcul matrice                |

Un écart durable sur 2-3 cibles déclenche un re-backtest et potentiellement une recalibration des hyperparamètres.

---

## Décisions architecturales

- Les coupons existants (`GET /ai-engine/coupons`) continuent de fonctionner — pas de breaking change
- Le coupon composer réformé s'applique aussi à la génération quotidienne BullMQ
- OpenClaw reste en stand-by (voir `OPENCLAW.md`) — Claude ici est utilisé pour les **décisions de sélection** de la page Investissement uniquement, pas pour le pipeline betting engine principal (ModelRun, EV, SV). Le moteur déterministe reste autorité sur les picks bruts ; Claude fait la curation finale.
- Le canal EV est limité à 2 picks sur la page investissement (faible volume, petit sample)
