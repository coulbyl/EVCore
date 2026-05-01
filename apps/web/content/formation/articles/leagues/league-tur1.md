---
title: "Süper Lig (TUR1)"
category: leagues
difficulty: beginner
slug: league-tur1
summary: "première division turque, championnat équilibré avec un rythme de buts plus faible qu'en apparence (lambda calibré à 1.25 — en dessous du défaut européen). Le m"
related: ["leagues-intro"]
---

**Profil :** première division turque, championnat équilibré avec un rythme de buts plus faible qu'en apparence (lambda calibré à 1.25 — en dessous du défaut européen). Le modèle trouve deux signaux complémentaires : les **favoris à domicile à cotes moyennes** et les **Moins de 2.5 buts**. Backtest validé le 30 avril 2026 (Brier 0.605, ROI **+42.5 %**, 13 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Victoire à domicile** — cotes **2.00 à 2.99** — rendement observé **+30.6 %** sur 8 paris (4V/4D) — signal principal
- 🟢 **Moins de 2.5 buts** — cotes **2.00 à 2.99** — rendement observé **+61.4 %** sur 5 paris (4V/1D) — signal secondaire très solide

### ⚠️ À surveiller

- ⚠️ Volume attendu : **4 à 5 paris par saison** — ligue sélective, ne pas forcer
- ⚠️ Le signal **Moins de buts** est le plus rentable mais repose encore sur un échantillon court (5 paris) — à suivre sur la saison en cours

### 🔴 À éviter

- 🔴 **Victoire à domicile — cotes ≥ 3.00** — 1 pari perdu, signal structurellement négatif ; désactivé dans le moteur
- 🔴 **Plus de 2.5 buts (OVER)** — désactivé (0V/2D sur les 3 saisons)
- 🔴 **Victoire à l'extérieur (AWAY)** — résultats catastrophiques constant (-54 % ROI simulé sur les candidats) ; désactivé
- 🔴 **Match nul** — les nuls TUR1 sont trop bien pricés par Pinnacle, aucun edge détecté

> **En pratique :** TUR1 se joue sur deux axes simples : **domicile 2.0–3.0** et **Moins de 2.5 buts**. Ne pas chercher à jouer les outsiders ni les nuls — la ligue est trop homogène pour que le modèle y trouve un edge. Si le moteur ne propose rien, ne pas forcer.
