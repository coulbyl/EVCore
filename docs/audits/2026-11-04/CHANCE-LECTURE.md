# Chance de la lecture : moteur ou marché (04/11)

_Copie de prod du 03/11. Matchs finis du 01/09 au 02/11._

## Méthode

La règle de `readingOf` rejouée en dehors du backend : dernière analyse avant le coup d'envoi de chaque match (une lecture par match, jamais `channel_selection` brut), choix de rang 1 des canaux de lecture (`READING_CHANNELS`), sans AVOID ni marché suspendu, coté chez 1xBet à 1,20 ou plus (dernier prix d'avant coup d'envoi) ; lecture parlante à 10 points près, sinon la meilleure. Pour la lecture retenue : la chance du moteur (`channel_selection.probability`) et la fréquence du marché sans marge (Shin sur le groupe complet du même book, au même relevé que la cote affichée, comme `PlayableOddsRepository`). 2 715 lectures réglées (gagné/perdu).

## Réalisé ÷ annoncé

| Cote        | n     | Réalisé | Moteur annonce | Moteur ratio  | Marché annonce | Marché ratio  |
| ----------- | ----- | ------- | -------------- | ------------- | -------------- | ------------- |
| 1,20 – 1,45 | 2 204 | 73,6 %  | 77,8 %         | 0,945 ± 0,011 | 73,5 %         | 1,002 ± 0,013 |
| 1,45 – 1,80 | 390   | 64,1 %  | 71,3 %         | 0,899 ± 0,032 | 59,8 %         | 1,071 ± 0,041 |
| > 1,80      | 121   | 35,5 %  | 46,4 %         | 0,765 ± 0,092 | 36,9 %         | 0,963 ± 0,116 |

Même sens sur les deux moitiés de la période (avant / après le 05/10) : moteur 0,90 et 0,95 sur 1,20–1,45, 0,90 et 0,90 sur 1,45–1,80 ; marché 0,97 et 1,01, 1,07 et 1,07.

Le marché est le plus proche de 1 dans les deux tranches. Sur 1,45–1,80 il sous-annonce (1,07), d'un écart plus petit que la sur-annonce du moteur (0,90), et ce côté-là ne fait pas promettre au joueur plus qu'il ne gagne.

**Décision** : la lecture affiche la fréquence du marché à toutes les cotes. Le moteur choisit toujours la lecture (sur sa chance jusqu'à 1,80, comme avant) ; un choix sans fréquence du marché est écarté, jamais montré avec la chance du moteur. La phrase sous la lecture ne change pas. Les coupons (`legChanceOf`) gardent la chance du moteur jusqu'à 1,80 : à relire de la même façon.

## Plancher de chance

Distribution des lectures par fréquence du marché :

| Chance    | Lectures       | Réalisé | Annoncé |
| --------- | -------------- | ------- | ------- |
| < 35 %    | 56 (2,1 %)     | 23,2 %  | 27,4 %  |
| 35 – 40 % | 8 (0,3 %)      | 25,0 %  | 37,0 %  |
| 40 – 45 % | 23 (0,8 %)     | 52,2 %  | 42,8 %  |
| 45 – 50 % | 24 (0,9 %)     | 45,8 %  | 47,5 %  |
| 50 – 60 % | 188 (6,9 %)    | 60,1 %  | 56,3 %  |
| 60 – 70 % | 632 (23,3 %)   | 67,9 %  | 66,0 %  |
| 70 – 80 % | 1 759 (64,8 %) | 74,6 %  | 74,8 %  |
| ≥ 80 %    | 25 (0,9 %)     | 92,0 %  | 80,5 %  |

Sous 40 % : 64 lectures (2,4 %), réalisé 23,4 % ; sous 45 % (87), 49 nuls et 27 « moins de 2,5 buts » cotés haut : souvent le seul choix du moteur au-dessus de 1,20 quand ses autres choix sont cotés sous 1,20 (Detroit City – Hartford, 31/10 : nul à 3,04, 31 % ; moins de 3,5 buts à 1,14, double chance 1X à 1,17). La distribution se creuse entre 35 et 45 % (31 lectures) avant le corps à 60–80 % (88 %).

**Décision** : `READING_MIN_CHANCE = 0.4` (`config/screens.constants.ts`). Un choix sous ce seuil est écarté ; sans autre choix, le match passe « Pas de lecture · aucune chance assez sûre ».
