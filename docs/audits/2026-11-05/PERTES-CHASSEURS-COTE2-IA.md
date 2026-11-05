# Pertes des chasseurs, du coupon cote 2 et du Combiné IA (05/11)

_Copie de prod du 05/11, base locale. Lecture seule. Même méthode que `COMBINE-ET-LECTURE.md`._

## Méthode

- **Produits** : `coupon_proposal` par `targetOddsMin` (DOUBLE 2,00, BTTS 1,45, Nul 2,90, Nul MT 2,10, Corners 1,70, Combiné IA 4,00 en `PRICE_COMPOSER` ; Score exact 6,00 en `ENGINE`), du lancement (29/10, 30/10 pour les corners, 04/11 pour le Nul MT et le Combiné IA) au 04/11. Les coupons du 05/11 sont en attente.
- **Annoncé** : `coupon_proposal_leg.probability`, la fréquence du marché enregistrée sur la jambe. **Réalisé** : `isCorrect`. Aucune jambe VOID.
- **Jours attendus** : somme sur les jours du produit des chances des jambes. **Pire série attendue** : 20 000 tirages des jours avec ces chances. **IC du ratio** : bootstrap par jour (4 000 tirages), et ± 1,96·√Σp(1−p)/Σp.
- **Rejeu** des règles Nul et BTTS : dernier relevé 1xBet d'avant 17 h UTC la veille, matchs finis du 15/09 au 04/11, bande de la classe, le match à la marge la plus basse par jour. Le vrai composeur lit aussi la cote de référence et exclut AVOID et « Données suspectes » : c'est une approximation.

## 1. Normal ou pas, par produit

| Produit              | Jambes | Gagnées | Annoncé | Ratio (IC bootstrap) | Jours gagnés / attendus | Pire série (P ≥ observée) |
| -------------------- | ------ | ------- | ------- | -------------------- | ----------------------- | ------------------------- |
| Coupon cote 2        | 14     | 11      | 9,83    | 1,12 [0,82 ; 1,33]   | 4 / 3,41                | 1 (0,99)                  |
| Chasseur BTTS        | 7      | 2       | 4,05    | 0,49 [0,00 ; 0,99]   | 2 / 4,05 (P ≤ 2 : 0,12) | **5 (0,03)**              |
| Chasseur Nul         | 7      | 1       | 2,01    | 0,50 [0,00 ; 1,54]   | 1 / 2,01 (P ≤ 1 : 0,35) | 6 (0,16)                  |
| Chasseur Nul MT      | 1      | 1       | 0,37    | —                    | 1 / 0,37                | 0                         |
| Chasseur Score exact | 7      | 1       | 0,97    | 1,03 [0,00 ; 3,08]   | 1 / 0,97                | 4 (0,76)                  |
| Chasseur Corners     | 6      | 4       | 3,18    | 1,26 [0,62 ; 1,90]   | 4 / 3,18                | 1 (0,98)                  |
| Combiné IA           | 3      | 1       | 1,77    | 0,56                 | 0 / 0,21                | 1                         |

- **Coupon cote 2, Corners, Score exact, Nul MT** : normaux, au niveau ou au-dessus de l'annoncé.
- **Chasseur Nul** : 1 nul sur 7 pour 2 attendus. Une chance sur trois de faire aussi mal par pur hasard : normal.
- **Combiné IA** : chance annoncée du coupon 0,21 (0,626 × 0,561 × 0,587). Le perdre est l'issue attendue 4 fois sur 5.
- **Chasseur BTTS** : seul produit hors de sa fréquence. 5 pertes de suite (Villarreal, Troyes, Juventus, Atalanta, Bodø), probabilité 0,03. Six produits testés, la chance qu'au moins un tombe aussi bas par hasard est d'environ 17 %. **Le rejeu ne montre aucun biais de la règle** : sur 2 077 BTTS « oui » 1,45–1,90 chez 1xBet, ratio 0,991 ± 0,04. Le choix « le moins cher par jour » sur 48 jours donne 0,86 ± 0,25, les rangs 2 et 3 donnent 1,27 et 0,72 : c'est du bruit. La marge BTTS chez 1xBet est presque plate (7,3 % à 8,2 %), donc le tri « moins cher » choisit à peu près au hasard parmi les grands championnats. Verdict : malchance, sans cause mécanique démontrable.
- **Rejeu du Nul** : population 1,045 (1 233 matchs), le choix « le moins cher par jour » 0,94 ± 0,35 (48 jours). Aucun biais non plus.

