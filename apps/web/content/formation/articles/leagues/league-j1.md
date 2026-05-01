---
title: "J.League (J1)"
category: leagues
difficulty: beginner
slug: league-j1
summary: "championnat japonais difficile à calibrer (plancher Brier théorique ≈ 0.655, supérieur au seuil européen standard). Le seul signal fiable détecté est le marché "
related: ["leagues-intro"]
---

**Profil :** championnat japonais difficile à calibrer (plancher Brier théorique ≈ 0.655, supérieur au seuil européen standard). Le seul signal fiable détecté est le marché **Plus de buts à cotes serrées (2.00–2.09)**. Le 1X2 est entièrement désactivé — le modèle sur-prédit les victoires à domicile de manière structurelle. Backtest validé le 25 avril 2026 (Brier 0.666, ROI +30.2 %, 10 paris sur 4 saisons).

### 🟢 À jouer

- 🟢 **Plus de buts (OVER 2.5)** — cotes **2.00 à 2.09** — rendement observé **+12.6 %** sur 9 paris (5V/4D) — signal principal et unique

### ⚠️ À surveiller

- ⚠️ Volume très faible : **2 à 3 paris par saison** — signal sélectif, ne pas forcer
- ⚠️ ROI inter-saisons variable : S1 +35.5 %, S2 0.0 %, S3 -100 % (1 seul bet) — échantillon petit, prudence

### 🔴 À éviter

- 🔴 **Victoire à domicile (1X2 HOME)** — 46 bets 19V/27D (-6.3 % ROI) sur 4 saisons, taux de victoire allant de 18 % à 59 % selon la saison — désactivé dans le moteur
- 🔴 **Match nul et Victoire à l'extérieur** — aucun edge stable détecté, désactivés
- 🔴 **Plus de buts — cotes < 2.00** — 19 bets 8V/11L (-23.4 % ROI) ; le marché est trop efficace à cotes courtes
- 🔴 **Moins de buts, BTTS, Vainqueur mi-temps** — désactivés

> **En pratique :** Uniquement le **OVER 2.5 entre 2.00 et 2.09**. Ne jamais jouer le 1X2 en J.League — le modèle n'a pas de signal stable sur cette direction malgré les cotes apparemment intéressantes.
