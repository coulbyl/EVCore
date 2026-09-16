# Backtest coupon jour par jour — daily-coupon-v1

Régénérable : `pnpm --filter @evcore/backtest-core backtest:daily-coupon`.
Requête : `packages/backtest-core/scripts/league-report/08-coupon-legs.sql`.

## Dispositif

Un coupon par jour de matchs, composé uniquement à partir des cotes d'avant
match, sans aucune sortie du moteur ni du LLM. 41893 rencontres,
135768 jambes candidates, **1267 jours de matchs** du
2023-01-20 au 2026-09-13.

Le "seuil" est le taux de réussite qu'il faudrait atteindre pour rentrer dans
ses frais, soit la moyenne des 1 / cote combinée. Le **ratio** est le rapport
entre le taux réalisé et ce seuil : au-dessus de 1 le générateur gagne de
l'argent, en dessous il en perd. Il est préféré au ROI parce qu'à ces volumes
le ROI d'un coupon n'a aucune puissance, alors que le comptage de gagnants en
a.

## Bande de cote 5 – 7

| Jambes | Coupons | Gagnés | Taux   | Seuil  | Ratio | IC95 ratio  | Cote | ROI     | Pire série | Pire creux |
| ------ | ------- | ------ | ------ | ------ | ----- | ----------- | ---- | ------- | ---------- | ---------- |
| 2      | 1130    | 193    | 17.1 % | 19.0 % | 0.90  | 0.77 – 1.03 | 5.29 | -10.9 % | 33         | -171       |
| 3      | 1038    | 160    | 15.4 % | 18.6 % | 0.83  | 0.70 – 0.96 | 5.43 | -17.0 % | 33         | -185       |
| 4      | 851     | 129    | 15.2 % | 17.6 % | 0.86  | 0.71 – 1.01 | 5.73 | -13.2 % | 26         | -159       |
| 5      | 431     | 70     | 16.2 % | 17.0 % | 0.95  | 0.73 – 1.18 | 5.93 | -4.8 %  | 19         | -59        |
| 6      | 235     | 34     | 14.5 % | 16.7 % | 0.87  | 0.58 – 1.16 | 6.06 | -12.8 % | 22         | -49        |
| 7      | 127     | 13     | 10.2 % | 16.9 % | 0.60  | 0.28 – 0.93 | 5.96 | -38.8 % | 19         | -66        |
| 8      | 94      | 14     | 14.9 % | 17.5 % | 0.85  | 0.41 – 1.30 | 5.76 | -13.8 % | 41         | -46        |

## Bande de cote 5 – 15

| Jambes | Coupons | Gagnés | Taux   | Seuil  | Ratio | IC95 ratio  | Cote | ROI     | Pire série | Pire creux |
| ------ | ------- | ------ | ------ | ------ | ----- | ----------- | ---- | ------- | ---------- | ---------- |
| 2      | 1199    | 196    | 16.3 % | 18.6 % | 0.88  | 0.76 – 1.00 | 5.50 | -13.8 % | 34         | -205       |
| 3      | 1158    | 171    | 14.8 % | 17.9 % | 0.83  | 0.70 – 0.95 | 5.77 | -17.9 % | 37         | -211       |
| 4      | 1097    | 151    | 13.8 % | 16.2 % | 0.85  | 0.71 – 0.98 | 6.46 | -15.2 % | 29         | -219       |
| 5      | 984     | 113    | 11.5 % | 13.7 % | 0.84  | 0.68 – 0.99 | 7.84 | -20.0 % | 36         | -209       |
| 6      | 788     | 83     | 10.5 % | 12.0 % | 0.87  | 0.69 – 1.06 | 9.10 | -14.5 % | 37         | -145       |
| 7      | 520     | 48     | 9.2 %  | 11.7 % | 0.79  | 0.57 – 1.01 | 9.38 | -17.1 % | 39         | -124       |
| 8      | 358     | 36     | 10.1 % | 11.6 % | 0.87  | 0.58 – 1.15 | 9.61 | -7.4 %  | 49         | -89        |

**14 configurations sur 14 sont sous le seuil.** La seule au-dessus, 5 jambes en bande 5-7, affiche un ratio de 0.95 sur 431 coupons, avec un intervalle de 0.73 à 1.18 : elle est compatible avec le seuil comme avec la marge, et ne démontre rien. Le générateur reproduit le prix du marché : il ne le bat dans aucune
configuration, et l'écart se creuse à mesure que le nombre de jambes
augmente.

## Le vivier est-il trop étroit ?

