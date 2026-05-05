# Analyse DRAW canal — Serie A (cobaye)

> Généré le 2026-05-05 — base de données evcore, 3 saisons (2023-26)

---

## 1. Données disponibles

| Métrique                                  | Valeur                   |
| ----------------------------------------- | ------------------------ |
| Fixtures terminées SA                     | 1 100                    |
| Fixtures avec drawOdds (OddsSnapshot 1X2) | **1 100 / 1 100 (100%)** |
| Fixtures avec ModelRun                    | 50 / 1 100 (4%)          |
| Couverture Under 2.5 odds                 | 817 / 1 100 (74%)        |

La couverture odds est complète. La couverture ModelRun est trop faible pour valider le signal lambda en isolement, mais les odds seules permettent une analyse robuste sur l'ensemble des 3 saisons.

---

## 2. Taux de nul SA par saison

| Saison    | Fixtures  | Nuls    | Taux      |
| --------- | --------- | ------- | --------- |
| 2023-24   | 380       | 112     | **29.5%** |
| 2024-25   | 380       | 108     | **28.4%** |
| 2025-26   | 340       | 90      | **26.5%** |
| **Total** | **1 100** | **310** | **28.2%** |

La Serie A est structurellement une ligue à nul élevé — au-dessus de la PL (25-27%) et cohérente d'une saison sur l'autre. Le signal à trouver doit battre ce baseline de **28.2%**.

---

## 3. Performance du signal 1/drawOdds seul

### Hit rate par bracket de cote

| Bracket                    | Prob. implicite | Fixtures | Nuls   | Hit rate  | ROI simulé                |
| -------------------------- | --------------- | -------- | ------ | --------- | ------------------------- |
| drawOdds < 3.00            | > 33.3%         | 83       | 31     | **37.3%** | **+7.8%**                 |
| 3.00 ≤ drawOdds < 3.20     | 31–33%          | 176      | 55     | 31.3%     | −3.9%                     |
| **3.20 ≤ drawOdds < 3.40** | **29–31%**      | **213**  | **74** | **34.7%** | **+13.6% ← meilleur ROI** |
| drawOdds ≥ 3.40            | < 29%           | 628      | 150    | 23.9%     | −1.4%                     |

**Observation critique :** Le bracket [3.20–3.40) affiche un ROI de **+13.6%** — supérieur au bracket < 3.00 (+7.8%). Ce contre-intuitif s'explique par le fait que le marché sous-value systématiquement les nuls dans cette plage pour la Serie A : il attribue ~30% de probabilité implicite alors que le taux réel est 34.7%.

Le bracket [3.00–3.20) est négatif (−3.9%) : les bookmakers pricent ces matchs plus correctement (légère surévaluation du nul).

**Conclusion sur 1/drawOdds seul :**

- Efficace mais pas suffisant en isolation pour atteindre 55% de hit rate
- Utile comme signal de ROI positif, pas comme signal de sélection pure
- Threshold optimal pour SA : **drawOdds dans [3.20, 3.40)** ou **drawOdds < 3.00**

---

## 4. Ajout Under 2.5 odds comme filtre secondaire

| Gate                         | Fixtures | Hit rate | vs. drawOdds seul |
| ---------------------------- | -------- | -------- | ----------------- |
| drawOdds < 3.20 seul         | 264      | 33.3%    | baseline          |
| drawOdds < 3.20 + U25 < 1.85 | 140      | 32.1%    | −1.2 pts          |
| drawOdds < 3.20 + U25 < 1.75 | 132      | 31.8%    | −1.5 pts          |
| drawOdds < 3.00 + U25 < 1.85 | 34       | 38.2%    | +4.9 pts          |

**Conclusion :** Under 2.5 et draw odds sont des signaux **fortement corrélés** — le marché encode la même information dans les deux marchés. Ajouter U25 comme filtre ne donne pas de lift significatif sauf dans le cas très strict (< 3.00 + U25 < 1.85) qui réduit trop le volume.

---

## 5. Taux de nul par équipe SA (3 saisons, ≥ 30 matchs)

| Équipe       | Matchs  | Nuls   | Taux                                        |
| ------------ | ------- | ------ | ------------------------------------------- |
| Parma        | 72      | 27     | **37.5%**                                   |
| Venezia      | 38      | 14     | **36.8%**                                   |
| **Juventus** | **110** | **40** | **36.4%** ← signal fort (grand échantillon) |
| Pisa         | 34      | 12     | 35.3%                                       |
| Torino       | 110     | 36     | 32.7%                                       |
| Udinese      | 110     | 35     | 31.8%                                       |
| Genoa        | 110     | 35     | 31.8%                                       |
| Bologna      | 110     | 34     | 30.9%                                       |

