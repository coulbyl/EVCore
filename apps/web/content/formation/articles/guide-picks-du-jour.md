---
title: "Utiliser la page Picks du jour"
category: app
difficulty: beginner
order: 1
readTime: 4
slug: guide-picks-du-jour
summary: "Comment lire, filtrer et ajouter au coupon les picks générés chaque matin par les 5 canaux."
updatedAt: "2026-05-03"
related: ["guide-fixtures", "comment-lire-un-pick", "canal-ev", "canal-sv"]
---

## La page du matin

La page **Picks du jour** (`/picks`) est l'écran central de l'expérience quotidienne. Elle regroupe les signaux du jour par canal.

Chaque matin, consulte cette page avant les premiers matchs.

## Les 5 sections canal

### Section Canal EV

Les picks avec `EV ≥ 8%`. Chaque carte affiche :

- Le match (domicile / extérieur)
- La sélection recommandée (ex : "Plus de 2.5 buts")
- L'EV en pourcentage signé (ex : `+14.7%`)
- La probabilité estimée vs la cote disponible

**Section "Pourquoi ce pick ?"** — en cliquant sur une carte, tu vois la contribution de chaque facteur :

- Forme récente
- Expected Goals (xG)
- Avantage dom./ext.
- Stabilité de la ligue

### Section Canal SV (Safe Value)

Picks avec signal SV positif. Format identique aux picks EV, avec un badge `SV` teal.

### Section Canal Confiance

Prédictions de résultat (pas de recommandation de mise directe). Affiche le résultat prédit et la probabilité estimée.

### Section Canal NUL

Prédictions dédiées aux matchs nuls. Elles sont séparées du canal Confiance pour rendre ce type de lecture plus visible quand il apparaît.

### Section Canal BB

Prédictions **But-But** : les deux équipes marquent, en `OUI` ou `NON` selon le signal affiché.

## Ajouter un pick au coupon

Sur les picks EV et SV, un bouton **"+ Coupon"** apparaît. Il ajoute directement le pari à ton coupon actif.

Les canaux **Confiance**, **NUL** et **BB** sont d'abord des canaux de lecture et de diagnostic. Ils n'ajoutent pas directement un pari depuis cette page.

> Seuls les paris en statut "À venir" (PENDING) peuvent être ajoutés.

## Suivi post-match

La page se met à jour automatiquement après chaque match (polling toutes les 60 secondes). Les résultats apparaissent avec un badge vert (gagné) ou rouge (perdu).

## Statistiques du jour

En haut de page, 5 StatCards résument la journée :

- **EV** : nombre de picks du canal valeur
- **SV** : nombre de picks du canal Safe Value
- **Confiance** : volume des prédictions 1X2
- **NUL** : volume des signaux dédiés aux matchs nuls
- **BB** : volume des signaux But-But

## Astuce : scroll fixé

La barre de statistiques reste fixée en haut pendant que tu scrolles dans les picks. Pratique pour garder le contexte en vue.

## À lire ensuite

- Comprendre les cotes avant de miser : `cotes-probabilites-implicites`
- Naviguer dans les matchs en détail : `guide-fixtures`
