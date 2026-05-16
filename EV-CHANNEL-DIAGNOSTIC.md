# EV / SV Channels — Diagnostic live (mai 2026)

> Basé sur 25 bets résolus sur la période 10–15 mai 2026.
> Outil de référence : `pnpm --filter @evcore/db db:audit:fixtures [YYYY-MM-DD]`

---

## 0. Vision produit — Modèle d'investissement

EVCore n'est pas un service de pronostics. C'est un **instrument d'investissement** à destination d'investisseurs, calqué sur la logique boursière :

- Les clients sont des **investisseurs**, pas des parieurs
- Chaque canal est une **stratégie** avec un profil rendement/risque défini
- La performance se mesure sur la **durée et la constance**, pas sur un coup

### Canaux principaux (portefeuille "core")

| Canal                     | Rôle                            | Cible HR | Analogie bourse              |
| ------------------------- | ------------------------------- | -------- | ---------------------------- |
| **SV** (Safe Value)       | High confidence + edge positif  | ≥ 60%    | Obligations investment grade |
| **BB** (Both Teams Score) | Signal probabiliste fort        | ≥ 65%    | ETF sectoriel stable         |
| **DC** (Double Chance)    | Couverture risque, odds réduits | ≥ 72%    | Fonds à capital protégé      |

### Canal secondaire (allocation spéculative)

| Canal                   | Rôle                         | Profil                                      |
| ----------------------- | ---------------------------- | ------------------------------------------- |
| **EV** (Expected Value) | Valeur pure, variance élevée | Haut risque / haut rendement — usage limité |

**Conséquence directe** : les efforts d'optimisation doivent cibler SV, BB, et DC en priorité absolue. EV reste utile mais ne peut pas être le canal de confiance d'un investisseur.

---

## 1. Résultats live par canal

| Canal    | Bets résolus | WON | LOST | Hit rate                      |
| -------- | ------------ | --- | ---- | ----------------------------- |
| **EV**   | 25           | 10  | 15   | **40%** ❌                    |
| **SV**   | 17           | 11  | 6    | **65%** ✅                    |
| **BB**   | 23           | 16  | 7    | **70%** ✅                    |
| **CONF** | 17           | 6   | 11   | **35%** ❌                    |
| **NUL**  | 2            | 2   | 0    | **100%** (trop faible volume) |

Le canal EV perd de l'argent en live malgré un ROI backtest de +2.28%. SV et BB fonctionnent.

---

## 2. Patterns de défaillance identifiés

### 2.1 Picks à probabilité < 50% sélectionnés par défaut

Le moteur ne garde qu'un pick par fixture (règle anti-corrélation). Quand le meilleur pick est rejeté (cote trop haute, EV au-dessus du plafond), le moteur prend le suivant même si sa probabilité est inférieure à 50%.

Exemples observés :

```
MT V2    P: 32.6%  Cote: 3.82  EV: +0.247 → PERDU
V1 / V1  P: 34.4%  Cote: 3.25  EV: +0.118 → PERDU
PLUS DE 3.5  P: 46.8%  Cote: 2.42  EV: +0.133 → PERDU
```

**Problème** : un pick à 32% de probabilité doit avoir une cote ≥ 3.12 pour être à l'équilibre. Le moteur accepte ces picks parce que le calcul EV est positif, mais les probabilités du modèle Poisson sont surestimées sur ces marchés.

### 2.2 Under 2.5 sélectionné quand xG ≥ 2.3

Le modèle génère des probabilités de 47–54% sur MOINS DE 2.5 pour des matchs où son propre λ prédit 2.5–2.8 buts. C'est une contradiction interne : le modèle parie contre sa propre prédiction de buts.

Exemples :

```
MOINS DE 2.5  P: 47%   xG=2.80  EV: +0.410 → PERDU
MOINS DE 2.5  P: 49.9% xG=2.68  EV: +0.201 → PERDU
MOINS DE 2.5  P: 54%   xG=2.52  EV: +0.458 → GAGNÉ (cas limite)
```

La Poisson distribution génère ~50% autour du seuil 2.5 quand λ_total ≈ 2.5, mais les bookmakers ont des modèles plus précis sur ces cas-limites. Le moteur perd l'edge.

### 2.3 Marchés HT/FT et mi-temps mal calibrés

Sur les matchs très déséquilibrés (ex : λV1=3.01, λV2=0.69), le modèle Poisson bivarié génère des probabilités très élevées pour des issues comme V1/V1 ou MT V1, et donc des EV astronomiques (+1.60, +2.99...) que le hard cap rejette correctement comme suspects.

Mais le pick de substitution qui passe le filtre (ex : PLUS DE 3.5, MT V2) hérite d'un modèle bivarié non calibré en live sur les marchés mi-temps.