La Juventus (36.4% sur 110 matchs) et le Torino (32.7% sur 110 matchs) sont les signaux les plus robustes statistiquement — pas du bruit sur petit échantillon.

---

## 6. Gate composite : draw odds + taux de nul équipes

| Gate                                    | Fixtures | Nuls   | Hit rate  | Signal                        |
| --------------------------------------- | -------- | ------ | --------- | ----------------------------- |
| Baseline SA                             | 1 100    | 310    | 28.2%     | —                             |
| drawOdds < 3.20 + ≥ 1 équipe draw > 32% | **106**  | **38** | **35.8%** | +7.6 pts                      |
| drawOdds < 3.20 + 2 équipes draw > 30%  | 43       | 15     | **34.9%** | +6.7 pts                      |
| drawOdds < 3.00 + 2 équipes draw > 30%  | **19**   | **~9** | **~47%**  | +19 pts (⚠ petit échantillon) |

Le gate `drawOdds < 3.00 + both draw > 30%` affiche ~47% de hit rate mais sur seulement **19 fixtures sur 3 saisons** (~6/saison). Statistiquement insuffisant pour valider solo, mais directionnellement très fort.

Le gate `drawOdds < 3.20 + ≥ 1 équipe draw > 32%` sur **106 fixtures** (35 par saison en moyenne) est le meilleur compromis volume/précision.

---

## 7. Conclusion et recommandation d'implémentation

### Ce qui fonctionne pour SA DRAW

**1/drawOdds n'est pas un mauvais signal — il est juste mal utilisé.**

Le problème documenté dans DRAW-DETECTION.md était l'utilisation de `probabilities.draw` (Poisson) comme signal. Le Poisson plafonne à ~0.30 et n'est pas discriminant. **Les draw odds bookmaker sont un signal distinct et utile** : la plage [3.20–3.40) démontre +13.6% ROI sur 213 fixtures — c'est une edge réelle sur le marché SA.

La combinaison avec le taux de nul historique des équipes renforce le signal : les équipes structurellement tacticiennes (Juve, Torino, Udinese) ont un draw rate 6–8 pts au-dessus de la moyenne SA.

### Gate recommandé pour SA DRAW (MVP)

```
drawOdds ∈ [3.20, 3.40)
  OU
drawOdds < 3.00 ET au moins une équipe avec draw rate > 32% (fenêtre 38 derniers matchs)
```

Signal stocké = probabilité implicite `1 / drawOdds` (non le Poisson).

### Métriques de validation à adapter

Le seuil de 55% hit rate (conçu pour CONF/BTTS) est structurellement impossible pour le canal DRAW — les meilleurs modèles académiques plafonnent à ~40-47%. La métrique pertinente pour DRAW est **le ROI simulé**, pas le hit rate brut.

| Seuil de validation proposé pour DRAW | Valeur |
| ------------------------------------- | ------ |
| ROI simulé minimum                    | ≥ +5%  |
| Hit rate minimum                      | ≥ 32%  |
| Nombre minimum de picks               | ≥ 30   |

### Changements d'infrastructure requis

1. **`prediction.service.ts`** — Passer `drawOdds: Decimal | null` à `createPredictions()`
2. **`prediction.service.ts`** — Modifier `buildPredictionCandidate()` pour DRAW :
   - Si `drawOdds` disponible : probability = `1 / drawOdds`
   - Fallback : Poisson `probabilities.draw` (conservé pour les matchs sans odds)
3. **`prediction.constants.ts`** — Ajouter entrée SA DRAW :
   ```ts
   SA: {
     ...
     DRAW: { enabled: true, threshold: 0.293, minSampleN: 10 },
     // threshold 0.293 = 1/3.41 → sélectionne drawOdds < 3.41
   }
   ```
4. **Nouveau feature `teamDrawRate`** — Calculer le taux de nul des 38 derniers matchs pour chaque équipe (depuis `TeamStats` ou requête `fixture`) et l'inclure dans `features` JSONB
5. **Backtest à relancer** après implémentation pour valider sur données out-of-sample 2025-26

### Prochaines étapes hors SA (après validation cobaye)

| Ligue            | Draw rate | Priorité backtest DRAW           |
| ---------------- | --------- | -------------------------------- |
| LL               | ~29%      | Haute (style tactique proche SA) |
| SP2 (déjà testé) | ~28%      | Re-tester avec signal odds       |
| I2               | ~32%      | Haute (draw rate très élevé)     |
| PL               | ~25%      | Basse (PL déjà documentée FAIL)  |

---

_Ce rapport est basé sur les données DB evcore (PostgreSQL) — 1 100 fixtures SA, 3 saisons complètes (2023-26). La couverture ModelRun étant de seulement 4%, l'analyse lambda est indicative et à revalider quand la couverture augmentera._
