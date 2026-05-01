---
title: "Ekstraklasa (POL1)"
category: leagues
difficulty: beginner
slug: league-pol1
summary: "première division polonaise, championnat équilibré. Le modèle identifie un signal HOME rentable sur une fenêtre EV [0.25–0.40), mais la calibration Brier reste "
related: ["leagues-intro"]
---

**Profil :** première division polonaise, championnat équilibré. Le modèle identifie un signal HOME rentable sur une fenêtre EV [0.25–0.40), mais la calibration Brier reste légèrement au-dessus du seuil (0.662 vs 0.65) à cause d'une saison 2025-26 courte et bruitée. En observation — à revalider quand la saison sera plus fournie.

### 🟢 À jouer (sous réserve de confirmation)

- 🟢 **Victoire à domicile** — cotes **2.00 à 2.99**, EV **0.25 à 0.40** — rendement observé **+70 %** sur 7 paris (4V/3D) — à confirmer sur plus de données
- 🟢 **Match nul** — cotes **3.00 à 4.99**, EV **0.10 à 0.25** — rendement observé **+127 %** sur 5 paris (3V/2D) — signal secondaire émergent après correction empirique

### ⚠️ À surveiller

- ⚠️ **Brier 0.662** — légèrement au-dessus du seuil (0.65) ; ligue non encore validée formellement
- ⚠️ Volume : **4 à 5 paris par saison** — sélectif, ne pas forcer
- ⚠️ HOME EV < 0.25 : systématiquement négatif (-30 % ROI sur 12 paris) ; plancher strict dans le moteur
- ⚠️ HOME EV > 0.40 : sur-confiance confirmée (1W/5L, -54.7 %) ; cap strict dans le moteur

### 🔴 À éviter

- 🔴 **Victoire à domicile EV < 0.25** — plancher à 0.25, zone négative sans exception
- 🔴 **Victoire à domicile EV > 0.40** — sur-confiance confirmée ; désactivé dans le moteur
- 🔴 **Victoire à l'extérieur** — aucun edge détecté

> **En pratique :** POL1 est en phase d'observation. Le moteur peut proposer des picks HOME dans la fenêtre [0.25–0.40), mais la ligue n'est pas encore formellement validée. Traiter ces picks avec prudence jusqu'à la revalidation fin de saison.