```
V1 / V1  P: 60.1%  Cote: 4.33  EV: +1.604 → Rejeté (EV trop haut) ← correct
PLUS DE 3.5  P: 54.7%  EV: +0.597 → sélectionné à la place → GAGNÉ (par chance ?)
```

```
V2 / V2  P: 17.6%  Cote: 26.00  EV: +3.578 → Rejeté
MT V2    P: 26.2%  Cote: 9.44  EV: +1.474 → Rejeté
MOINS DE 3.5  P: 52.4%  EV: +0.660 → Rejeté (EV insuffisant)
UNDER_4_5  P: 71.4%  Cote: 2.08  EV: +0.485 → sélectionné
```

---

## 3. Causes racines

| #   | Problème                                                                           | Localisation probable                                 |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| A   | Pas de filtre minimum probabilité sur canal EV                                     | `BettingEngineService` — sélection picks              |
| B   | Pas de garde `xG > seuil → rejeter Under 2.5`                                      | `BettingEngineService` — filtres marché               |
| C   | Modèle Poisson bivarié non calibré sur marchés HT/FT en live                       | `betting-engine.utils.ts` — `computeJointProbability` |
| D   | Sélection par qualityScore du "meilleur pick restant" sans plancher de probabilité | `BettingEngineService` — logique anti-corrélation     |

---

## 4. Corrections envisagées

### Fix A — Plancher probabilité minimum sur EV (priorité haute)

Rejeter tout pick EV avec probabilité < 40% (à valider en backtest).

```ts
// Dans la boucle de sélection EV
if (pick.probability < EV_MIN_PROBABILITY_THRESHOLD) {
  // rejectionReason: 'probability_too_low'
  continue;
}
```

Constante à définir dans `config/ev.constants.ts` :

```ts
EV_MIN_PROBABILITY_THRESHOLD: 0.4;
```

### Fix B — Garde Under 2.5 / xG (priorité haute)

Rejeter MOINS DE 2.5 si λ_total (xG Poisson) ≥ seuil configurable.

```ts
if (
  market === "OVER_UNDER" &&
  pick === "UNDER" &&
  lambdaTotal >= UNDER_2_5_LAMBDA_REJECT_THRESHOLD
) {
  // rejectionReason: 'under_high_lambda' (déjà existant pour UNDER, à étendre)
  continue;
}
```

Constante : `UNDER_2_5_LAMBDA_REJECT_THRESHOLD: 2.3` (à calibrer)

### Fix C — Filtre marchés HT/FT sur ligues non calibrées (priorité moyenne)

Désactiver les marchés `HALF_TIME_FULL_TIME` et `FIRST_HALF_WINNER` pour les ligues secondaires (SWE1, NOR1...) où le modèle n'a pas assez de données historiques pour calibrer la décomposition mi-temps.

### Fix D — Score qualité plancher avant sélection fallback (priorité moyenne)

Quand le pick prioritaire est rejeté, le pick de substitution ne doit être pris que si son qualityScore dépasse un seuil minimum, pas juste parce qu'il est "le meilleur restant".

---

## 5. Questions ouvertes

- [ ] Combien de bets EV seraient éliminés par Fix A (simulation sur données historiques) ?
- [ ] Quel est le ROI réel pondéré par les cotes (pas juste hit rate) sur ces 25 bets ?
- [ ] Est-ce que le canal CONF est aussi défaillant pour les mêmes raisons que EV (sélection par défaut) ?
- [ ] Le `shadow_h2h=+1.0000` sur plusieurs matchs (1 seul H2H dispo) signale-t-il un manque de données fiable ?

---

---

## 7. Biais Under sur le canal SV

### Observation

Le canal SV génère structurellement beaucoup de picks Under 3.5. Depuis l'ajout du marché Under 4.5, le modèle bascule vers Under 4.5 sur les mêmes matchs. C'est un drift de sélection, pas un gain d'information.

**Le problème logique** : si le modèle est assez confiant pour parier Under 4.5 (λ_total ≈ 3.5–4.5), ça signifie qu'il prédit beaucoup de buts. Dans ce cas, un Over 2.5 ou Over 3.5 sur le même match a potentiellement un meilleur ratio qualité/risque — cote plus haute, probabilité solide, odds bookmaker moins efficient.

### Exemple typique

Supposons λV1=2.1, λV2=1.8 → xG=3.9 :

```
Under 4.5  P: 76%  Cote: ~1.22  EV: faible, qualityScore: faible
Over 2.5   P: 82%  Cote: ~1.35  EV: similaire, qualityScore: similaire
Over 3.5   P: 58%  Cote: ~1.90  EV: potentiellement meilleur
```

Le moteur sélectionne Under 4.5 parce que sa probabilité est plus élevée — mais qualityScore = EV × deterministicScore, et l'EV sur un Under 4.5 à 1.22 est structurellement pauvre.

### Cause

