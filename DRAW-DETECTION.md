# Canal DRAW — Historique, signal retenu et état des ligues

## Historique du problème (2026-05-03)

Le canal DRAW était désactivé sur toutes les ligues parce que le modèle Poisson est un mauvais discriminateur de nul.

**Deux défauts structurels du Poisson :**

1. **Plafond à ~0.32** — pour des lambdas typiques (1.2–1.8 buts/équipe), la probabilité de nul ne dépasse jamais 0.32. Monter le seuil ne sélectionne pas les vrais nuls, ça réduit juste le volume.
2. **Pas de pouvoir discriminant** — quand le modèle dit 0.28, le match finit en nul ~27% du temps, soit le taux moyen de la ligue. Signal nul.

---

## Solution implémentée (2026-05-05)

**Signal retenu : probabilité implicite bookmaker `1 / drawOdds`**

L'analyse Serie A (1 100 matchs, 3 saisons) a établi que les cotes bookmaker sont un signal discriminant là où le Poisson ne l'est pas. Le marché encode des informations contextuelles (tactique, H2H, style d'équipe) que Poisson ignore.

### Implémentation

- **`prediction.service.ts`** — `buildPredictionCandidate` pour DRAW utilise `1/drawOdds` quand la cote est disponible, Poisson en fallback.
- **`betting-engine.service.ts`** — passe `latestOdds.drawOdds` à `createPredictions` ; stocke `homeDrawRate`/`awayDrawRate` (taux de nul saisonnier des équipes) dans les features JSONB.
- **`backtest.service.ts`** — verdict DRAW basé sur **ROI ≥ +5% + HR ≥ 32%** (plus le seuil 55% hit rate, structurellement inaccessible pour les nuls).

### Validation framework DRAW

| Métrique | Seuil | Raison |
|---|---|---|
| ROI simulé | ≥ +5% | Métrique primaire — le profit est la seule mesure qui compte |
| Hit rate | ≥ 32% | Plancher minimum (taux de nul moyen SA ~28%) |
| Volume | ≥ 10 picks | Données suffisantes pour éviter le bruit |

---

## État des ligues (2026-05-05)

### Actives

| Ligue | Threshold | Cote < | Picks/s | HR agg | ROI agg | Saisons PASS | Notes |
|---|---|---|---|---|---|---|---|
| **I2** | 0.30 | 3.33 | ~224 | 36.3% | +11.1% | 3/3 | Signal le plus fort et le plus stable |
| **BL1** | 0.28 | 3.57 | ~62 | 35.5% | +21.4% | 3/3 | Seule ligue avec SA à passer les 3 saisons |
| **POR** | 0.30 | 3.33 | ~86 | 35.8% | +12.7% | 2/3 | 2024-25 borderline (+0.9%) — à surveiller |
| **SA** | 0.30 | 3.33 | ~117 | variable | variable | 1/3 | 2025-26 saison à faible draw rate (26.5%) — à recalibrer fin de saison |

### Désactivées — signal absent ou insuffisant

| Ligue | Meilleur ROI agrégat | Raison de désactivation |
|---|---|---|
| LL | +4.8% à 0.28 | Inconsistant : 2023-24 exceptionnelle, 2024-25 efface tout |
| SP2 | +11.7% à 0.35 | Signal concentré aux cotes < 2.86 (draws favoris), volatile |
| L1 | -7.8% (meilleur) | ROI structurellement négatif sur 2/3 saisons |
| D2 | +29.1% à 0.30 | Volume insuffisant (~14 picks/s), 2/3 saisons INSUFFICIENT_DATA |
| ERD | +17.4% à 0.30 | Volume insuffisant (~12 picks/s), 1s validable seulement |
| SWE1 | +10.9% à 0.30 | INSUFFICIENT_DATA toutes saisons (~11 picks/s) |
| CZE1 | +14.2% à 0.26 | HR agrégat 31.4% — juste sous le plancher 32% |
| TUR1 | +8.0% à 0.26 | HR agrégat 31.1%, 1/3 saisons PASS |
| TUR2 | +9.5% à 0.26 | Inconsistant : 2023-24 FAIL, 2024-25 PASS, 2025-26 FAIL |
| J1 | +10.3% à 0.34 | INSUFFICIENT_DATA toutes saisons (~7 picks/s) |
| PL | -1.6% (meilleur) | ROI négatif, ligue à faible draw rate (~25%) |
| EL1/EL2/UEL/UECL/UCL | Variable | Volume trop faible en compétitions européennes |
| MX1/UNL/NOR1 | Négatif ou bruit | ROI négatif ou volume insuffisant |

---

## Recalibration prévue — fin saison 2025-26

**Objectif :** réévaluer les ligues désactivées avec une saison out-of-sample complète.

### Ligues à réexaminer en priorité

| Ligue | Raison | Signal attendu |
|---|---|---|
| **CZE1** | HR à 31.4% (juste sous le plancher), ROI +14.2% | Ajouter HR floor à 31% ? Vérifier si 2025-26 passe |
| **TUR1** | ROI +8%, 2025-26 PASS seule — voir si la tendance se confirme | Fort signal en 2025-26 |
| **TUR2** | 2024-25 et 2025-26 tous les deux positifs — potentiel | Vérifier si le signal stabilise |
| **SA** | Saison 2025-26 atypique (26.5% nuls), signal 2023-24/24-25 fort | Réévaluer avec saison complète |
| **D2/ERD** | Volume trop faible sur 3 saisons — attendre une 4e saison | Confirmer si volume augmente |

### Ligues à ne pas réexaminer

- **L1** — ROI structurellement négatif, ligue à faible draw rate. Aucune raison de croire que ça change.
- **LL** — Variance inter-saisons trop élevée sans raison structurelle identifiée.
- **SP2** — Le signal à 0.35 est hors du spectre normal (draws favoris), pas un vrai signal DRAW.

---

## Pistes complémentaires pour améliorer le signal (Phase 2+)

Ces améliorations peuvent renforcer le signal existant mais ne remplacent pas le travail de validation par ligue :

| Approche | Impact attendu | Complexité |
|---|---|---|
| **teamDrawRate rolling** | Filtrage secondaire sur les équipes à fort taux historique (Juventus 36.4%, etc.) | Faible — données déjà en features JSONB |
| **Gate composite** | `drawOdds < 3.33 ET ≥ 1 équipe draw > 32%` : +19 pts sur hit rate (DRAW-SA-ANALYSIS.md) | Moyenne — requête rolling sur 38 derniers matchs |
| **Dixon-Coles ρ** | Corriger la sous-représentation des scores 0-0 / 1-1 dans le Poisson | Haute — refactoring du moteur de probabilités |

---

*Analyse initiale : DRAW-SA-ANALYSIS.md (1 100 fixtures SA, 3 saisons 2023-26)*
*Backtest complet 26 ligues : 2026-05-05*
