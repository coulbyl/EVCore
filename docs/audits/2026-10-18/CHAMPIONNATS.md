# Faut-il désactiver des championnats ? (2026-10-18)

Question de l'utilisateur : certains championnats nous tirent-ils vers le
bas, et en les désactivant aurait-on moins de décisions et de coupons
perdus ? Mesures sur le dump de production du 2026-10-16, sélections des
canaux affichés à cote ≤ 1,80 (ce qu'on propose), réglées, une ligne par
pari réel.

## 1. Oui, sur 90 jours, des championnats sont en dessous

Les dix moins bien calibrés (réel / annoncé, 90 jours, n ≥ 60) :

| Championnat              |   n | Réel / annoncé | Retour par jambe |
| ------------------------ | --: | -------------: | ---------------: |
| Veikkausliiga (Finlande) | 251 |           0,83 |          −15,0 % |
| K League 1               | 174 |           0,84 |          −11,8 % |
| I Liga (Pologne)         | 201 |           0,86 |          −10,6 % |
| 3. Liga (Allemagne)      | 163 |           0,87 |          −11,3 % |
| Serie B (Italie)         | 155 |           0,87 |          −10,1 % |
| Úrvalsdeild (Islande)    | 244 |           0,88 |          −12,8 % |
| Liga MX                  | 224 |           0,89 |          −10,1 % |
| Primeira Liga            | 246 |           0,89 |          −15,1 % |
| Ekstraklasa              | 240 |           0,90 |          −10,3 % |
| Ykkösliiga (Finlande)    | 190 |           0,90 |           −4,7 % |

Et les mieux : Ligue 1 (1,08), Segunda División (1,08), Czech Liga (1,06),
Champions League (1,06), Jupiler Pro League (1,03), Brasileirão (1,03).
L'écart-type d'un ratio à n ≈ 200 est de 0,04 à 0,05 : l'écart entre les
extrêmes (0,83 contre 1,08) dépasse le bruit.

## 2. Mais ça ne persiste pas

Le même calcul en deux périodes disjointes, juillet–août puis
septembre–octobre, sur les 52 championnats ayant au moins 40 sélections
dans chacune : **corrélation 0,06** entre les deux classements. Le
classement d'une période ne dit rien de la suivante.

Les dix pires de juillet–août, revus en septembre–octobre :

| Championnat                  | Juil.–août | Sept.–oct. |
| ---------------------------- | ---------: | ---------: |
| K League 1                   |       0,76 |       0,91 |
| I Liga                       |       0,79 |       0,91 |
| Veikkausliiga                |       0,80 |       0,87 |
| Ekstraklasa                  |       0,81 |       0,95 |
| Úrvalsdeild                  |       0,85 |       0,93 |
| 1. Lig (Turquie)             |       0,86 |       0,94 |
| Pro League (Arabie saoudite) |       0,86 |   **1,06** |
| 2. Bundesliga                |       0,87 |   **0,99** |
| League One (Chine)           |       0,88 |   **1,01** |
| Premiership (Écosse)         |       0,88 |       0,91 |

Tous remontent vers la moyenne, trois passent au-dessus de 1.

## 3. Ce qu'une désactivation aurait donné

Désactiver en septembre les dix pires de juillet–août :

|                         | Sélections | Réel / annoncé | Retour par jambe |      Perdues |
| ----------------------- | ---------: | -------------: | ---------------: | -----------: |
| Championnats désactivés |      1 509 |          0,953 |           −5,3 % |   465 (31 %) |
| Championnats gardés     |      9 295 |          0,978 |           −4,0 % | 2 783 (30 %) |

On aurait retiré 14 % des sélections, dont 1 044 gagnantes, pour un taux de
perte quasi identique (31 % contre 30 %) et 2,5 points de calibration, à la
limite du bruit. Ne garder que les dix meilleurs de juillet–août aurait fait
**pire** (0,955) que tout garder.

C'est le résultat déjà mesuré le 2026-09-16 sur championnat × marché
(corrélation −0,02 entre périodes) : ce qui persiste, c'est le coût d'un
marché, pas la qualité d'un championnat.

## 4. Réponse

Non. Une désactivation par championnat retire du volume, donc des coupons
certains jours, sans réduire la part de pertes. Ce qui protège déjà :

- la pastille de confiance et l'éligibilité des combinés sont calculées par
  **canal × compétition sur 90 jours glissants** — un canal qui dérive sur
  un championnat sort de lui-même des sélections mises en avant et des
  coupons, et y revient quand il se redresse ;
- le plancher de cote à 1,20 et la garde « jouable chez 1xBet » (même
  rapport, `COTES-JOUABLES.md`) retirent les jambes qui perdaient le plus.

Le seul signal qui vaudrait une action : un championnat sous 0,85 sur
**deux** périodes disjointes. Aujourd'hui aucun ne l'est. À revérifier
fin novembre avec le même rejeu.
