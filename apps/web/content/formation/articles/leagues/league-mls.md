---
title: "Major League Soccer (MLS)"
category: leagues
difficulty: beginner
slug: league-mls
summary: "championnat nord-américain à domicile fort mais irrégulier. Le modèle identifie deux signaux exploitables sur une fenêtre EV étroite : les favoris à domicile à "
related: ["leagues-intro"]
---

**Profil :** championnat nord-américain à domicile fort mais irrégulier. Le modèle identifie deux signaux exploitables sur une fenêtre EV étroite : les **favoris à domicile à cotes moyennes** et **Moins-Moins BTTS NO**. Backtest validé le 30 avril 2026 (Brier 0.430, ROI **+41.3 %**, 12 paris sur 2 saisons).

### 🟢 À jouer

- 🟢 **Victoire à domicile** — cotes **2.00 à 2.99**, EV **0.20 à 0.30** — rendement observé **+38 %** sur 7 paris (4V/3D) — signal principal
- 🟢 **BTTS Non** — cotes **2.00 à 2.99**, EV **0.30 à 0.40** — rendement observé **+82.5 %** sur 4 paris (3V/1D) — signal secondaire très solide

### ⚠️ À surveiller

- ⚠️ Volume attendu : **4 à 6 paris par saison** — ligue sélective, ne pas forcer
- ⚠️ Le signal **BTTS Non** repose sur un échantillon court (4 paris) — valider sur la saison en cours
- ⚠️ La fenêtre EV est étroite (0.20–0.30 pour HOME, 0.30–0.40 pour BTTS NO) — les picks hors fenêtre sont désactivés dans le moteur

### 🔴 À éviter

- 🔴 **Plus de 2.5 buts (OVER)** — désactivé ; sur-confiance détectée à tout niveau d'EV
- 🔴 **Mi-temps (FHW)** — désactivé toutes directions ; résultats catastrophiques (-44 % HOME, -100 % DRAW/AWAY)
- 🔴 **OVER Mi-temps** — désactivé ; aucun edge détecté
- 🔴 **Victoire à domicile EV > 0.30** — sur-confiance confirmée (0V/4D à EV 0.30–0.40) ; cap dur à 0.30
- 🔴 **Match nul / Victoire extérieure** — aucun edge détecté en MLS

> **En pratique :** MLS se joue exclusivement sur **HOME 2.0–3.0 à EV modéré** et **BTTS NO**. La fenêtre est étroite — si le moteur ne propose rien, ne pas forcer.
