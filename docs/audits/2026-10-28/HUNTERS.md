# Chasseurs BTTS, Nul et Score exact : première lecture

_28/10/2026, lot 2 (`docs/plan-lot-2-2026-10-28.md`, étape 7). Même copie de prod que les autres études du jour : 116 jours, du 01/07 au 24/10. Script : `scripts/hunters.py`, sortie : `scripts/hunters-out.txt`._

Un chasseur, c'est un produit sur un seul marché : une sélection par jour dans la bande de cote du marché, ou l'abstention. Bandes : BTTS « oui » de 1,45 à 1,90, nul de 2,90 à 3,60, score exact de 5 à 12. Les matchs « Données suspectes » sont exclus.

On mesure, jambe par jambe, l'écart entre le réalisé et la probabilité du marché sans marge, avec son intervalle à 95 %.

## Réponse courte

1. **Aucun classement ne bat le marché de façon mesurable.** Avec une sélection par jour, il n'y a qu'une centaine de jambes par variante, et les intervalles font ±8 à ±10 points. Les chasseurs sont montrés tout de suite (décision du 28/10 : pas d'ombre) et mesurés en direct.
2. **Pour le nul, prendre le nul « le plus probable » est une mauvaise règle.** Il réalise 6,4 points sous le marché, pour un coût de −24 %. Le nul le moins cher reste à −1,1 point, pour un coût de −7 %. Sur tout ce qui est coté dans la bande, le marché tombe juste (28,6 % annoncés, 28,6 % réalisés).
   - **Décision :** la variante « prix » classe désormais par la marge la plus basse, puis par la probabilité.
   - Ce choix ne vient pas de ce rejeu, où les deux règles restent dans le bruit. Il vient du seul résultat qui persiste d'une période à l'autre : le coût du marché (r = +0,70, `ESPACE-OPPORTUNITES.md`).
3. **Le canal Nul du moteur annonce trop.** Il annonce 31,4 % et réalise 22,5 %. Le rapport réalisé ÷ annoncé vaut 0,72, sous la porte de 0,90, et il est mauvais sur les deux périodes (0,68 puis 0,75). Le classement « moteur » n'est donc pas retenu pour le nul.
4. **BTTS ne départage rien.** Toutes les variantes sont dans le bruit, et leurs deux moitiés de période se contredisent. On garde la même règle que pour le nul (la moins chère), et la mesure en direct tranchera.
5. **Score exact : le marché tombe juste.** Sur nos scores retenus à cote 5–12 (5 577 réglés en 120 jours), 13,5 % d'implicite brut, 10,6 % une fois retirée la marge de la grille (27 %, médiane de la grille de 25 scores de Marathonbet), 11,1 % réalisés. Le moteur annonce 13,0 %. Le chasseur prend le score retenu par le moteur sur chaque match et classe par la probabilité du marché : « gagne environ 1 fois sur 9 », pire série longue (57 jours mesurés le 23/10).

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

## Ce qui est montré aux joueurs

Chaque jour, `CouponHunterGenerationService` écrit trois coupons à une jambe, montrés sur Coupons comme les autres, avec la fréquence du marché, la pire série et « Suivre ce coupon » :

- **Chasseur Les deux marquent** (cote 1,45–1,90) : la marge la plus basse, puis la probabilité du marché. Source `PRICE_COMPOSER`, `targetOddsMin` 1,45.
- **Chasseur Match nul** (2,90–3,60) : même règle. Source `PRICE_COMPOSER`, `targetOddsMin` 2,90.
- **Chasseur Score exact** (5–12) : le score retenu par le moteur sur chaque match, classé par la probabilité du marché. Source `ENGINE`, `targetOddsMin` 6.

Chaque passe enregistre sa tentative (ou son abstention). Le règlement et la CLV par jambe existants s'appliquent.

## À relire

Vers le 10/12, en même temps que le combiné et Notre sélection : réalisé ÷ annoncé et écart au marché, jambe par jambe, sur `coupon_proposal` par `targetOddsMin` (1,45, 2,90, 6). Sous 0,90 de réalisé ÷ annoncé sur au moins 100 jambes, on règle la bande ou le classement.
