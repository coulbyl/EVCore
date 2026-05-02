---
title: "Utiliser la page Bankroll"
category: app
difficulty: beginner
order: 3
readTime: 4
slug: guide-bankroll
summary: "Lire le solde, suivre l'évolution, filtrer les transactions et comprendre la projection 30 jours."
updatedAt: "2026-05-02"
related: ["bankroll-unites-discipline", "guide-picks-du-jour"]
---

## Les 3 métriques en haut de page

Au chargement, la page Bankroll affiche 3 statistiques globales :

| Métrique         | Signification                                    |
| ---------------- | ------------------------------------------------ |
| **Solde actuel** | Capital disponible en temps réel                 |
| **Total déposé** | Somme de tous les dépôts (sans les gains/pertes) |
| **ROI net**      | `(solde - déposé) / déposé` sur toute la durée   |

Un ROI net positif signifie que les paris ont généré plus que les dépôts initiaux.

## Filtrer pour analyser une période

Le **FilterBar** sous les statistiques permet de filtrer les transactions par :

- **Date de début / fin** — pour isoler une semaine, un mois
- **Type** — Dépôt, Mise, Gain, Remboursement

Dès que tu appliques un filtre, le **ROI de la période** s'affiche sous le filtre :

```
ROI sur la période : +12.3%
```

Ce ROI est calculé uniquement sur les paris réglés dans la période sélectionnée (mises + gains).

## La courbe d'évolution

Le graphe "Évolution du solde" montre le solde jour après jour, calculé à partir de tes transactions.

### La ligne pointillée

La ligne pointillée prolonge la courbe sur **30 jours** : c'est une **projection** basée sur la tendance récente (pente des 14 derniers jours).

> Cette projection n'est pas une prédiction — c'est une extrapolation linéaire. Elle s'ajuste chaque fois que tu changes la période de filtre.

Une tendance montante → projection montante. Une série de pertes récentes → projection descendante.

## L'historique des transactions

Le tableau en bas liste toutes les transactions avec :

- Date
- Type (Mise / Gain / Dépôt / Remboursement)
- Montant signé
- Match concerné (pour les mises et gains)
- Solde après l'opération

### Canal sur les transactions

Les transactions de type Mise/Gain affichent un badge `EV` ou `SV` selon le canal du pari.

## Dépôt

Le bouton **"Déposer"** ouvre un formulaire pour enregistrer un dépôt dans ta bankroll.

> Un dépôt n'est pas un virement réel — c'est une entrée comptable dans EVCore pour suivre ta performance.

## Devise

La devise affichée (XOF / EUR / USD) se configure dans **Paramètres → Compte → Devise**. Elle s'applique à tous les montants de l'app.

## À lire ensuite

- Gérer sa bankroll en unités : `bankroll-unites-discipline`
- Comprendre les ROI par compétition : guide Performance
