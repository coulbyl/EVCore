---
title: "Les bases : cotes, probabilité implicite et marge (vig)"
category: bases
difficulty: beginner
order: 4
readTime: 6
slug: cotes-probabilites-implicites
summary: "Comprendre ce que “dit” une cote, calculer 1/cote, et pourquoi la marge fausse les probabilités."
updatedAt: "2026-05-01"
related: ["ev-probabilites-cotes", "erreurs-frequentes", "comment-lire-un-pick"]
---

## Pourquoi c’est important

Si tu sais lire une cote, tu comprends déjà **la moitié** d’un pick.

Dans EVCore, on compare en permanence :

- ce que **le modèle pense** (probabilité estimée),
- et ce que **le marché paye** (cote).

## La cote (odds), simplement

En cote décimale :

- une cote de `2.00` signifie : _si je mise 1 et que je gagne, je récupère 2 au total_.
- le gain net est donc `2 - 1 = 1`.

## La probabilité implicite (1 / cote)

La probabilité implicite = la probabilité “cachée” dans la cote.

Formule :

```text
probabilité implicite = 1 / cote
```

Exemples :

- `2.50` → `1 / 2.50 = 0.40` → `40%`
- `1.80` → `1 / 1.80 = 0.555…` → `55.6%`

## La marge (vig) : pourquoi ça ne colle pas à 100%

Un bookmaker ajoute une marge (sa commission).

Sur un marché `1N2` (domicile / nul / extérieur), si tu fais :

```text
(1/homeOdds) + (1/drawOdds) + (1/awayOdds)
```

Tu obtiens souvent `> 1` (ex: `1.04`).  
Ce “surplus” correspond à la marge.

Conséquence : la probabilité implicite est une **approximation**, pas une vérité absolue.

## Exemple guidé (1 minute)

Supposons :

- Home `2.10` → `1/2.10 = 47.6%`
- Draw `3.40` → `29.4%`
- Away `3.60` → `27.8%`

Somme ≈ `104.8%` → marge ≈ `4.8%`.

## Erreurs fréquentes

- Confondre “probabilité implicite” et “probabilité vraie”.
- Oublier que 2.00 ne veut pas dire “50% certain”.
- Comparer des cotes sans regarder le **marché** (1N2 vs Over/Under, etc.).

## À retenir (checklist)

- Une cote décrit _le prix_, pas “la vérité”.
- `1 / cote` te donne une probabilité implicite rapide.
- Sur 1N2, la somme des implicites est souvent `> 100%` : c’est la marge.
- La suite logique : comprendre l’**EV** (valeur attendue).
