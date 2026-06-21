# Module `coupon/` — Design d'implémentation

> Document de travail issu de la confrontation entre les recherches externes
> (`recherche.md` : Gemini / Google AI / ChatGPT) et l'état réel du code EVCore
> (Phase 3, juin 2026). Rédigé par revue du code existant, pas une compilation
> de recettes génériques.
>
> **Thèse centrale** : les recherches sont correctes mais génériques. Or EVCore
> possède **déjà** presque toute la machinerie qu'elles décrivent (Poisson
> bivarié, EV, proba jointe corrélée, Kelly, calibration, couche ML). Le vrai
> problème n'est pas « quelles formules ajouter » — c'est que le module `coupon/`
> **n'utilise pas** ces briques et en réimplémente une version plus faible.
> Ce document liste donc surtout des **branchements** et des **corrections**,
> pas des nouveautés mathématiques.

---

## 1. Cadrage : ce qui existe déjà (ne PAS réinventer)

Avant d'écrire la moindre formule, voici ce que les recherches réclament et qui
est **déjà implémenté et testé** ailleurs dans le backend. Le module coupon doit
**consommer** ces briques, pas les recréer.

| Recommandation des recherches                      | Statut EVCore      | Où                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loi de Poisson (λ dom/ext, matrice de scores)      | ✅ Fait            | `buildPoissonDistributions`, `computePoissonMarkets`, `deriveMarketsFromPoisson` ([betting-engine.utils.ts](betting-engine.utils.ts))                                                                                                                                                                                                                                                                 |
| `EV = p × cote − 1`, filtre EV strict              | ✅ Fait            | `calculateEV`, `EV_THRESHOLD = 0.08`, seuils par ligue `LEAGUE_EV_THRESHOLD_MAP` ([ev.constants.ts](../betting-engine/ev.constants.ts))                                                                                                                                                                                                                                                               |
| Proba jointe **corrélée** même-match (pas `p1×p2`) | ✅ Fait            | `computeJointProbability` (table Poisson bivariée) + `COMBO_WHITELIST` ([betting-engine.utils.ts](../betting-engine/betting-engine.utils.ts))                                                                                                                                                                                                                                                         |
| Kelly fractionnaire (Quarter Kelly, cap mise)      | ✅ Fait            | `calculateKellyStakePct`, `KELLY_FRACTION=0.25`, `KELLY_MAX_STAKE_PCT=0.05`, flag `KELLY_ENABLED`                                                                                                                                                                                                                                                                                                     |
| Calibration — **mesure**                           | ✅ Fait            | `CalibrationService` (Brier, meanError) → déclenche `AdjustmentProposal`. ⚠️ **mesure seulement, ne corrige aucune proba au runtime.**                                                                                                                                                                                                                                                                |
| Calibration — **correction de proba**              | ⚠️ **PAS en prod** | Couche ML XGBoost (`predictShadowCorrection`) = **shadow only** : `shadowMlCorrectedP` est loggé, la décision garde la **proba Poisson brute** ([betting-engine.service.ts:905-925](../betting-engine/betting-engine.service.ts)). Promotion hors shadow = TODO ROADMAP. La seule « calibration » réellement appliquée est **manuelle** : corrections λ + seuils EV par ligue dans `ev.constants.ts`. |
| Proba implicite bookmaker                          | ✅ Fait (partiel)  | canal DRAW utilise `1/drawOdds`                                                                                                                                                                                                                                                                                                                                                                       |

**Conséquence directe :**

- ❌ **Ne pas** réimplémenter une formule Kelly inline dans le coupon
  (règle CLAUDE.md : « Kelly criterion formula — not before Phase 2 config flag » ;
  il existe, derrière `KELLY_ENABLED`). Réutiliser `calculateKellyStakePct`.
- ❌ **Ne pas** réimplémenter `EV = p×cote−1` inline (règle CLAUDE.md : EV défini
  une seule fois dans `config/`). Réutiliser `calculateEV`.