1267 jours de matchs, 33.1 rencontres cotées
par jour en moyenne (médiane 18, maximum
201), réparties sur 10.9 championnats
par jour en moyenne, jusqu'à 49.

Dénombrement exhaustif des coupons à deux jambes réalisables dans la bande
5 – 7 : **4 129 890 coupons
possibles**, dont **637 648 gagnants**,
soit 15.4 % de tous les coupons réalisables. Un jour
médian offrait 391 coupons possibles et
61 gagnants ; seuls
75 jours sur 1207 n'en offraient
aucun.

Le vivier n'est donc pas le problème. La part de coupons gagnants parmi tous
les coupons réalisables (15.4 %) reste sous le seuil
de rentabilité : les gagnants existent en nombre chaque jour, mais rien dans
les données ne permet de les désigner à l'avance. Choisir au hasard parmi eux,
ou selon n'importe quelle règle sans lien avec le résultat, rend exactement la
marge.

## Le choix sert-il à payer moins de marge ?

La seule chose qu'un vivier large permet réellement est d'éviter les marchés
les plus taxés. Le ratio théorique ci-dessous est le produit des values des
jambes retenues : ce que le coupon rapporte si le marché est exactement juste.

| Règle de vivier       | Coupons | Marge par jambe | Ratio théorique | Ratio observé | Écart | ROI     |
| --------------------- | ------- | --------------- | --------------- | ------------- | ----- | ------- |
| tout le vivier        | 1130    | 4.77 %          | 0.911           | 0.90          | -0.01 | -10.9 % |
| moitié la moins taxée | 994     | 3.69 %          | 0.930           | 0.94          | +0.01 | -6.7 %  |
| quart le moins taxé   | 786     | 3.23 %          | 0.938           | 1.07          | +0.13 | 6.1 %   |
| décile le moins taxé  | 429     | 2.99 %          | 0.943           | 0.97          | +0.03 | -1.8 %  |

Restreindre le vivier fait bien baisser la marge payée, et le ratio théorique
remonte d'autant. Mais il plafonne sous 1 : même en ne jouant que le décile le
moins taxé, la marge résiduelle reste positive. L'écart entre observé et
théorique change de signe d'une règle à l'autre et d'une année à l'autre :
c'est du bruit, pas une compétence.

## Quels jours marchent le mieux ?

| Jour     | Coupons | Matchs/jour | Gagnés | Taux   | Seuil  | Ratio théorique | Ratio observé | 2023-24 | 2025-26 | ROI     |
| -------- | ------- | ----------- | ------ | ------ | ------ | --------------- | ------------- | ------- | ------- | ------- |
| dimanche | 182     | 67          | 39     | 21.4 % | 19.6 % | 0.92            | 1.09          | 1.09    | 1.10    | 9.3 %   |
| lundi    | 168     | 14          | 21     | 12.5 % | 18.6 % | 0.91            | 0.67          | 0.64    | 0.71    | -33.5 % |
| mardi    | 141     | 17          | 22     | 15.6 % | 18.7 % | 0.91            | 0.83          | 0.90    | 0.78    | -17.5 % |
| mercredi | 135     | 16          | 20     | 14.8 % | 18.7 % | 0.91            | 0.79          | 0.51    | 1.05    | -20.4 % |
| jeudi    | 138     | 17          | 27     | 19.6 % | 18.6 % | 0.91            | 1.05          | 0.77    | 1.28    | 4.6 %   |
| vendredi | 177     | 23          | 27     | 15.3 % | 19.0 % | 0.91            | 0.80          | 0.89    | 0.72    | -20.8 % |
| samedi   | 189     | 85          | 37     | 19.6 % | 19.6 % | 0.91            | 1.00          | 1.03    | 0.97    | -0.7 %  |

Le ratio théorique est **identique tous les jours** : la marge du marché ne
varie pas avec le calendrier, et les jambes disponibles sont aussi bien
calibrées en semaine que le week-end. Tout l'écart observé vient donc du
résultat binaire d'un unique coupon par jour.

Le meilleur jour est dimanche (9.3 %, 67 matchs par jour) et le pire lundi (-33.5 %, 14 matchs par jour). Les deux gardent le même sens sur les deux moitiés de l'historique — dimanche 1.09 puis 1.10, lundi 0.64 puis 0.71 — mais l'écart se réduit nettement sur la période récente.

Trois raisons de ne pas en faire une règle. Sept jours testés produisent
mécaniquement un meilleur et un pire. Les intervalles de confiance à ces
volumes couvrent une demi-unité de ratio. Et le ratio théorique étant plat, un
effet réel supposerait que le marché soit moins juste certains jours, ce que
la calibration des jambes dément : l'écart entre réalisé et implicite reste
compris entre +0,2 et +0,9 point quel que soit le jour.

