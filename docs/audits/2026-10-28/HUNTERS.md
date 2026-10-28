# Chasseurs BTTS et Nul : première lecture avant l'ombre

_28/10/2026, lot 2 (`docs/plan-lot-2-2026-10-28.md`, étape 7). Même copie de prod que les autres études du jour : 116 jours, du 01/07 au 24/10. Script : `scripts/hunters.py`, sortie : `scripts/hunters-out.txt`._

Un chasseur, c'est un produit sur un seul marché : une sélection par jour dans la bande de cote du marché, ou l'abstention. Bandes : BTTS « oui » de 1,45 à 1,90, nul de 2,90 à 3,60. Les matchs « Données suspectes » sont exclus.

On mesure, jambe par jambe, l'écart entre le réalisé et la probabilité du marché sans marge, avec son intervalle à 95 %.

## Réponse courte

1. **Aucun classement ne bat le marché de façon mesurable.** Avec une sélection par jour, il n'y a qu'une centaine de jambes par variante, et les intervalles font ±8 à ±10 points. C'est bien pour ça que l'ombre doit continuer jusqu'à au moins 200 jambes.
2. **Pour le nul, prendre le nul « le plus probable » est une mauvaise règle.** Il réalise 6,4 points sous le marché, pour un coût de −24 %. Le nul le moins cher reste à −1,1 point, pour un coût de −7 %. Sur tout ce qui est coté dans la bande, le marché tombe juste (28,6 % annoncés, 28,6 % réalisés).
   - **Décision :** la variante « prix » classe désormais par la marge la plus basse, puis par la probabilité.
   - Ce choix ne vient pas de ce rejeu, où les deux règles restent dans le bruit. Il vient du seul résultat qui persiste d'une période à l'autre : le coût du marché (r = +0,70, `ESPACE-OPPORTUNITES.md`).
3. **Le canal Nul du moteur annonce trop.** Il annonce 31,4 % et réalise 22,5 %. Le rapport réalisé ÷ annoncé vaut 0,72, sous la porte de 0,90, et il est mauvais sur les deux périodes (0,68 puis 0,75). Le chasseur Nul « moteur » reste en ombre pour être mesuré, sans perspective d'affichage à ce niveau.
4. **BTTS ne départage rien.** Toutes les variantes sont dans le bruit, et leurs deux moitiés de période se contredisent. L'ombre décidera.

## Résultats

« Écart » = réalisé moins probabilité du marché, en points, avec un intervalle à 95 %.

| Chasseur · classement               | Jambes | Cote méd. | Annoncé | Réalisé | Écart au marché | Réalisé ÷ annoncé | Coût au prix d'analyse | Pire série |
| ----------------------------------- | -----: | --------: | ------: | ------: | --------------: | ----------------: | ---------------------: | ---------: |
| BTTS · prix, le moins cher (retenu) |    112 |      1,50 |  59,3 % |  63,4 % |      +4,1 ± 8,9 |              1,07 |                 −0,3 % |          4 |
| BTTS · prix, le plus probable       |    112 |      1,50 |  60,7 % |  67,0 % |      +6,3 ± 8,7 |              1,10 |                 +3,0 % |          4 |
| BTTS · moteur                       |     92 |      1,57 |  63,4 % |  58,7 % |     +0,5 ± 10,1 |              0,93 |                 −5,8 % |          6 |
| BTTS · référence, tout le coté      |  2 945 |      1,67 |  55,6 % |  56,3 % |      +0,7 ± 1,8 |              1,01 |                 −5,9 % |          9 |
| Nul · prix, le moins cher (retenu)  |    112 |      3,28 |  29,6 % |  28,6 % |      −1,1 ± 8,4 |              0,96 |                 −6,9 % |         10 |
| Nul · prix, le plus probable        |    112 |      2,99 |  31,4 % |  25,0 % |      −6,4 ± 8,0 |              0,80 |                −23,9 % |         10 |
| Nul · moteur                        |    102 |      3,20 |  31,4 % |  22,5 % |      −7,2 ± 8,1 |              0,72 |                −28,4 % |          9 |
| Nul · référence, tout le coté       |  1 913 |      3,36 |  28,6 % |  28,6 % |      −0,0 ± 2,0 |              1,00 |                 −4,7 % |         18 |

L'annoncé d'une variante « prix » est la probabilité du marché. Celui de la variante « moteur » est la probabilité du canal, c'est-à-dire ce que le canal affiche sur Décisions.

### Par période (juillet–août, puis septembre–octobre)

| Chasseur · classement   | Écart, juil.–août | Écart, sept.–oct. |
| ----------------------- | ----------------: | ----------------: |
| BTTS · prix, moins cher |       +9,8 ± 11,6 |       −2,6 ± 13,6 |
| BTTS · moteur           |       +2,8 ± 14,0 |       −1,9 ± 14,8 |
| Nul · prix, moins cher  |       −4,4 ± 11,1 |       +2,6 ± 12,7 |
| Nul · plus probable     |       −9,3 ± 10,7 |       −3,3 ± 12,2 |
| Nul · moteur            |       −8,6 ± 11,6 |       −5,9 ± 11,5 |

## Ce qui tourne maintenant en ombre

Chaque jour, `CouponHunterGenerationService` écrit quatre sélections avec `shadow: true`, jamais montrées à un joueur, plus une tentative par passe :

- BTTS, classé par le prix : la marge la plus basse, puis la probabilité. Source `PRICE_COMPOSER`.
- BTTS, classé par le moteur : la probabilité du canal recalée canal × compétition. Source `ENGINE`.
- Nul, classé par le prix. Source `PRICE_COMPOSER`.
- Nul, classé par le moteur. Source `ENGINE`.

Le règlement et la CLV par jambe existants s'appliquent. L'admin voit ces coupons sous l'étiquette « Ombre · chasseur … ».

## Porte d'affichage (décision humaine)

Un chasseur n'est montré que si toutes ces conditions sont réunies :

- au moins 4 semaines d'ombre prospective ;
- au moins 200 jambes réglées en comptant ce rejeu ;
- réalisé ≥ 0,90 × annoncé ;
- une CLV publiée ;
- un accord explicite.

Ce qu'il vendrait alors : une fréquence juste (« gagne environ 1 fois sur 3 » pour le nul), sa pire série (10 jours) et son coût. Jamais un gain.

## À relire

Vers le 10/12, en même temps que le combiné et Notre sélection, sur les propositions en ombre réglées. La requête porte sur `coupon_proposal` avec `shadow = true`, par source et par `targetOddsMin` (1,45 pour BTTS, 2,90 pour le nul).