- ❌ **Ne pas** faire `p1 × p2` pour deux marchés du **même match** — utiliser
  `computeJointProbability`.

---

## 2. Ce que les recherches proposent et qui est HORS PÉRIMÈTRE

| Proposition                                                                                          | Verdict                     | Raison                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Elo / Glicko** (rating dynamique)                                                                  | ❌ Ne pas introduire        | Le socle EVCore est Poisson + couche de correction ML, pas un système de rating concurrent. Ajouter Elo créerait deux sources de vérité. La « forme du moment » est déjà captée par `recentForm` et le décalage `xg`.                                           |
| **Dixon-Coles** (correction nuls) à la main                                                          | ❌ Pas maintenant           | Le biais Poisson (dont la sous-estimation des nuls) est précisément ce que la **couche ML Phase 3 corrige** (`outcome_correct` calibré sur cotes Pinnacle), et le canal DRAW contourne déjà Poisson via `1/drawOdds`. Réimplémenter Dixon-Coles ferait doublon. |
| **XGBoost / réseaux dans le coupon**                                                                 | ❌ Hors module              | Le ML vit dans `ml/` (Phase 3). Le coupon **consomme** des probabilités, il n'entraîne pas de modèle.                                                                                                                                                           |
| **Kelly dynamique selon drawdown**                                                                   | ⏸ Backlog Phase 3           | Déjà listé non-fait dans ROADMAP (« réduction progressive des mises si drawdown > 8% »). Ne pas l'anticiper ici.                                                                                                                                                |
| Pseudo-code TS de ChatGPT (`expectedValue`, `kellyFraction`, `impliedProbability` en `number` natif) | ⚠️ À ne pas copier tel quel | Viole les règles EVCore : `decimal.js` obligatoire pour cote/EV/proba/bankroll ; EV/Kelly définis une seule fois ; `max-params` 3. À réécrire en réutilisant l'existant.                                                                                        |

---

## 3. Audit du module `coupon/` actuel — les vrais « bobos »

Revue de [coupon-composer.service.ts](coupon-composer.service.ts),
[signal-window.service.ts](signal-window.service.ts),
[coupon.constants.ts](coupon.constants.ts).

### 🔴 B1 — Le coupon n'utilise JAMAIS l'EV

`compose()` filtre uniquement sur `jointProbability ≥ 0.25` et trie par
`jointProbability` décroissant. **Aucun calcul d'EV de jambe ni d'EV de coupon.**

C'est l'incohérence la plus grave : EVCore est un moteur **value-driven**
(`EV ≥ 8%` est dans le nom du projet). Un coupon qui classe par probabilité de
gain sélectionne des **favoris**, pas de la **value** — exactement l'erreur que
les trois recherches dénoncent en premier (« un coupon de favoris à 1.20 finit
par perdre »).

→ **Corriger** : calculer `legEV = calculateEV(pLeg, oddsLeg)` et
`couponEV = P_coupon × Odd_coupon − 1`, filtrer et trier dessus.

### 🔴 B2 — Cotes fallback inventées

`FALLBACK_ODDS` (SAFE 1.65, EV 1.85…) est utilisé quand `oddsSnapshot` est `null`.
Un EV (ou même une cote combinée) calculé sur une cote **inventée** est faux, et
ça viole la règle ETL « `odds_snapshot` obligatoire en phase live → sinon
NO_BET ».

→ **Corriger** : exclure les jambes sans cote réelle des coupons à EV. (Garder un
mode « affichage seul sans EV » si besoin UX, mais jamais nourrir l'EV avec une
cote fictive.)

### ✅ B3 — Calibration de jambe ad hoc → CORRIGÉE (juin 2026)

