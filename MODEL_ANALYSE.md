# Analyse — Audit moteur 10→13 avril 2026

## Vue d'ensemble

| Date  | Fixtures | BETs | Gagnés    | Perdus | Win rate |
| ----- | -------- | ---- | --------- | ------ | -------- |
| 10/04 | 19       | 4    | 1         | 3      | 25%      |
| 11/04 | 86       | 31   | (partiel) | —      | —        |
| 12/04 | 44       | 9    | 3         | 6      | 33%      |
| 13/04 | 7        | 0    | —         | —      | —        |

---

## 1. Le moteur analyse-t-il toutes les possibilités ?

Oui, mais avec un **espace limité à 10 picks par match**. Pour chaque fixture, il évalue exactement 10 picks (triés par qualité) et les passe à travers les filtres. Les données montrent que le moteur est cohérent dans sa logique d'exclusion. Mais il y a des angles manquants.

**Ce qui est évalué :**

- Picks directionnels : V1, V2, NUL, et leurs combinaisons (V1/V1, V2/V2, NUL/V2…)
- Totaux : MOINS/PLUS DE 1.5, 2.5, 3.5
- Mi-temps : MT V1, MT V2, MT NUL, PLUS DE 1.5 MT, PLUS DE 0.5 MT
- Combinés : V1 + BB OUI/NON, V2 + PLUS DE 2.5…

**Ce qui est absent de l'espace de recherche :**

- Handicap asiatique
- Scores exacts (probablement volontaire)
- Combinés 3+ facteurs

---

## 2. Problèmes identifiés

### A. `lineMovement` systématiquement à `0.0000`

C'est le signal le plus flagrant sur les 4 jours. Sur **100% des fixtures examinées**, le facteur shadow `lineMovement` est à `0.0000`. Soit la source de cotes live n'est pas branchée pour ce facteur, soit le calcul du mouvement retourne toujours neutre.

```
lineMovement  : 0.0000   ← identique partout, 10/04 → 13/04
h2h           : variable (0.0 → 1.0)
congestion    : 0.0000   ← quasi-toujours absent aussi
```

Le "sharp money" (mouvement de cote pré-match) est le signal de marché le plus informatif — le moteur le manque complètement en prod.

---

### B. Biais fort vers les "Under" — avec xG mal calibrés

Les BETs sélectionnés sont quasi-exclusivement des `MOINS DE 2.5` ou `MOINS DE 1.5 MT`, même quand les λ attendus approchent 3 buts :

| Match                          | λ combiné | Bet          | Résultat        |
| ------------------------------ | --------- | ------------ | --------------- |
| Paderborn vs Magdeburg (12/04) | λ=2.99    | MOINS DE 2.5 | **PERDU** (4-3) |
| Pachuca vs Santos (12/04)      | λ=2.57    | MOINS DE 2.5 | **PERDU** (4-2) |
| Pumas vs Mazatlan (12/04)      | λ=2.80    | MOINS DE 2.5 | **PERDU** (3-1) |
| Marseille vs Metz (10/04)      | λ=2.78    | MOINS DE 2.5 | **PERDU** (3-1) |
| Twente vs Volendam (10/04)     | λ=3.23    | MOINS DE 2.5 | **PERDU** (3-2) |

Avec λ=2.57–2.99, la prob Poisson "Under 2.5" oscille entre 42–52%. L'EV est positif seulement si la cote du bookmaker sous-estime cette prob. Mais les vrais scores montrent que le modèle **sous-estime systématiquement les matchs à buts**.

Cause probable : les λ issus des stats historiques sont trop bas par rapport à la dynamique réelle du match.

---

### C. Bet marginale acceptée — Famalicao vs Moreirense (10/04)

```
MOINS DE 1.5  Prob.: 31.3%  EV: +0.091  Qualité: 0.0626  PERDU
```

Qualité `0.0626` est très basse. Le moteur a parié sur un pick avec seulement 31% de probabilité et EV à peine au-dessus du seuil minimum (`+0.08`). Match finit 1-1 → 2 buts, perdu.

> Ce bet ne devrait probablement pas passer le filtre qualité. Y a-t-il un seuil minimum de `qualité` dans le betting engine ?

---

### D. EV très élevé rejeté par plafond dur

Plusieurs picks à EV `+0.8` → `+1.7` sont rejetés `"EV au-dessus du plafond dur"`. C'est correct comme protection anti-anomalie de cote. Mais certains cas sont à distinguer du vrai plafond dur.

**Exemple — Levante vs Getafe (13/04) :**

```
V2 + PLUS DE 2.5  EV: +0.7310  P: 24.8%  Viable pick-level, mais NO_BET (score modèle < 0.58)
```

Ce pick est bloqué par le **score modèle trop bas (0.415)**, pas par le plafond dur. Le label dans le rapport est donc trompeur — la raison réelle est la confiance insuffisante du modèle sur ce match.

---

### E. Volume élevé de picks "Viable pick-level, mais NO_BET (score modèle < X)"

Sur le 13/04 seul :

- **Levante vs Getafe** : 5 picks bloqués par score modèle (EV entre +0.19 et +0.73)
- **Valladolid vs Eibar** : 6 picks bloqués (EV entre +0.18 et +0.82)
- **Fiorentina vs Lazio** : 2 picks bloqués (EV +0.15 à +0.19)

Le moteur _voit_ des opportunités mais les refuse parce que le score de qualité du match est insuffisant. C'est la bonne architecture — mais ça soulève la question : **pourquoi ces matches ont-ils un score si bas ?** Manque de stats historiques ? xG proxy utilisé à la place du xG natif ?

---

## 3. Ce que le moteur fait bien

- **Cohérence des filtres** : chaque rejet est tracé avec sa raison. Zéro pick accepté par inadvertance.
- **Évaluation exhaustive des 10 candidats** : chaque fixture passe par le même pipeline.
- **Plafond dur EV** : évite les anomalies de cote (cotes mal calibrées par le bookmaker).
- **Rejet probabilité directionnelle** : refuse V1/V2 quand la prob n'est pas assez directionnelle. Protège contre les paris contre-nature.

---

## 4. Priorités d'investigation

### 🔴 Critique

1. **`lineMovement` à 0** — Vérifier pourquoi le facteur ne se calcule jamais. Est-ce que l'ETL odds charge bien les snapshots avant/après pour calculer le delta ?

### 🟠 Important

2. **Filtre qualité minimum pour les bets** — Le bet Famalicao (qualité `0.0626`) devrait être bloqué. Vérifier s'il existe un seuil minimum de `qualité` dans le betting engine, et si oui lequel.
3. **Biais Under** — Les λ Poisson sous-estiment-ils les matchs à buts ? Vérifier la calibration sur les matchs avec λ > 2.5 dans le backtest EPL de référence.

### 🟡 À surveiller

4. **Matches avec score < seuil mais EV solide** — Les seuils par compétition (LDC/Europa → 0.45, ligues domestiques → 0.58–0.62) sont-ils encore bien calibrés sur les nouvelles données prod ?

accès db si necessaire : DATABASE_URL=postgresql://postgres:postgres@localhost:5432/evcore
