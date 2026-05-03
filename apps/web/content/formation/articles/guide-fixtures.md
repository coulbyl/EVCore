---
title: "Utiliser la page Matchs"
category: app
difficulty: beginner
order: 2
readTime: 5
slug: guide-fixtures
summary: "Comment filtrer les matchs, lire les colonnes EV/SV et accéder au diagnostic complet d'un pick."
updatedAt: "2026-05-02"
related: ["guide-picks-du-jour", "comment-lire-un-pick", "canal-ev"]
---

## Vue d'ensemble de la page Matchs

La page **Matchs** (`/fixtures`) liste tous les matchs analysés par le moteur. C'est là que tu peux explorer le contexte complet d'un pick et filtrer selon tes critères.

## Les filtres rapides (presets)

En haut des filtres, 3 raccourcis sont disponibles :

- **Picks EV du jour** — affiche uniquement les matchs du jour avec un signal EV
- **Picks SV du jour** — matchs du jour avec un signal Safe Value
- **Matchs en cours** — matchs actuellement en live

Ces presets ajustent tous les filtres automatiquement.

## Le FilterBar

Les filtres manuels permettent de cibler :

| Filtre      | Options                                       |
| ----------- | --------------------------------------------- |
| Date        | Sélecteur de date                             |
| Compétition | Toutes les ligues disponibles                 |
| Décision    | Jouer / Passer / Tous                         |
| Statut      | Planifié / En cours / Terminé                 |
| Horaire     | Tranches horaires (matin / après-midi / soir) |
| Résultat    | Gagné / Perdu / En attente / Tous             |
| Canal       | EV / Safe Value / Confiance / Tous            |

## Lire le tableau

Chaque ligne de match affiche :

- **Heure + Compétition**
- **Match** (domicile vs extérieur)
- **EV** : valeur attendue en % signé (ex : `+14.7%`)
- **SV** : score Safe Value si signal présent
- **Décision** : badge vert "Jouer" (signal détecté) ou gris "Passer" (pas de signal — le diagnostic reste accessible)
- **Statut** du match et résultat si terminé

### Sous-ligne Safe Value

Quand un match a un signal SV en plus de l'EV, une seconde ligne apparaît avec une bordure teal gauche, montrant le détail du signal SV.

## Le diagnostic d'un match

En cliquant sur une ligne, un **panneau de diagnostic** s'ouvre avec :

1. **Prédiction modèle** — buts estimés dom./ext., probabilité estimée, EV en %
2. **Pourquoi ce pick ?** — barres de contribution des 4 facteurs (forme, xG, dom./ext., volatilité)
3. **Marchés analysés** — tableau de tous les marchés évalués avec leur statut (Viable / rejeté + raison)

> Mode simplifié vs admin : les utilisateurs standard voient les informations lisibles. Les admins voient en plus les données techniques (λ, features JSON).

## Interpréter les raisons de rejet

Quand un marché est "écarté", une icône et un texte expliquent pourquoi :

- `EV trop faible` — le prix n'est pas bon
- `Cote manquante` — l'odds snapshot n'est pas disponible
- `Probabilité trop basse` — le signal manque de conviction
- `Marché suspendu` — la ligue est en phase de recalibration

## À lire ensuite

- Comprendre l'EV d'un pick : `ev-probabilites-cotes`
- Utiliser le coupon : `guide-coupons`