> **Implémenté.** Le blend 50/50 arbitraire est remplacé par une correction de
> biais par marché, mesurée sur données réelles.
> Voir `calibrateLegProbability` ([coupon-composer.service.ts](coupon-composer.service.ts)),
> `SignalWindow.marketCalibration` ([signal-window.service.ts](signal-window.service.ts)).
>
> - Mécanique : `pCalibrated = clamp(pModel − meanError[market], capMin, capMax)`,
>   `meanError = mean(p − outcome)` fourni par `CalibrationService` (≥ 50 paris
>   réglés, `lambdaFloorHit` exclus).
> - Biais mesurés en prod (juin 2026) : ONE_X_TWO **+0.067**, OVER_UNDER **+0.129**,
>   BTTS **+0.039** → surconfiance systématique, désormais retirée.
> - Marchés non suivis (OVER_UNDER_HT, DOUBLE_CHANCE…) ou < 50 paris → fallback
>   documenté sur le blend 50/50 (`legProbability`).
> - **Limite connue** : `meanError` est mesuré sur la sous-population des paris
>   _sélectionnés_ (EV+). C'est une correction de biais moyen global, pas une
>   calibration par bin (isotonic) — celle-ci viendra avec la promotion de la
>   couche ML hors shadow (point d'extension déjà prévu dans `calibrateLegProbability`).

Contexte d'origine (conservé) : `calibratedLegProbability` = `0.5 × pModel +
0.5 × hitRate canal` mélangeait une proba modèle avec un taux de réussite agrégé
(canal) — deux objets de natures différentes, avec un poids 50/50 arbitraire.
Ce n'était pas un doublon du ML (shadow) ni de `CalibrationService` (mesure
seule) : c'était la **seule** correction de proba au niveau pick, d'où la priorité.

### ✅ B4 — Proba « fair » marché (overround retiré) → CORRIGÉ (2026-06-21)

> **Implémenté (Étape 2).** `removeOverround` + `bookmakerMargin` dans
> `betting-engine.utils.ts` ; le pool charge les cotes complètes du marché et pose
> `pMarketFair` / `bookmakerMargin` / `edge = pModel − pMarketFair` par jambe
> (`featureSnapshot` + `reasoning`). Voir § Étape 2.

Contexte d'origine (conservé) : le coupon ne convertissait jamais les cotes en
probabilités fair, donc aucune mesure de **edge vs marché** — pourtant le cœur de
la value betting. Comparer `pModel` à `pMarketFair = (1/cote) / overround`, pas à
`1/cote` brut.

### 🟠 B5 — Tri par probabilité, pas par rentabilité

Conséquence de B1. La recherche recommande de classer par **Expected Log Growth**
puis EV. EVCore devrait au minimum classer par **EV de coupon** (cohérent avec son
ADN), avec Expected Log Growth derrière un flag optionnel.

### 🐞 B0 — Bug bloquant : `computeSignalWindow` plantait à l'exécution → CORRIGÉ (juin 2026)

> **Découvert pendant B6.** Le SQL joignait `channel_selection cs` et lisait
> `cs.channel` — or la colonne `channel` est sur `channel_decision`, pas sur
> `channel_selection` (déplacée lors de la migration `ChannelDecision/Selection`
> sans mettre à jour cette requête, héritée de `ai-engine`). Résultat :
> `ERROR: column cs.channel does not exist` → **toute la calibration de fenêtre
> échouait**. La requête n'avait donc jamais produit de calibration réelle ; les
> rares coupons générés tournaient au prior.
>
> **Correctif** : ajout de `JOIN channel_decision cd ON cd.id = cs."channelDecisionId"`
> et lecture de `cd.channel`. Vérifié contre la prod : la requête renvoie bien des
> lignes. À surveiller — c'était silencieux car non couvert par un test DB.

### ✅ B6 — Calibration de fenêtre limitée à EV + SAFE → CORRIGÉE (juin 2026)

> **Données prod (juin 2026)** : seuls **EV (1158)** et **SAFE (457)** ont des paris
> MODEL réglés ; BTTS/DRAW/DOMINANT = **0** (confirme B7). B6 calibre désormais les
> 5 canaux honnêtement, mais en pratique seuls EV/SAFE ont un échantillon — les
> autres restent au prior `CANAL_BASE_WEIGHT` tant que B7 n'est pas traité.

> **Implémenté.** Le filtre `cs.channel IN ('EV','SAFE')` est retiré de
> `computeSignalWindow` ([signal-window.service.ts](signal-window.service.ts)).
> Chaque canal est désormais calibré depuis ses propres paris MODEL réglés ; un
> canal sans échantillon retombe **explicitement** sur son `CANAL_BASE_WEIGHT`
> via `calibrate()` (`total=0 ⇒ prior`). Plus d'ambiguïté : soit donnée réelle,
> soit prior assumé et documenté.

### ✅ B-ODDS — DOMINANT/BTTS ne capturaient pas leur cote → CORRIGÉ (juin 2026)

> **Découvert en chiffrant B7.** Les cotes existent en base (45 267 cotes 1X2,
> 45 586 BTTS) et sont acheminées au contexte (`FullOddsSnapshot`), mais les
> stratégies BTTS et DOMINANT **n'attachaient pas** la cote à leur sélection
> (contrairement à EV/SAFE/DRAW) → `channel_selection.odds = null`, EV/ROI
> incalculables pour ces canaux. Pur oubli de code, pas un trou de données.
>
> **Correctif + principe** : helper partagé `priceForSelection`
> ([strategies/selection-odds.ts](../betting-engine/strategies/selection-odds.ts))
> applique odds + impliedProbability + EV ; appliqué à BTTS et DOMINANT. Principe
> gravé sur `StrategySelection` : **tout canal attache son prix marché** (EV jamais
> recalculé inline). Exception assumée : DRAW (signal = proba implicite ⇒ EV ≡ 0).
> ⏳ **Going-forward seulement** — les `channel_selection` historiques restent à
> `null` tant qu'un **backfill** (recalcul depuis `OddsSnapshot`) n'est pas fait.

### ✅ B-TEMP — Biais temporel (look-ahead) du signal → CORRIGÉ (juin 2026)

> **Question soulevée puis corrigée.** `computeSignalWindow` calculait sa fenêtre
> par rapport à `Date.now()` (pas de borne haute), et `computeAllMarkets` n'avait
> aucune borne de date. En **live** (date = aujourd'hui/demain) c'était sans
> conséquence (les fixtures à venir sont `PENDING`, donc exclues des `WON/LOST`),
> mais en **régénération historique / picks passés** le signal du jour D était
> contaminé par les résultats de matchs joués **après** D — fuite de futur, et
> signal non reproductible.
>
> **Correctif (sémantique as-of)** :
>
> - `computeSignalWindow(windowDays, asOf=now)` + `CalibrationService.computeForMarket/computeAllMarkets({ asOf })`.
> - Borne point-in-time sur `fixture.scheduledAt < asOf` (le résultat n'est connu
>   qu'après le coup d'envoi ; pas de colonne `settledAt` en base). La fenêtre basse
>   passe aussi sur `f.scheduledAt`, cohérente avec le decay (qui clé sur le jour du match).
> - `coupon.service.generateCoupons(date)` passe `asOf = début du jour cible`.
>   `chat.pick-engine` : `asOf` par jour dans `getTopPicks` (boucle), `asOf = date`
>   dans `getUpcomingPicks` / `planLadder` / `composeSelection`.
> - **Défaut `asOf = now` ⇒ comportement live inchangé, zéro régression** (541 tests verts).

### ✅ B-ROI — ROI réel par canal mesurable → MESURÉ (juin 2026)

> Une fois les cotes backfillées, le ROI réel à mise plate par canal devient
> calculable depuis `channel_selection` (sans aucun `Bet`) :
>
> | Canal    | ROI flat   | Note                                                   |
> | -------- | ---------- | ------------------------------------------------------ |
> | EV       | **+11.5%** | canal de mise ✅                                       |
> | DRAW     | **+9.9%**  | candidat staking ✅                                    |
> | SAFE     | **+3.7%**  | canal de mise ✅                                       |
> | BTTS     | +1.0%      | EV modèle ≈ 0, pas d'edge exploitable                  |
> | DOMINANT | **−2.1%**  | **EV anti-prédictive** (sous-ensemble EV≥0.08 = −4.8%) |
>
> **Conclusions** : (1) le suivi ROI de tous les canaux existe déjà via
> `channel_selection` — pas besoin de matérialiser un `Bet` pour suivre.
> (2) DOMINANT n'est pas qu'un problème de niveau de calibration : son signal EV
> classe à l'envers (recalibrer le niveau ne suffira pas). (3) Ne staker que les
> canaux à +ROI prouvé ; DRAW est le prochain candidat. Reste à construire une
> **vue ROI roulante par canal × EV-bin** pour décider des promotions.

### 🟡 B7 — Le pool « réel » est de fait EV + SAFE seulement

`getTodayPool` ne lit que les `Bet` source `MODEL` (matérialisés pour EV/SAFE via
`channelSelection`). BTTS/DRAW/DOMINANT n'ont en pratique pas de `Bet` MODEL → ils
n'entrent dans les coupons réels que via le pool **virtuel** séparé
(`getTodayVirtualPool`). Malgré `CANAL_BASE_WEIGHT` à 5 canaux, le coupon réel ≈
EV+SAFE. → Clarifier l'intention et unifier (ou documenter) les deux pools.
**Note** : B6 calibre maintenant les 5 canaux, mais tant que B7 n'est pas traité,
seuls EV/SAFE ont effectivement un échantillon — les autres restent au prior.
**Décision produit (juin 2026)** : DOMINANT/BTTS restent des canaux de
**prédiction** (suivis analytiquement via `channel_selection`), pas de mise — leur
ROI réel mesuré post-backfill est −2.1% / +1.0% et l'EV de DOMINANT est
anti-prédictive. Seul DRAW (+9.9%, cotes présentes) est un candidat staking. Voir
B-ROI ci-dessous. L'unification pool réel/virtuel reste à faire (Étape coupon).

### ✅ B8 — Constantes incohérentes → CORRIGÉ (2026-06-21)

> Levé en Étape 4 : `MAX_COUPON_SELECTIONS` documenté comme **plafond de pool par
> canal** (combien de candidats d'un canal entrent dans le pool), distinct des
> **jambes d'un coupon** (`CouponProfileBounds.maxLegs`). Plus d'ambiguïté.

### ✅ B9 — Profils de risque → CORRIGÉ (2026-06-21)

> Implémenté en Étape 4 : `COUPON_PROFILES` (SAFE / BALANCED / AGGRESSIVE) +
> `compose(scoredPicks, profile)`. Voir § Étape 4. Bornes indicatives non activées
> en génération (gate backtest Étape 7).

### ✅ B10 — Staking → CORRIGÉ (2026-06-21)

> Implémenté en Étape 5 : `recommendedCouponStakePct` derrière `KELLY_ENABLED`
> (flat `DEFAULT_STAKE_PCT` sinon), tracé dans le `reasoning`. Voir § Étape 5.

### ⚪ B11 — Combos même-match à value non exploités

L'anti-corrélation « max 1 jambe par fixture » interdit tout combo même-match.
Pourtant EVCORE.md (§ Combos-match) **autorise** 2 marchés sur la même fixture si
la proba jointe vient de Poisson et `EV joint ≥ 8%` — et `computeJointProbability`

- `COMBO_WHITELIST` existent déjà pour ça. C'est de la value laissée sur la table.

---

## 3bis. Diagnostic Re-run 2026-06-20 — dataset à refaire (BLOQUANT)

Après wipe + `generate-season-picks`, le dataset régénéré est **inexploitable**.
À corriger par un re-run propre **avant** de coder/valider l'Étape 1.

**Couverture native des cotes (channel_selection après re-run)** :

| Canal    | total  | with_odds | with_ev                |
| -------- | ------ | --------- | ---------------------- |
| EV       | 272    | 272       | 272                    |
| SAFE     | 326    | 326       | 326                    |
| DOMINANT | 14 576 | 1 479     | 1 479                  |
| BTTS     | 6 203  | **2**     | 2                      |
| DRAW     | 409    | 409       | 0 (signal = implicite) |

**Problème 1 — duplication ~15×.** 47 286 `model_run` pour **3 027 fixtures**
distinctes (toutes phase `ADVANCE` ; 1 à 21+ runs/fixture). `analyzeFixture` crée
un `model_run` neuf à chaque appel (non idempotent sans `--skip-existing`) →
`generate-season-picks` a tourné plusieurs fois. Chaque doublon recrée
`channel_decision` + `channel_selection` (14 576 DOMINANT pour 3 027 fixtures) →
**calibration et ROI faussés** (même match compté ~15×). Les `bet` EV/SAFE sont OK
(dédupliqués par `@@unique([fixtureId, pickKey, userId])`).

**Problème 2 — couverture cotes quasi nulle.** Des 3 027 fixtures analysées,
**1 087 ont des cotes 1X2 et 3 des cotes BTTS**. La base contient pourtant des cotes
pour 27 431 (1X2) / 11 405 (BTTS) fixtures → le re-run a analysé un **autre**
ensemble (FINISHED sans cotes). C'est ce qui explique 2 BTTS / 1 479 DOMINANT en
natif vs 1 931 / 4 910 au backfill. **Pas un bug du code B-ODDS** : périmètre +
duplication.

**Requêtes de diagnostic (à rejouer après le re-run propre)** :

```sql
-- couverture native par canal
SELECT cd.channel, COUNT(*) tot, COUNT(cs.odds) with_odds
FROM channel_selection cs JOIN channel_decision cd ON cd.id=cs."channelDecisionId"
GROUP BY cd.channel;
-- duplication : runs par fixture
SELECT COUNT(*) runs, COUNT(DISTINCT "fixtureId") fixtures FROM model_run;
-- overlap analysé × cotes
WITH mr AS (SELECT DISTINCT "fixtureId" FROM model_run)
SELECT (SELECT COUNT(*) FROM mr) analyzed,
       (SELECT COUNT(DISTINCT o."fixtureId") FROM odds_snapshot o JOIN mr ON mr."fixtureId"=o."fixtureId"
        WHERE o.market='ONE_X_TWO' AND o."homeOdds" IS NOT NULL) analyzed_with_1x2;
```

**Correctif (demain)** : re-wipe → `generate-season-picks` **single pass** avec
`--skip-existing`, **scopé aux fixtures qui ont des cotes**. Puis re-vérifier la
couverture avant de coder l'Étape 1.

---

## 4. Plan d'implémentation (ordonné, respecte phases + règles)

Chaque étape réutilise l'existant. **Aucune nouvelle activation sans backtest
séparé par ligue/marché** (règle TODO.md).

> **État courant (juin 2026)** — Le **fil calibration est terminé** : B0 (bug SQL),
> B3 (meanError), B6 (5 canaux), B-ODDS (cote+EV BTTS/DOMINANT), B-TEMP (as-of),
> B-ROI (mesure ROI par canal). Tout vert (typecheck/lint/551 tests). Le backfill
> historique a été lancé ; un **wipe + re-run** du moteur rendra les cotes
> BTTS/DOMINANT natives (backfill alors caduc).
> **Reste, en couche coupon (après le re-run, hors fil calibration)** :
> Étape 1 (EV au cœur), Étape 2 (overround), Étape 4 (profils), Étape 5 (staking),
> Étape 6 (combos même-match), B7 (unification pool). Aucun ne bloque le re-run.

### ✅ Étape 1 — EV au cœur du coupon (corrige B1, B2, B5) — FAIT (2026-06-21)

- ✅ Champ `legEV` sur `ScoredPick`, posé par `scorePicks` via
  `calculateEV(calibratedProbability, oddsSnapshot)` (cote réelle uniquement →
  `null` sinon), tracé dans `featureSnapshot`.
- ✅ `FALLBACK_ODDS` supprimé : `compose()` filtre `oddsSnapshot !== null` avant
  toute combinaison ; `computeCombinedOdds` ne lit plus que des cotes réelles
  (invariant gardé par un throw).
- ✅ `couponEV = calculateEV(jointProbability, combinedOdds)` calculé dans
  `buildCoupon`, filtré `≥ COUPON_PARAMS.minCouponEV` (0.05, à promouvoir par
  backtest Étape 7), tri value-driven `compareCouponsByEV` (EV ↓, proba jointe ↓,
  legs ↑). `couponEV` tracé dans `reasoning`.
- ✅ Tests déterministes : couponEV, ordre par EV ≠ ordre par proba, exclusion
  cote nulle, rejet sous `minCouponEV`. backend typecheck/lint/556 tests verts.

### ✅ Étape 2 — Proba fair marché (corrige B4) — FAIT (2026-06-21)

- ✅ Utils `removeOverround(odds: Decimal[]): Decimal[]` + `bookmakerMargin(odds)`
  dans `betting-engine.utils.ts` (decimal.js, lève sur cote ≤ 1, testés
  valide/invalide/edge — `betting-engine.utils.spec.ts`).
- ✅ `getTodayPool` charge les cotes complètes du marché (`OddsSnapshotLoader.
findLatestOddsSnapshot`, as-of coup d'envoi) ; helper `computeMarketFair`
  reconstitue les issues mutuellement exclusives par marché (1X2, BTTS,
  OVER_UNDER(\_HT), FIRST_HALF_WINNER ; DOUBLE_CHANCE/HTFT skippés) et pose
  `pMarketFair` + `bookmakerMargin` par jambe. `null` si cotes sœurs indispo.
- ✅ `scorePicks` calcule `edge = calibratedProbability − pMarketFair`, le tout
  tracé dans `featureSnapshot` ; `edge`/`pMarketFair` exposés dans `reasoning`
  (value vs marché, pas « car sûr »). backend typecheck/lint/566 tests verts.
- _Limite_ : le loader s'ancre sur les cotes 1X2 — une fixture sans 1X2 n'a pas
  de `pMarketFair` même si BTTS coté. Acceptable (edge `null`, jamais faux).

### ✅ Étape 3 — Calibration de jambe principiée (corrige B3) — FAIT (juin 2026)

- ✅ Le poids fixe 50/50 est remplacé par `clamp(pModel − meanError[market])`
  (`calibrateLegProbability`), `meanError` issu de `CalibrationService` via
  `SignalWindow.marketCalibration`.
- ✅ Fallback sur le blend (`legProbability`) pour marchés non suivis / < 50 paris.
- ✅ Tests unitaires (correction, clamp, double fallback) + `calibratedProbability`
  - `marketMeanError` tracés dans `featureSnapshot` pour audit.
- ✅ **B6 traité** (voir section B6) — les 5 canaux sont calibrés.
- _(Plus tard)_ ML promu hors shadow → brancher la proba corrigée en priorité dans
  `calibrateLegProbability` (point d'extension déjà prévu).

### ✅ Étape 4 — Profils de risque (corrige B8, B9) — FAIT (2026-06-21)

- ✅ Type `CouponProfileBounds` + table `COUPON_PROFILES` (source unique des bornes
  par profil) dans `coupon.constants.ts` :

  | Profil       | Legs | Cote totale | P_coupon min | EV coupon min |
  | ------------ | ---- | ----------- | ------------ | ------------- |
  | `SAFE`       | 2–3  | 1.60–2.50   | ≥ 0.45       | ≥ 0.03        |
  | `BALANCED`   | 2–4  | 2.20–5.00   | ≥ 0.25       | ≥ 0.08        |
  | `AGGRESSIVE` | 3–5  | 4.00–12.0   | ≥ 0.10       | ≥ 0.15        |

  _(valeurs indicatives — **non activées en génération** ; à promouvoir par backtest
  Étape 7.)_

- ✅ `compose(scoredPicks, profile)` paramétré par les bornes du profil (minLegs,
  maxLegs, min/maxCombinedOdds, minJointProbability, minCouponEV). `generateCoupons`
  expose `profile?: CouponProfileName`.
- ✅ **Pas de régression** : `DEFAULT_COUPON_PROFILE` dérive des paramètres
  **backtestés** (`COUPON_PARAMS`) ; la génération live l'utilise tant que la gate
  multi-profil n'est pas verte.
- ✅ B8 levé : `MAX_COUPON_SELECTIONS` documenté comme **plafond de pool par canal**,
  distinct des **jambes de coupon** (`CouponProfileBounds.maxLegs`). Tests profils
  (SAFE court / AGGRESSIVE ≥3 legs + cote haute). backend typecheck/lint/570 tests.

### ✅ Étape 5 — Staking (corrige B10) — FAIT (2026-06-21)

- ✅ Helper pur `recommendedCouponStakePct(coupon, kellyEnabled)` : derrière
  `KELLY_ENABLED`, Kelly fractionnaire sur `(P_coupon, Odd_coupon)` via
  `calculateKellyStakePct` (`KELLY_FRACTION` 0.25, cap `KELLY_MAX_STAKE_PCT` 0.05) —
  **jamais de Kelly inline** ; mise plate `DEFAULT_STAKE_PCT` (1 %) sinon.
- ✅ `CouponService` lit `KELLY_ENABLED` via `ConfigService` et trace
  `recommendedStakePct` + `stakingMode` (`KELLY`/`FLAT`) dans le `reasoning` du
  coupon (pas de colonne dédiée → pas de migration). Tests : flat, Kelly capé,
  quarter-Kelly sous le cap, 0 si Kelly ≤ 0. backend typecheck/lint/574 tests.

### Étape 6 — Combos même-match à value (corrige B11) — optionnel

- Autoriser ≤ 2 marchés même fixture **uniquement** via `COMBO_WHITELIST` +
  `computeJointProbability`, condition `EV joint ≥ seuil ligue`. Conforme
  EVCORE.md § Combos-match.

### Étape 7 — Backtest avant activation

- Rejouer la nouvelle logique sur l'historique, mettre à jour
  `reports/backtest-selected-params.json` et `coupon.constants.ts` (les constantes
  doivent rester des sorties de backtest, pas des réglages manuels).

---

## 5. Ordre de classement final recommandé

Cohérent avec l'ADN EVCore (value d'abord), pas « le plus de matchs » :

```
1. couponEV (robuste : après calibration + retrait overround)
2. Expected Log Growth   (derrière flag, si KELLY_ENABLED)
3. jointProbability      (tie-break)
4. nombre de legs croissant (à EV égal, le plus court gagne)
```

Règle produit à graver (reformulation EVCore de la conclusion ChatGPT) :

> Un bon coupon n'est pas celui qui a le plus de matchs ni le plus « sûr ».
> C'est celui qui conserve une **EV positive après calibration, retrait de la
> marge bookmaker, corrélation et cote réelle** — sinon `NO_COUPON`.

---

## 6. Anti-objectifs (à refuser explicitement)

- Introduire Elo/Glicko, Dixon-Coles manuel, ou un modèle ML dans le module coupon.
- Réimplémenter EV ou Kelly inline (réutiliser `calculateEV` / `calculateKellyStakePct`).
- Calculer une EV sur une cote fallback inventée.
- Activer un profil/canal sans backtest séparé vert.
- `p1 × p2` pour deux marchés du même match.
