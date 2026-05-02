---
title: "Lire un pick dans l'app"
category: bases
difficulty: beginner
order: 7
readTime: 5
slug: comment-lire-un-pick
summary: "Décrypter les informations d'une carte pick : badge canal, EV, probabilité estimée, cote, et section 'Pourquoi ce pick ?'."
updatedAt: "2026-05-02"
related:
  [
    "les-3-canaux",
    "ev-probabilites-cotes",
    "cotes-probabilites-implicites",
    "guide-picks-du-jour",
  ]
---

## Les éléments d'une carte pick

Chaque pick affiché dans l'app comporte les mêmes informations de base :

```
🟡 EV  •  Arsenal vs Chelsea

Victoire Arsenal
EV : +14,7 %   Probabilité estimée : 58 %   Cote : 2,10

[ + Coupon ]
```

### Le badge canal

- 🟡 `EV` — signal Expected Value (rendement long terme)
- 🟢 `SV` — signal Safe Value (probabilité plus élevée, moins de variance)
- 🔵 `CONF` — signal Confiance (V1 ou V2 prédits avec probabilité estimée)

### La sélection

Le marché recommandé : victoire domicile, plus de 2,5 buts, les deux équipes marquent, etc.

### L'EV signé

`+14,7 %` signifie que le modèle évalue ce pari 14,7 % au-dessus de son prix de marché. En théorie, sur un grand nombre de paris similaires, tu gagnes en moyenne +14,7 % par unité misée.

Ce n'est pas une promesse sur ce match précis. C'est une mesure de valeur statistique.

### La probabilité estimée vs la cote

- Probabilité estimée : **58 %** (ce que le modèle calcule)
- Cote 2,10 → probabilité implicite : `1 ÷ 2,10 = 47,6 %`

L'écart (58 % − 47,6 % = 10,4 %) est la source de l'EV positive. Plus l'écart est large, plus l'EV est haute.

### La cote affichée

La cote est extraite d'un snapshot pris au moment de l'analyse. Avant de miser, vérifie que ton bookmaker propose bien cette cote — elle peut avoir bougé.

## La section "Pourquoi ce pick ?"

En ouvrant le détail d'un pick EV ou SV, quatre barres de facteurs s'affichent :

| Facteur               | Ce qu'il mesure                                 |
| --------------------- | ----------------------------------------------- |
| Forme récente         | Résultats des 5 derniers matchs                 |
| Expected Goals (xG)   | Qualité des occasions créées / concédées        |
| Avantage dom. / ext.  | Impact du terrain pour cette équipe             |
| Stabilité de la ligue | Régularité des résultats dans cette compétition |

Vert = facteur favorable, ambre = neutre, rouge = défavorable. Un pick EV peut avoir des facteurs mitigés — c'est l'EV globale qui détermine la sélection, pas chaque facteur pris séparément.

## Les matchs "Passer" (NO_BET)

Un match analysé qui n'a aucun signal EV ni SV reçoit la décision `Passer`. Ça signifie que le modèle n'a pas détecté de valeur suffisante selon ses critères — pas que le match est injouable.

Tu peux toujours ouvrir le diagnostic du match, lire les analyses de chaque marché et décider de placer un pari si tu as ta propre conviction. Tous les marchés analysés sont consultables et plaçables depuis le diagnostic, quelle que soit la décision du modèle.

> `Passer` = le modèle ne recommande pas. Toi, tu décides.

## Prochaine étape

Les erreurs à éviter avant et après avoir misé : `erreurs-frequentes`.