Toutes ces lectures sont sans puissance statistique (7 jambes par produit). Seule une série par jambe sur plusieurs semaines tranchera.

## 2. Facteurs mécaniques vérifiés

| Facteur                                                   | Cas                                                                                                                                                                                                                                                                                                                           | Gravité                                                                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Jambe sous le plancher de cote chez 1xBet                 | 0 sur 45. Les bandes se lisent bien sur la cote 1xBet (4 doubles chances à 1,17–1,18 en référence passent à 1,22–1,26 chez 1xBet). Le défaut du Combiné du jour (plancher 1,10) ne touche pas ces produits.                                                                                                                   | nulle                                                                                                                                |
| Jambe sans cote 1xBet                                     | 2 (BTTS et Nul du 29/10, premier jour, avant le stockage de `operatorOdds`), toutes les deux gagnées                                                                                                                                                                                                                          | nulle                                                                                                                                |
| Mauvais règlement                                         | 0 sur 45. Scores finaux et de la pause présents, corners relus dans `fixture_statistic` (6 sur 6 justes, réglés après l'arrivée des stats), Lens–Como 1-9 confirmé par 10 événements but.                                                                                                                                     | nulle                                                                                                                                |
| **Même match dans deux chasseurs, paris emboîtés**        | 2 cas : Tucumán (03/11) et Courtrai (04/11), Nul **et** Score exact 1:1. Le 1:1 est inclus dans le nul : les deux perdent ensemble (4 pertes pour 2 événements).                                                                                                                                                              | moyenne pour qui suit plusieurs chasseurs                                                                                            |
| Même match dans deux produits, paris compatibles          | 5 : Juventus–Napoli (BTTS + Nul, tous deux perdus sur 2-0), Villarreal (BTTS + Corners), Dortmund (BTTS + Nul MT), Leipzig (cote 2 + IA), Lugano (cote 2 + Corners, en attente)                                                                                                                                               | faible : concentre le risque, ne fausse rien                                                                                         |
| Pari contraire à la sélection du moteur sur le même match | 4 cas, tous perdus : BTTS oui contre BTTS non du moteur (Juventus, Villarreal), Nul contre double chance 12 (Grêmio), 1:1 contre 12 (Kalmar). Les 2 BTTS gagnés étaient ceux que le moteur jouait aussi.                                                                                                                      | visible pour le joueur. Ce n'est pas une cause de perte établie : le moteur est derrière le marché, il ne doit pas servir de filtre. |
| « Données suspectes »                                     | 0 à la composition pour les chasseurs et le coupon cote 2. Le **Combiné IA ne filtre que AVOID**, pas l'alerte de calibration (`persistAiCombo`) : Levski Sofia (05/11) est entré avec une alerte. 5 autres jambes (3 cote 2, 2 IA) ont reçu l'alerte après la composition, 2 perdues.                                        | faible (1 cas)                                                                                                                       |
| CLV                                                       | Calculée sur la cote de **référence**, pas sur la cote 1xBet jouée. Coupon cote 2 : 15 sur 15 négatives, médiane −6,4 %. Recalculée sur la cote 1xBet (Nice–Rennes : −8,3 % → −3,6 %), elle baisse d'environ moitié. Elle n'est pas calculée du tout pour Corners, Score exact et Nul MT (14 jambes sans `closingLineValue`). | mesure faussée, sans effet sur le jeu                                                                                                |
| Match reporté après composition                           | 1 : Coritiba–Vitória dans le coupon cote 2 du 29/10, joué le 31/10, perdu. La fenêtre du vivier est bien le jour : le match a été déplacé après coup. La jambe a été réglée sur le match rejoué. Il faut vérifier la règle de report de 1xBet, qui l'annule souvent.                                                          | faible, possible erreur de règlement                                                                                                 |
| Concentration du Score exact                              | 4 jambes sur 7 en ARG1, toutes en 1:0 ou 1:1. Le tri sur la plus forte probabilité dans 5–12 va chercher les championnats à peu de buts. `operatorFairProbability` est nul sur toutes les jambes : la chance annoncée vient d'une marge type, pas du groupe 1xBet.                                                            | à surveiller                                                                                                                         |
| Heure de composition et compositions d'équipes            | 45 jambes sur 45 composées vers 17 h UTC la veille, avant les compositions. C'est voulu, et aucun effet n'est mesurable.                                                                                                                                                                                                      | nulle                                                                                                                                |

## 3. Combiné IA du 04/11 (perdu, 1 jambe sur 3)

- **Leipzig – City, victoire de City, 1,58, gagnée.** Le moteur (DOMINANT) jouait la même chose.
- **Wrexham – Middlesbrough, victoire de Middlesbrough, 1,70, perdue 2-0.** L'avis date du 02/11 à 19 h 45. Il est fondé sur des statistiques brutes (« 87 % de résultats récents », xG 2,21 contre 1,00) et annonce 0,68 de chance, quand le marché en donne 0,561 : l'IA surestime de 12 points. Elle a ensuite changé d'avis 5 fois (moins de 3,5 buts, Middlesbrough, BTTS, plus de 1,5 but, Wrexham moins de 1,5 but). Son dernier avis avant le match était « plus de 1,5 but », gagné mais à 1,20, hors bande. Le moteur ne jouait pas Middlesbrough (double chance 12). Le texte est cohérent avec les chiffres qu'il cite. La perte vient de l'aléa, sur un avis périmé.
- **Rennes – Olympiakos, les deux équipes marquent, 1,60, perdue 0-0.** L'avis est stable sur 6 passages, basé sur `near_threshold` (« juste en dessous du seuil habituel »), avec 0,54 de chance, **sous** la fréquence du marché (0,587). Justification faible, mais c'est un aléa : 41 % de chances de perdre.
- **Mécanique.** Le coupon est composé à 17 h 03, trois à cinq minutes **avant** le passage VANTAGE de 17 h 06. Il fige donc les avis de la veille au soir. Sur 3 jambes, 2 n'étaient plus l'avis final de l'IA au coup d'envoi (Leipzig a fini en refus à 19 h 33, Wrexham en « plus de 1,5 but »). La bande 1,45–1,80 et la règle « un par championnat » ont été respectées.
- **Mesure plus large** (avis joués 1,45–1,80 à plus de 20 h du match, du 06/10 au 05/11, ratio sur 1/cote brute) :
  - un avis répété à l'identique sur deux passages : ratio 0,99 (n = 129) ;
  - un avis nouveau ou changé : ratio 0,87 (n = 211) ;
  - un avis abandonné plus tard par l'IA (lu après coup) : 0,83 (n = 135), contre 0,98 pour un avis conservé.
  - L'écart (0,12 ± 0,17) est suggestif, pas établi.

## 4. Correctifs proposés, par ordre de valeur

1. **Combiné IA : ne prendre qu'un avis confirmé sur deux passages de suite**, et composer après le passage VANTAGE (pas à 17 h 03). Rejeu : 129 avis éligibles sur 340 (environ 38 %), ratio 0,99 contre 0,87. Le volume tombe, il faut vérifier le taux de jours composés avant de choisir.
2. **Combiné IA : exclure les « Données suspectes »**, comme les autres produits : une ligne dans `persistAiCombo` (1 cas sur 4 jours).
3. **Chasseurs Nul et Score exact : un match par jour**, pas le même pour les deux : sur 7 jours, 2 risques doublés évités. Le Score exact prend alors son 2ᵉ choix.
4. **CLV** : la calculer sur `operatorOdds` (la cote jouée), et l'étendre aux corners (colonne `line`), au score exact et au 1X2 de la pause. Sans ce correctif, la CLV des produits reste ininterprétable.
5. **Match reporté** : régler en VOID une jambe dont le match a été déplacé hors du `forDate`, si c'est la règle 1xBet (1 cas). Il faut la vérifier avant.
6. **BTTS, Nul, Corners, cote 2** : ne rien changer. Mesurer par jambe pendant 6 à 8 semaines. Ne jamais conclure sur la série de 5 pertes du BTTS.

## Correctifs livrés le 05/11

Branche `fix/coupon-mechanics`, non poussée.

1. **Combiné IA composé après le passage de l'IA** (`ai-combo-v2`, `AI_COMBO_POLICY.composeFromHoursBeforeDay`). La passe de 17 h n'écrit plus rien pour lui (ni coupon, ni abstention). C'est la passe d'analyse de 21 h UTC qui le compose, sur les avis donnés après 17 h : l'IA lit les analyses de 17 h de 17 h 06 à environ 20 h. La proposition du jour reste immuable : rien n'est écrit avant 21 h, donc rien n'est réécrit.
   - Rejeu du 06/10 au 04/11 (30 jours, `vantage_decision_history`, cote de référence de l'avis, chance annoncée 1/cote brute, sans le filtre « Données suspectes », donc une approximation) :

     | Règle                                  | Jours composés | Jambes | Réalisé ÷ annoncé | Vivier 1,45–1,80 |
     | -------------------------------------- | -------------- | ------ | ----------------- | ---------------- |
     | Aujourd'hui (17 h 03)                  | 23 / 30        | 79     | 0,875             | 0,968 (n = 343)  |
     | **Recalage à 21 h (livré)**            | 24 / 30        | 87     | 0,896             | 0,928 (n = 348)  |
     | 21 h + avis confirmé sur deux passages | **7 / 30**     | 24     | 0,929             | 1,022 (n = 134)  |

   - La règle « avis confirmé » ne compose qu'un jour sur quatre, sous le seuil d'un jour sur trois : elle n'est **pas livrée**. Son vivier est le mieux calibré (1,02), mais les écarts restent dans le bruit.

2. **Combiné IA hors « Données suspectes »** : `findAiPlays` écarte `calibrationAlertedFixtureIds`, comme les autres produits.
3. **Nul et Score exact jamais sur le même match** : chaque chasseur lit le coupon déjà publié de l'autre pour le jour (`findProposalFixtureIds`) et ne prend pas son match. Le Score exact prend alors son 2ᵉ choix. Le Nul fait de même si le Score exact a été publié à une passe plus tôt.
4. **CLV** :
   - La colonne `closingLineValue` reste calculée sur la cote de référence, l'historique n'est pas réécrit. La console (`productLegs`) et `report:coupon-clv` ramènent la même fréquence de clôture à la cote 1xBet jouée (`operatorOdds × (CLV + 1) / oddsSnapshot − 1`).
   - Coupon cote 2 : −7,1 % au prix de référence, −2,8 % au prix 1xBet (14 jambes). Tous produits PRICE_COMPOSER : −7,8 % ± 0,5 au prix 1xBet.
   - Les corners ont maintenant leur clôture, lue à la ligne de la jambe. Les jambes déjà réglées la reçoivent au prochain `settle-range`.
   - Le nul MT avait déjà sa CLV (il manquait seulement des clôtures fraîches).
   - **Score exact : pas de CLV.** Aucun book ne cote une grille exhaustive (1xBet : 120 scores, Σ 1/cote = 2,4, pas de « autre »), et un CLV sur un groupe incomplet serait faux (`outcome-groups.ts`).
5. **Match reporté** : la règle en place (jambe remboursée quand le match n'est pas joué dans les 24 h qui suivent son coup d'envoi, `postponedVoidDelayMs`) ne voyait pas un match déplacé puis rejoué, parce que le coup d'envoi du match est réécrit. Le dernier coup d'envoi du coupon à sa composition sert maintenant de référence : une jambe dont le match a lieu 24 h ou plus après est remboursée. Sur la base, 8 jambes sont concernées, dont Coritiba (29/10), qui serait remboursée au prochain `settle-range`. Les autres sont d'anciens coupons LLM ou 5–15.
6. **Tests** : composition (17 h différée, 21 h ouverte ; Nul et Score exact dans les deux ordres), clôture des corners (bonne ligne, ligne absente), règlement d'un match déplacé (premier passage, second passage identique, correction perdu → remboursé), match déplacé de moins d'un jour.