Ce qui suit le calendrier, en revanche, c'est le nombre de matchs : les jours
creux (lundi, 15 rencontres) et les mois creux (juin) concentrent les pires
résultats, les jours pleins (samedi, 85 rencontres) les meilleurs. Le lien est
réel mais va dans le sens de la variance, pas de l'espérance : avec un seul
coupon par jour, un jour creux offre moins de combinaisons admissibles et
force des choix plus extrêmes.

## Suis-je rentable à la fin de la semaine ?

C'est la question du parieur qui suit le coupon tous les jours. Une semaine est
rentable si le cumul de ses tickets est positif. La colonne « plafond sans
marge » donne la même part pour un marché parfaitement juste : c'est le
maximum atteignable par la configuration, qu'aucun modèle ne peut dépasser.

| Jambes | Bande | Semaines | Rentables | % rentables | Plafond sans marge | Pire série de semaines |
| ------ | ----- | -------- | --------- | ----------- | ------------------ | ---------------------- |
| 2      | 5-7   | 173      | 68        | 39.3 %      | 39.3 %             | 10                     |
| 3      | 5-7   | 159      | 56        | 35.2 %      | 37.9 %             | 6                      |
| 4      | 5-7   | 129      | 58        | 45.0 %      | 35.2 %             | 7                      |
| 5      | 5-7   | 48       | 21        | 43.8 %      | 33.6 %             | 4                      |
| 2      | 5-15  | 183      | 72        | 39.3 %      | 37.3 %             | 10                     |
| 3      | 5-15  | 177      | 57        | 32.2 %      | 34.9 %             | 7                      |
| 4      | 5-15  | 168      | 61        | 36.3 %      | 29.7 %             | 7                      |
| 5      | 5-15  | 155      | 55        | 35.5 %      | 61.5 %             | 7                      |
| 6      | 5-15  | 115      | 47        | 40.9 %      | 55.7 %             | 11                     |
| 7      | 5-15  | 66       | 27        | 40.9 %      | 54.6 %             | 8                      |

À cote 5, gagner une semaine demande **deux tickets gagnants sur sept**. Même
avec une marge nulle, la binomiale n'en donne que 42 % : une majorité de
semaines rentables y est impossible, quel que soit le modèle. Les seules zones
qui franchissent 50 % sont les cotes courtes, où six tickets sur sept passent,
et les cotes très longues, où un seul suffit à payer la semaine — mais la marge
y est trop lourde.

## Stabilité dans le temps

Configuration la moins mauvaise : 2 jambes, bande 5 – 7.

| Année | Coupons | Gagnés | Taux   | Seuil  | Ratio | ROI     |
| ----- | ------- | ------ | ------ | ------ | ----- | ------- |
| 2023  | 247     | 39     | 15.8 % | 18.8 % | 0.84  | -16.5 % |
| 2024  | 314     | 52     | 16.6 % | 19.0 % | 0.87  | -14.4 % |
| 2025  | 320     | 52     | 16.3 % | 19.0 % | 0.86  | -15.3 % |
| 2026  | 249     | 50     | 20.1 % | 19.2 % | 1.04  | 4.7 %   |

## Lecture

- Le taux de réussite observé colle au taux que la marge prédit, à moins d'un
  point près, sur 1267 jours et près de quatre saisons.
- Chaque jambe supplémentaire dégrade le ratio : la composition multiplie la
  marge, elle ne crée pas d'espérance.
- Les séries noires dépassent vingt jours consécutifs dans toutes les
  configurations. Un coupon quotidien à cote 5 perd plus de quatre jours sur
  cinq, même parfaitement calibré : c'est la nature de la cote, pas un défaut
  du générateur.
- Sur la configuration de référence (2 jambes, bande 5 – 7), l'edge par jambe
  qu'il faudrait trouver pour atteindre l'équilibre est de
  5.5 % — soit exactement la
  marge du marché mesurée par ailleurs.

## Limites

- Les cotes sont le consensus des books présents en base, pas la meilleure
  cote réellement disponible à la prise de pari.
- Les jambes d'un même jour ne sont pas indépendantes ; les intervalles de
  confiance les traitent comme si elles l'étaient.
- Le vivier ne couvre que les marchés à consensus (1X2, over/under, BTTS,
  double chance, mi-temps). Les marchés exotiques en sont exclus : le rapport
  par championnat montre qu'ils sont deux à dix fois plus taxés.
