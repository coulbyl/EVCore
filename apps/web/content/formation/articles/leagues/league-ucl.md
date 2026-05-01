---
title: "Ligue des Champions (UCL)"
category: leagues
difficulty: beginner
slug: league-ucl
summary: "la compétition la mieux calibrée du système (CalibErr 0.040, Brier 0.614). Le modèle identifie deux signaux complémentaires : la victoire à l'extérieur (signal "
related: ["leagues-intro"]
---

**Profil :** la compétition la mieux calibrée du système (CalibErr 0.040, Brier 0.614). Le modèle identifie deux signaux complémentaires : **la victoire à l'extérieur** (signal principal, +73.7%) et **la victoire à domicile** (signal secondaire, EV ≥ 0.20 uniquement). Backtest validé le 30 avril 2026 (ROI **+64.4 %**, 17 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Victoire à l'extérieur (AWAY)** — cotes **2.00 à 4.99** — rendement observé **+73.7 %** sur 7 paris (4V/3D) — signal principal, outsider tenu en haute estime par le modèle
- 🟢 **Victoire à domicile (HOME)** — cotes **2.00 à 2.99**, EV **≥ 0.20** — rendement observé **+38.3 %** sur 9 paris (4V/5D) — signal secondaire

### ⚠️ À surveiller

- ⚠️ AWAY : fenêtre EV 0.29–0.69 ; au-delà de 0.70, le signal se fragilise (1W/2L dans l'échantillon)
- ⚠️ HOME EV < 0.20 : structurellement négatif (1W/4L, -52.8%) — plancher strict dans le moteur

### 🔴 À éviter

- 🔴 **HOME EV < 0.20** — zone toxique confirmée sur 3 saisons ; désactivé dans le moteur
- 🔴 **Match nul** — bloqué ; 74 candidats analysés sur 3 saisons, 9W/65L (-28.3%)
- 🔴 **Moins de 2.5 buts (UNDER)** — désactivé ; aucun edge structurel détecté
- 🔴 **Mi-temps (FHW)** — sauf cas très rare — trop peu de données pour valider

> **En pratique :** UCL se joue sur **AWAY à cotes moyennes** et **HOME > 2.00 à EV modéré**. Le favoris UCL à courte cote (< 2.00) n'est pas dans le périmètre du moteur — Pinnacle price trop bien les mastodontes.