La sélection SV actuelle choisit le pick avec le meilleur qualityScore parmi les picks viables. Sur les matchs à λ élevé, Under 4.5 passe les filtres avec une très haute probabilité mais sans que ses voisins (Over 3.5, Over 2.5) soient évalués à la même hauteur dans la comparaison finale.

### Fix envisagé — Comparaison symétrique Over/Under pour λ élevé

Quand un pick Under 3.5 ou Under 4.5 est viable, forcer l'évaluation des Over correspondants (Over 2.5, Over 3.5) et retenir le meilleur qualityScore entre les deux directions.

Condition déclenchante :

```ts
if (market === "OVER_UNDER" && (pick === "UNDER_3_5" || pick === "UNDER_4_5")) {
  // évaluer aussi OVER_2_5 et OVER_3_5 sur ce même match
  // sélectionner le pick avec le meilleur qualityScore global
}
```

Seuil λ à partir duquel déclencher la comparaison : `λ_total ≥ 3.0` (configurable).

### Questions ouvertes

- [ ] Quelle est la répartition Under 3.5 / Under 4.5 / Over dans les bets SV résolus ?
- [ ] Est-ce que Over 3.5 sur les mêmes matchs aurait eu un meilleur ROI historique ?
- [ ] La règle `under_high_lambda` existante couvre-t-elle déjà Under 3.5 ou seulement Under 2.5 ?

---

---

## 8. Stratégie d'optimisation des canaux core (SV / BB / DC)

### 8.1 Canal SV — axe de travail

Objectif : hit rate ≥ 60% stable, drawdown max < 10 unités sur 50 bets.

- Corriger le biais Under (section 7) — comparer Over vs Under à λ élevé
- Ajouter un filtre de cohérence `deterministicScore ≥ seuil ligue` avant sélection SV
- Évaluer si le marché Double Chance capte mieux certains profils de matchs qu'un Under 3.5

### 8.2 Canal BB — axe de travail

Déjà à 70% HR → consolider sans introduire de variance.

- Ne pas baisser les seuils de probabilité BTTS par ligue pour augmenter le volume
- Surveiller la dégradation si le modèle est activé sur des ligues sans historique suffisant
- Valider que BB et DC ne se cannibalisent pas sur le même match (anti-corrélation)

### 8.3 Canal DC (Double Chance) — opérationnel ✅ (16 mai 2026)

**Bug corrigé** : `extractDoubleChanceOdds` attendait `'Home/Draw'` / `'Draw/Away'` / `'Home/Away'` mais l'API-Football retourne `'Home'` et `'Away'`. Résultat : 0 odds DC en base depuis le lancement.

**Fix appliqué** :

- Labels corrigés → `'Home'` = 1X, `'Away'` = X2
- `'12'` rendu optionnel (non fourni par l'API) — skippé proprement par le moteur
- Pas de live odds DC — prematch uniquement, suffisant
- Sources : Bet365 (ID 8) et Unibet (ID 16) — Pinnacle et Marathonbet n'ont pas DC

**Après re-sync prematch** : 39 fixtures avec odds DC (Bet365) + 37 (Unibet). 2 premiers picks DC générés :

```
Orlando City vs Atlanta   X2  P=57.1%  Cote=2.38  EV=+0.360  [EV]
Almeria vs Las Palmas     X2  P=53.6%  Cote=3.00  EV=+0.607  [EV]
```

**À faire** :

- [ ] Mesurer HR et ROI DC sur volume suffisant (30+ picks)
- [ ] Décider si DC doit aller dans le canal SV quand P ≥ seuil (ex : DC 1X avec P ≥ 72%)
- [ ] Ajouter DC dans l'affichage de l'audit script (section dédiée)

### 8.4 Métriques de suivi — analogie boursière

Pour chaque canal, suivre :

| Métrique        | Description                    | Cible                        |
| --------------- | ------------------------------ | ---------------------------- |
| Hit rate        | % picks corrects               | SV ≥ 60%, BB ≥ 65%, DC ≥ 72% |
| ROI (unités)    | Profit net / nombre de picks   | ≥ 0% sur 50+ bets            |
| Drawdown max    | Perte consécutive max (unités) | < 10 unités                  |
| Volatilité      | Écart-type des résultats       | À mesurer                    |
| Sharpe analogue | ROI / volatilité               | ≥ 1.0                        |

---

## 6. Prochaines étapes

**Priorité 1 — Canaux core**

1. Audit DC sur les dernières semaines (volume + HR + ROI)
2. Fix biais Under SV (section 7) — backtest avant déploiement
3. Tableau de bord ROI/drawdown par canal visible sur `c-evcore.com`

**Priorité 2 — Canal EV** 4. Fix A (plancher probabilité) + Fix B (garde Under/xG) — backtest 3 saisons 5. Réévaluer le canal CONF (même diagnostic Under/fallback à faire)

**Priorité 3 — Volume** 6. Générer l'audit sur 30+ jours pour atteindre un volume statistiquement significatif par canal
