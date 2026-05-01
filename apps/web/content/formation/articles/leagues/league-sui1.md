---
title: "Super League suisse (SUI1)"
category: leagues
difficulty: beginner
slug: league-sui1
summary: "première division suisse, championnat équilibré avec une dominance à domicile marquée sur les favoris. Le modèle trouve un signal unique et robuste : les victoi"
related: ["leagues-intro"]
---

**Profil :** première division suisse, championnat équilibré avec une dominance à domicile marquée sur les favoris. Le modèle trouve un signal unique et robuste : les **victoires à domicile** sur une large fenêtre de cotes (1.80–2.99). L'EV calculé est plafonné à 0.30 — au-dessus, le modèle sur-estime systématiquement. Backtest validé le 30 avril 2026 (Brier 0.644, ROI **+42.1 %**, 15 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Victoire à domicile** — cotes **1.80 à 2.99** — rendement observé **+42.1 %** sur 15 paris (11V/4D)
  - Favoris courts [1.80–1.99] : 9 paris, 7V/2D, **+45.8 %** ROI — le segment le plus solide
  - Favoris moyens [2.00–2.99] : 6 paris, 4V/2D, **+36.5 %** ROI — signal complémentaire

### ⚠️ À surveiller

- ⚠️ Volume attendu : **4 à 6 paris par saison** — sélection stricte, ne pas forcer
- ⚠️ Le moteur ne joue que les HOME avec EV ≤ 30 % — au-delà, le modèle se trompe structurellement

### 🔴 À éviter

- 🔴 **Victoire à domicile avec EV > 30 %** — sur-confiance systématique : 0V/5D sur 3 saisons ; le moteur l'élimine automatiquement
- 🔴 **Victoire à domicile à cotes ≥ 3.00** — 1 pari perdu (EV gonflé à 88 %) — désactivé
- 🔴 **Match nul** — 0V/1D, aucun signal exploitable ; désactivé
- 🔴 **Victoire à l'extérieur** — résultats fortement négatifs (-40 % ROI simulé)

> **En pratique :** SUI1 est une ligue mono-signal : **domicile favori entre 1.80 et 2.99**. Si l'EV affiché dépasse 30 %, le moteur rejette automatiquement le pick. Ne jamais chercher à jouer les nuls ou l'extérieur dans cette ligue.
