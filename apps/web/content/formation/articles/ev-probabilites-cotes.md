---
title: "Les bases : probabilités, cotes et EV"
category: bases
difficulty: beginner
order: 5
readTime: 6
slug: ev-probabilites-cotes
summary: "Comprendre l'EV (value) en reliant probabilités et cotes."
updatedAt: "2026-05-01"
related:
  [
    "cotes-probabilites-implicites",
    "erreurs-frequentes",
    "bankroll-unites-discipline",
  ]
---

## Pourquoi on parle d’EV ?

L’EV (Expected Value) mesure la **valeur attendue** d’un pari : si tu pouvais rejouer la même situation un grand nombre de fois, est-ce que tu gagnerais en moyenne ?

En clair : l’EV te dit si le **prix** (la cote) est bon par rapport à la **probabilité**.

## Les 3 ingrédients

1. **Probabilité estimée** (ex: 60%) : la chance de succès _selon le modèle_.
2. **Cote du marché** (ex: 2.10) : ce que le bookmaker “paye” si ça passe.
3. **EV** : la comparaison des deux.

Si tu n’es pas à l’aise avec les cotes, commence par : `cotes-probabilites-implicites`.

## Exemple rapide

Si le modèle estime 60% et que la cote est 2.10 :

```txt
EV = (0.60 × 2.10) - 1 = +0.26
```

Interprétation :

- `+0.26` signifie “+26%” de valeur attendue **par unité** misée (en théorie, sur le long terme).
- ce n’est pas une promesse de gagner “ce soir”.

> À retenir : EV positive = bon pari statistique. Résultat = variance.

## Comment lire l’EV sans formule

Pose-toi cette question :

> “Est-ce que la cote paye assez pour le risque ?”

Si tu as une probabilité estimée “haute” mais une cote trop basse, le pari peut être _sûr_… mais **mal payé**.

## Erreurs classiques

- Confondre “EV positif” et “ça va passer”.
- Changer de stratégie après 2–3 matchs (petit échantillon).
- Sur-miser parce qu’on “le sent bien”.

Pour un checklist simple : `erreurs-frequentes`.

## Suite logique

- Apprendre à lire le prix (cote) : `cotes-probabilites-implicites`
- Garder un cadre de mise : `bankroll-unites-discipline`
