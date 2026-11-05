# Combiné du jour et lecture du match (05/11)

_Copie de prod du 05/11, base locale. Lecture seule._

## Méthode

- **Combiné du jour** : les coupons `ENGINE` de cible 1,20–3,40 (`COMBO`), du 13/10 au 05/11 : 23 jours, 52 jambes, 22 jours réglés. Résultat de chaque jambe : `coupon_proposal_leg.isCorrect`.
- **Lecture** : la règle de `readingOf` rejouée hors du backend sur chaque match fini depuis le 01/09. On prend la dernière analyse d'avant le coup d'envoi, le choix de rang 1 des `READING_CHANNELS`, sans AVOID ni marché suspendu (suspensions actives aujourd'hui). Le choix doit être coté à 1,20 ou plus chez 1xBet (dernier relevé d'avant le coup d'envoi, issues du dernier relevé du groupe), avec une fréquence Shin d'au moins 0,40 (`shinOutcomeGroups` de `@evcore/analysis-core`, la double chance lue sur le 1X2). La chance du moteur sert de classement jusqu'à 1,80, la fréquence du marché au-dessus. Une lecture parlante passe devant si elle est à 10 points au plus de la meilleure. On obtient 2 702 lectures.
- **Ratio** : réalisé ÷ annoncé par jambe, avec un IC à 95 % (√Σp(1−p) / Σp). Les jambes VOID sont exclues du ratio. Dans un coupon, une jambe VOID compte comme passée.
- **Limite** : la lecture rejouée voit le dernier prix et la dernière analyse d'avant le coup d'envoi, alors que le combiné est composé la veille à 17 h. Les deux ne voient donc pas le même état du marché.

## 1. Divergence entre jambe et lecture

Sur 52 jambes : 3 portent le même pari que la lecture, **44 divergent**, 5 matchs n'ont pas de lecture.

| Sur les 44 jambes divergentes    | Réalisé | Annoncé | Ratio         |
| -------------------------------- | ------- | ------- | ------------- |
| Jambe du combiné (moteur)        | 84,1 %  | 85,8 %  | 0,980 ± 0,119 |
| Lecture du même match (marché)   | 54,5 %  | 73,1 %  | 0,746 ± 0,178 |

Résultats discordants : la jambe perd et la lecture gagne **1 fois**, la jambe gagne et la lecture perd **14 fois**. La plainte ne se vérifie pas en moyenne, mais l'incohérence entre les deux paris est réelle (85 % des jambes).

**Cardiff – West Ham (04/11, 3-3).** La jambe était « Cardiff moins de 2,5 buts » (TEAM_TOTAL_HOME UNDER_2_5), à 1,18 chez 1xBet, perdue. La lecture rejouée est la double chance 12 à 1,21 (fréquence du marché 0,777), elle aussi perdue sur le nul. Si l'écran montrait autre chose au moment de la capture, c'est qu'il lisait un état antérieur, que la base ne garde pas. Pour PSV – Bruges, jambe et lecture sont le même pari : double chance 12.

### Cause : trois règles différentes

1. **Plancher de cote.** Le combiné applique 1,20 sur la cote de référence (`channel_selection.odds`, celle du book de l'analyse) et seulement `OPERATOR_MIN_ODDS = 1,10` chez 1xBet (`playableAtOperator`). La lecture exige 1,20 chez 1xBet (`MIN_LEG_ODDS`). Résultat : **37 des 41 jambes cotées chez 1xBet y sont sous 1,20** (médiane 1,15, de 1,04 à 1,29). Ces paris sont, par construction, exclus de la lecture.
2. **Tri à la cote la plus basse.** `eligibleComboLegs` trie par cote croissante et le compositeur prend la moins chère. La lecture prend la meilleure chance, avec la préférence aux paris parlants (1X2, double chance, plus/moins de 2,5). Le combiné va donc chercher les totaux d'équipe et les paris « gagner une mi-temps ». Les paires les plus fréquentes : TEAM_TOTAL vers DOUBLE_CHANCE (16 cas), TO_WIN_EITHER_HALF vers OVER_UNDER (5 cas).
3. **Choix non cotés chez 1xBet.** Une jambe sans relevé passe (`playableAtOperator` renvoie true) : 11 jambes DRAW_NO_BET ou TO_WIN_EITHER_HALF n'ont aucune cote 1xBet. La lecture écarte tout choix non coté.

Cause secondaire, l'heure de composition : seules 26 des 44 jambes divergentes sont encore au rang 1 dans la dernière analyse.

## 2. Combiné du jour

- **Jours** : 22 réglés, 15 gagnés (68 % ± 19).
- **Cote combinée enregistrée** : 1,16 à 1,48, souvent 1,44. Recalculée sur la cote 1xBet, sa médiane est **1,35** (de 1,16 à 1,54). C'est bien « minable ».
- **Calibration par jambe** : 50 jambes réglées, ratio 0,981 ± 0,113 sur la chance du moteur ; 34 jambes avec une fréquence de marché, ratio 1,000 ± 0,155. Le combiné est donc honnête, mais cher pour ce qu'il rapporte.

| Marché de jambe    | n  | Ratio         | Cote 1xBet médiane |
| ------------------ | -- | ------------- | ------------------ |
| TEAM_TOTAL_AWAY    | 11 | 0,838 ± 0,229 | 1,17               |
| TEAM_TOTAL_HOME    | 14 | 0,910 ± 0,208 | 1,15               |
| DRAW_NO_BET        | 3  | 0,775 ± 0,455 | —                  |
| OVER_UNDER         | 7  | 1,024 ± 0,325 | 1,17               |
| DOUBLE_CHANCE      | 9  | 1,185 ± 0,279 | 1,08               |
| TO_WIN_EITHER_HALF | 6  | 1,169 ± 0,315 | —                  |

Les totaux d'équipe tirent vers le bas (25 jambes, environ 0,88), mais aucun écart n'est significatif.

## 3. Alternatives construites à partir des lectures

**Règle fixée avant de lire les résultats.**

- Jour = date UTC du coup d'envoi. On ne garde que les lectures dans la bande de cote 1xBet, et une seule par championnat : celle de plus forte fréquence du marché.
- Ces lectures sont triées par fréquence décroissante, puis cote croissante.
- **A2 / A3** : on prend les 2 ou 3 premières lectures de la bande 1,20–1,50.
- **B2 / B3** : bande 1,30–1,80. On prend la première paire (ou le premier triplet), dans l'ordre du tri, dont la cote combinée tombe dans 1,8–2,6 (2,6–4,5 pour B3).
- **C1** : une seule lecture, la meilleure de la bande 1,30–1,80.
- Coupon : cote combinée sur 1xBet. Une jambe VOID compte pour 1.

**Depuis le 13/10** (même période que le combiné) :

| Règle | Jours | Gagnés     | Cote médiane | Ratio jambe (marché) | Pire série |
| ----- | ----- | ---------- | ------------ | -------------------- | ---------- |
| A2    | 23    | 61 % ± 20  | 1,48         | 0,991 ± 0,149        | 2          |
| A3    | 23    | 43 % ± 20  | 1,80         | 0,978 ± 0,123        | 4          |
| B2    | 21    | 67 % ± 20  | 1,82         | 1,145 ± 0,194        | 2          |
| B3    | 18    | 50 % ± 23  | 2,67         | 1,128 ± 0,177        | 4          |
| C1    | 23    | 83 % ± 15  | 1,30         | 1,115 ± 0,242        | 2          |

**Depuis le 01/09** (pour plus de puissance) :

| Règle | Jours | Gagnés     | Cote médiane | Ratio jambe (marché) | Ratio jambe (moteur) | Pire série |
| ----- | ----- | ---------- | ------------ | -------------------- | -------------------- | ---------- |
| A2    | 47    | 64 % ± 14  | 1,48         | 1,033 ± 0,106        | 1,017 ± 0,102        | 4          |
| A3    | 44    | 43 % ± 15  | 1,80         | 0,991 ± 0,090        | 0,975 ± 0,087        | 5          |
| B2    | 41    | 61 % ± 15  | 1,82         | 1,096 ± 0,141        | 1,015 ± 0,121        | 4          |
| B3    | 37    | 51 % ± 16  | 2,68         | 1,120 ± 0,125        | 1,019 ± 0,106        | 4          |
| C1    | 49    | 80 % ± 11  | 1,31         | 1,094 ± 0,171        | 1,045 ± 0,156        | 2          |

Calibration de toutes les lectures depuis le 01/09 sur la chance du marché, par tranche de cote 1xBet :

| Cote        | n     | Ratio         |
| ----------- | ----- | ------------- |
| 1,20 – 1,30 | 1 396 | 0,995 ± 0,030 |
| 1,30 – 1,50 | 974   | 1,032 ± 0,042 |
| 1,50 – 1,80 | 268   | 1,045 ± 0,101 |
| ≥ 1,80      | 64    | 1,010 ± 0,263 |

Le ratio supérieur à 1 de B2/B3 reprend la sous-annonce connue du marché sur 1,45–1,80 (`CHANCE-LECTURE.md` du 04/11). Ce n'est pas un avantage, et le retour par coupon n'a aucune puissance statistique. La fréquence de jours gagnants suit l'arithmétique de la cote : 1/1,48 ≈ 0,68, 1/1,82 ≈ 0,55.

## 4. Combiné IA 4–10

- 04/11 : 3 jambes réglées, 1 gagnée (Leipzig – City AWAY, 1,58). Coupon perdu (cote combinée 4,30).
- 05/11 : en attente (cote combinée 4,83).
- Chaque jambe enregistre comme probabilité la fréquence du marché (`probability` = `operatorFairProbability`). Le ratio réalisé ÷ annoncé se lit donc directement contre le marché.

**On ne peut rien conclure.** Avec 3 jambes, l'IC à 95 % du ratio dépasse ± 1. Pour atteindre ± 0,10 autour d'une chance de 0,58, il faut environ 300 jambes, soit environ 100 jours de coupon. Ce qui est mesurable : le ratio par jambe sur la fréquence 1xBet, par tranche 1,45–1,62 / 1,62–1,80 ; la CLV des jambes (déjà câblée) ; le taux de jours composés. Jamais le résultat du coupon.

## 5. Score corners

- `fixture_statistic` (type `corner_kicks`, par équipe) couvre 208 des 241 matchs finis depuis le 01/11 (86 %).
- Les statistiques arrivent en médiane 145 minutes après le coup d'envoi : environ 45 minutes après le coup de sifflet, avec le passage de finalisation. Seules 6 lignes sur 1 924 matchs sont arrivées pendant le match.
- **Match fini** : on peut afficher le score corners (« 7 – 4 ») une fois la statistique arrivée, avec un état « corners pas encore relevés » entre le coup de sifflet et l'arrivée.
- **En direct** : non disponible. Il faudrait interroger `/fixtures/statistics` pendant le match (coût en appels API à chiffrer).

## Recommandation

Construire le Combiné du jour **à partir des lectures**, pour que le même pari apparaisse partout :

- 2 lectures, une par championnat, classées sur la fréquence du marché ;
- plancher de **1,20 chez 1xBet** (et non sur la cote de référence) ;
- tout choix non coté chez 1xBet est écarté, comme dans la lecture.

Pour la cote, deux options :

- **A2** (1,20–1,50) : même fréquence qu'aujourd'hui (64 % des jours) pour une cote réelle de 1,48 au lieu de 1,35 ;
- **B2** (1,30–1,80, cote combinée 1,8–2,6) : la variante « moins minable », environ 61 % des jours à 1,82, pire série 4.

Dans les deux cas, on mesure le résultat par jambe sur la fréquence du marché, jamais sur le résultat du coupon. A3 (43 %, pire série 5) est à écarter.
