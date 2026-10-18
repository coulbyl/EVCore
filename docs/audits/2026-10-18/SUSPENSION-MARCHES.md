# Suspension de marché : rebranchée sur l'échantillon réel (2026-10-18)

CLAUDE.md pose comme contrainte dure : « suspension automatique à ROI
< −15 % sur 50+ paris ». Le balayage existe (`RiskService.checkAllMarkets`,
cron quotidien 07:45) mais il lisait la table `bet`, qui ne reçoit plus
de pari du moteur depuis le 2026-09-04 : il évaluait un échantillon mort
et n'a jamais rien suspendu. Mesures sur le dump de production du
2026-10-16.

## 1. La règle « 50 derniers paris » est du bruit

Sur 50 jambes, l'erreur-type du ROI vaut 10 à 15 points. Rejouée sur les
50 dernières jambes réglées de chaque marché (vue dédoublonnée), la règle
telle qu'écrite :

- **épargne RESULT_BTTS** (+22 % sur ses 50 dernières, −26 % ± 3 sur
  4 580 jambes en 90 jours) ;
- **suspend TEAM_TOTAL_AWAY** (−18 % sur 50, −5 % ± 1,4 sur 3 245) et
  CLEAN_SHEET_HOME (−32 % sur 50, −13 % ± 2,4 sur 3 285).

Même mécanisme que le ROI de coupon (`docs/audits/2026-08-22`) : à ces
tailles le ROI n'a pas de puissance. La règle est gardée, l'échantillon
change.

## 2. Ce qui est fait

- **Échantillon** : les jambes réglées du moteur sur 90 jours glissants,
  lues dans `channel_selection_deduped` (une ligne par pari réel), sans
  VALUE ni SAFE (observation seule depuis le 2026-09-03). Nouveau
  `RiskRepository`, le service ne touche plus `bet` pour ce garde-fou.
- **Suspension** : 50+ jambes, ROI < −15 % **et perte établie** : borne
  haute à 95 % du ROI (moyenne + 1,96 × erreur-type) sous zéro. Une
  mauvaise semaine ne suspend rien ; un marché qui coûte 15 points sur
  trois mois, si.
- **Alerte** : 30+ jambes, ROI < −10 %, au plus une par marché et par
  semaine (charge `payload.market` de la notification). Avant, l'alerte
  était réémise à chaque passage — avec un échantillon vivant, ç'aurait
  été trois notifications par jour pour toujours, tous les marchés étant
  cotés contre nous.
- **VANTAGE** : le worker lit les suspensions actives et les ajoute aux
  marchés fermés de l'avis IA (même refus `VANTAGE_GATED_MARKET` que son
  auto-calibration). Les stratégies du moteur les refusaient déjà
  (`pick-validation.ts`) ; VANTAGE choisit ses marchés lui-même, il
  fallait le lui dire.
- La réactivation reste manuelle (CLAUDE.md : décision humaine). Un marché
  suspendu n'émet plus de jambe, donc sa mesure ne « récupère » pas toute
  seule — c'est voulu.

## 3. Ce que le premier balayage fera (règle du code, dump du 16 octobre)

| Marché              | Jambes 90 j | ROI / jambe | ± ET | Borne haute | Action       |
| ------------------- | ----------: | ----------: | ---: | ----------: | ------------ |
| WIN_TO_NIL_AWAY     |         800 |     −19,1 % |  5,9 |      −7,6 % | **suspendu** |
| RESULT_BTTS         |       3 763 |     −17,7 % |  3,7 |     −10,5 % | **suspendu** |
| WIN_TO_NIL_HOME     |       2 090 |     −16,4 % |  3,3 |      −9,9 % | **suspendu** |
| CORRECT_SCORE       |       5 425 |     −15,9 % |  3,4 |      −9,2 % | **suspendu** |
| RESULT_TOTAL_GOALS  |       2 581 |     −15,5 % |  3,8 |      −8,0 % | **suspendu** |
| HALF_TIME_FULL_TIME |         465 |     −13,9 % |  7,0 |      −0,1 % | alerte       |
| CLEAN_SHEET_AWAY    |       1 228 |     −13,2 % |  4,2 |      −4,9 % | alerte       |
| CLEAN_SHEET_HOME    |       2 995 |      −7,9 % |  2,5 |      −3,0 % | ok           |
| TO_WIN_EITHER_HALF  |       3 994 |      −5,9 % |  1,2 |      −3,5 % | ok           |
| BTTS                |       2 876 |      −5,8 % |  1,6 |      −2,7 % | ok           |
| ONE_X_TWO           |       3 428 |      −5,4 % |  2,3 |      −0,8 % | ok           |
| OVER_UNDER_HT       |         482 |      −4,9 % |  3,2 |      +1,3 % | ok           |
| DOUBLE_CHANCE       |       2 414 |      −4,7 % |  1,1 |      −2,5 % | ok           |
| OVER_UNDER          |       6 015 |      −3,9 % |  1,1 |      −1,8 % | ok           |
| TEAM_TOTAL_AWAY     |       2 659 |      −3,5 % |  1,5 |      −0,5 % | ok           |
| TEAM_TOTAL_HOME     |       3 118 |      −3,1 % |  1,5 |      −0,1 % | ok           |
| DRAW_NO_BET         |       2 006 |      −2,2 % |  1,7 |      +1,2 % | ok           |
| FIRST_HALF_WINNER   |         372 |      +1,3 % |  6,1 |     +13,3 % | ok           |

Cinq marchés suspendus, tous des marchés « exotiques » : ce sont ceux que
la mesure d'efficience du 2026-09-15 trouvait 2 à 10 fois plus taxés que
le consensus, et le coût d'un marché est la seule chose qui persiste
d'une période à l'autre (corrélation +0,70, `docs/audits/2026-10-18/
CHAMPIONNATS.md`) — à l'inverse des championnats, qu'on ne suspend pas.

## 4. Ce que l'utilisateur verra

Sur les 14 derniers jours, ces cinq marchés représentent **322 des 911
sélections quotidiennes de Décisions (35 %)**, à 99 % au-dessus de la cote
1,80, avec 19 % de réussite et −18,6 % par jambe ; le reste est à 62 % de
réussite et −6,3 %. Ils n'alimentaient déjà aucun coupon (0 jambe sur 103
en 30 jours) et tombaient tous dans le dernier palier de l'affichage.
Décisions perd donc un tiers de son volume, le tiers qui perdait le plus,
sans toucher à « Notre sélection » ni aux coupons.

## 5. Ce qui reste sur la table `bet`

`getCalibrationCurve` et `generateWeeklyReport` (ROI 1X2 et Brier de la
semaine) lisent encore `bet` : ils décrivent les paris des utilisateurs,
pas le moteur. À rebrancher le jour où ces écrans sont relus.
