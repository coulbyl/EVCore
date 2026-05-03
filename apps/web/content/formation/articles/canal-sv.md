---
title: "Canal Sécurité (SV) : moins de variance, signal plus robuste"
category: bases
difficulty: beginner
order: 5
readTime: 4
slug: canal-sv
summary: "Le Canal SV applique un double filtre — EV positive et probabilité élevée — pour réduire la variance sans abandonner la valeur."
updatedAt: "2026-05-02"
related: ["canal-ev", "canal-confiance", "bankroll-unites-discipline"]
---

## Même logique, filtre plus strict

Le Canal Sécurité (SV pour Safe Value) repose sur la même base que le Canal EV : il ne sélectionne que les paris à EV positive.

La différence : il applique un **deuxième filtre sur la probabilité estimée**. Seuls les marchés où la probabilité est suffisamment haute pour absorber une erreur de calibration du modèle sont retenus. Un pick peut avoir une EV positive sans avoir de signal SV — l'inverse est impossible.

## Ce que ça change concrètement

|                          | Canal EV    | Canal SV     |
| ------------------------ | ----------- | ------------ |
| Taux de réussite typique | 50 – 60 %   | 65 – 75 %    |
| EV par pick              | Plus élevée | Plus modérée |
| Variance court terme     | Élevée      | Faible       |
| Volume de picks          | Modéré      | Plus rare    |
| Cotes typiques           | 1,80 – 4,00 | 1,40 – 2,20  |

Le Canal SV produit moins de picks. Chacun a une EV un peu inférieure à ceux du Canal EV, mais la probabilité estimée plus haute réduit les séries négatives.

## Exemple : deux signaux sur le même match

Sur un match, le moteur peut générer à la fois un signal EV et un signal SV sur deux marchés différents :

- **Signal EV** : Victoire extérieure, probabilité 55 %, cote 2.20 → EV +21 %
- **Signal SV** : Plus de 1,5 but, probabilité 72 %, cote 1.65 → EV +18,8 %

Les deux sont valables. Le signal SV a une EV légèrement inférieure mais une probabilité bien plus haute.

## Quand privilégier SV

Choisis le Canal SV si :

- tu démarres et que les séries négatives affectent ta discipline
- ta bankroll est limitée et tu ne peux pas absorber un drawdown important
- tu veux un taux de réussite visible au quotidien

À long terme, Canal EV pur peut dépasser Canal SV en rendement total. Le choix dépend de ta tolérance à la variance, pas d'une supériorité absolue de l'un sur l'autre.

## Prochaine étape

Le troisième canal, orienté prédiction pure : `canal-confiance`.
