# L'utilité du ML — étude du 29/10/2026

_Question posée : la correction ML en ombre (`ML_CORRECTION_ENABLED`, ml-worker XGBoost) sert-elle à quelque chose, et comment le ML pourrait-il nous aider ? Copie de prod du 29/10, modèles `.pkl` du serveur de prod (104 fichiers, tous retrouvés dans `ml_model_version`). Scripts, requêtes et sorties brutes dans `scripts/ml-utilite/`._

## Résumé

1. **L'ombre ML, telle qu'elle a tourné depuis juillet, ne bat le marché sur aucun canal.** Sur 16 617 sélections réglées avec un prix de marché (5 957 matchs), son écart au marché est de +0,026 de Brier, pire que le moteur (+0,014). Elle fait mieux que le moteur sur DOMINANT et VALUE, mais seulement en le rapprochant du prix (corrélation 0,71 avec le marché) : le prix fait ça gratuitement. Sur CLEAN_SHEET et TEAM_TOTAL elle est franchement fausse (+0,070 et +0,037), et sur GOALS elle est anti-informative (poids optimal −0,14 [−0,24 ; −0,02]).
2. **Un modèle appris sur toutes nos features ne bat pas le marché non plus**, hors échantillon, sur aucune des cinq issues testées (victoire domicile, nul, extérieur, plus de 2,5 buts, les deux marquent). Régression logistique et gradient boosting sont tous deux **moins bons** que le prix seul, de +0,002 à +0,006 de Brier, intervalle hors de zéro. Ajouter le moteur au prix ne change rien (±0,0001).
3. **Aucune feature ne porte de signal seule** : la plus forte corrélation avec le résidu (réalisé − marché) est 0,045, exactement ce que 125 tests produisent par hasard.
4. **Donc** : le ML ne peut pas nous donner de meilleures probabilités avec ce qu'on collecte. Il ne devient utile que si on lui donne une information que le marché n'a pas encore au moment où on analyse. Aujourd'hui, les trois candidates ne sont pas collectées : compositions (0 match), mouvement de ligne (47 matchs sur 6 462), blessures (2 360 matchs).
5. **Recommandation** : couper l'ombre (zéro perte, ~1 000 appels ml-worker par jour en moins, la passe du soir plus courte), garder le code du ml-worker en l'état sans le planifier, et ne le rouvrir qu'avec une source d'information nouvelle et mesurée. `ML_CORRECTION` n'a donc pas sa place dans les réglages admin : c'est une constante à `false` dans le code, avec ce rapport en lien.

## 1. Ce que l'ombre a fait (juillet → 29 octobre)

### Méthode

- Sélections de rang 1 réglées (WON/LOST), **dédupliquées** par `channel_selection_deduped` (une ligne par pari réel, jamais une par ré-analyse), qui portent une correction ML écrite au moment de l'analyse (`model_run.features.shadow_ml_by_channel[canal].correctedP`). C'est du walk-forward réel : le modèle qui a corrigé est celui qui était actif ce jour-là.
- **Référence : le prix de marché sans marge au moment de l'analyse**, reconstruit depuis `odds_snapshot` (dernier relevé Pinnacle, sinon Bet365, antérieur à `analyzedAt`, groupe d'issues complet). Âge médian du relevé : 4,7 h. WIN_EITHER_HALF n'a pas de complément coté : jugé sans marché.
- Trois lectures : le Brier de chacun (moteur, ML, marché), **l'écart au marché** (Brier − Brier marché) avec intervalle à 95 % par bootstrap groupé par match, et **le poids optimal** du signal dans un mélange avec le prix (pente de « réalisé − marché » sur « signal − marché » ; 0 = le signal n'apporte rien, négatif = il nuit).

### Résultats

| Canal | n | Brier moteur | Brier ML | Brier marché | Écart au marché moteur | Écart au marché ML | Poids optimal ML |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GOALS | 6 559 | 0,2222 | 0,2263 | 0,2148 | +0,0074 [+0,005 ; +0,010] | +0,0116 [+0,010 ; +0,014] | **−0,14 [−0,24 ; −0,02]** |
| TEAM_TOTAL | 3 553 | 0,2375 | 0,2568 | 0,2195 | +0,0180 | **+0,0374 [+0,031 ; +0,044]** | +0,02 [−0,07 ; +0,09] |
| CLEAN_SHEET | 2 717 | 0,2216 | 0,2768 | 0,2070 | +0,0146 | **+0,0698 [+0,060 ; +0,080]** | −0,05 [−0,13 ; +0,01] |
| BTTS | 2 120 | 0,2432 | 0,2429 | 0,2369 | +0,0063 | +0,0060 | −0,11 [−0,39 ; +0,19] |
| DOMINANT | 1 151 | 0,2582 | 0,2328 | 0,2201 | +0,0381 | +0,0127 [+0,007 ; +0,018] | −0,19 [−0,46 ; +0,08] |
| VALUE | 517 | 0,2749 | 0,2432 | 0,2280 | +0,0469 | +0,0152 [+0,004 ; +0,025] | −0,09 [−0,48 ; +0,28] |
| WIN_EITHER_HALF | 2 423 | 0,2329 | 0,2402 | — | — | — | — |
| **Tous (avec marché)** | **16 617** | **0,2322** | **0,2442** | **0,2181** | **+0,0141 [+0,012 ; +0,016]** | **+0,0261 [+0,024 ; +0,028]** | **−0,05 [−0,09 ; −0,00]** |

### Lecture

- **Là où le ML « aide » (DOMINANT, VALUE), il ne fait que rapprocher le moteur du prix.** Sur DOMINANT, l'écart moyen au marché passe de 0,139 (moteur) à 0,076 (ML), et les écarts ML et moteur sont corrélés à 0,71. Son poids optimal reste nul ou négatif : il n'ajoute rien que le prix n'ait déjà. C'est un correcteur de sur-confiance, pas une source d'information, et le prix est un meilleur correcteur.
- **Là où le ML fait pire (CLEAN_SHEET, TEAM_TOTAL, GOALS), il annonce des probabilités qu'il ne tient pas.** Sa calibration par tranche le montre : entre 0,8 et 1,0 il annonce 0,875 et réalise 0,714 (le marché annonce 0,699 sur les mêmes lignes) ; sous 0,4 il annonce 0,243 et réalise 0,374. Il extrapole hors de son support d'entraînement. Les métriques internes de `ml_model_version` (« roiShadow » +0,72 sur CLEAN_SHEET_HOME, +0,78 sur CLEAN_SHEET_AWAY) sont celles du split interne du worker et ne disent rien de ce qui s'est passé en prod, comme l'audit du 12/08 l'avait déjà vu.
- La coupure du 16/09 (apparition de `modelId`) ne change pas le tableau : GOALS reste négatif après, DOMINANT reste un rapprochement du prix.

## 2. Ce qu'un modèle pourrait apprendre (le résidu contre le marché)

### Méthode

- Une ligne par match terminé (6 378, juillet → octobre) : **la dernière analyse avant le coup d'envoi** (médiane 18 h avant en juillet-août, 0,5 h en septembre-octobre grâce à la ré-analyse du jour même), ses features (λ, forme, xG, dom/ext, volatilité, taux de nuls, équilibre offensif, congestion, H2H, pourcentages API-Football, blessures quand elles existent, heures avant le coup d'envoi), les probabilités du moteur (`features.probabilities`), et **le prix de marché sans marge au même instant** (Pinnacle, sinon Bet365) sur 1X2, plus de 2,5 buts et les deux marquent.
- **Walk-forward par mois** : apprend sur les mois précédents, teste sur le mois (août, septembre, octobre ; 5 594 matchs testés). Quatre modèles, tous nourris du logit du prix : recalibration du prix seul ; prix + moteur ; prix + toutes les features (logistique régularisée) ; prix + toutes les features (gradient boosting, arrêt anticipé).
- Jugement : Brier hors échantillon contre le prix seul, intervalle bootstrap à 95 %, poids optimal dans un mélange avec le prix.

### Résultats (hors échantillon, 3 mois)

| Issue | n | Brier marché | Moteur seul | Prix recalibré | Prix + moteur | Prix + features (logistique) | Prix + features (boosting) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Victoire domicile | 5 594 | 0,2144 | +0,0188 | −0,0001 | +0,0001 | **+0,0058 [+0,004 ; +0,008]** | **+0,0056 [+0,004 ; +0,008]** |
| Nul | 5 594 | 0,1880 | +0,0033 | +0,0001 | +0,0001 | +0,0041 [+0,003 ; +0,006] | +0,0020 [+0,001 ; +0,003] |
| Victoire extérieur | 5 594 | 0,1893 | +0,0124 | +0,0006 | +0,0006 | +0,0041 [+0,002 ; +0,006] | +0,0060 [+0,004 ; +0,008] |
| Plus de 2,5 buts | 5 589 | 0,2377 | +0,0118 | +0,0000 | +0,0003 | +0,0042 [+0,002 ; +0,006] | +0,0052 [+0,003 ; +0,007] |
| Les deux marquent | 5 586 | 0,2419 | +0,0054 | −0,0001 | −0,0000 | +0,0038 [+0,002 ; +0,005] | +0,0054 [+0,004 ; +0,007] |

_Les colonnes « + » sont l'écart de Brier au marché : positif = moins bon que le prix seul._

### Lecture

- **Le prix est déjà calibré** : le recalibrer ne change rien (±0,0001), et le moteur n'y ajoute rien (±0,0006). C'est la confirmation, sur 5 600 matchs et au niveau du match, du « poids optimal du moteur = 0 % » de l'audit du 16/09.
- **Toutes les features ensemble font pire que le prix seul**, sur les cinq issues, avec les deux familles de modèles, et l'écart ne se referme pas avec le temps (octobre reste positif ou nul). Ce qu'elles apportent est du bruit que le modèle apprend sur les mois précédents et qui ne se reproduit pas.
- **Aucune feature n'a de signal isolé** sur le résidu : les corrélations les plus fortes sont 0,045 (blessures à l'extérieur → plus de buts, n = 2 287) et 0,040 (le prix lui-même). À 125 tests, c'est le niveau du hasard.

## 3. Ce que ça veut dire pour nous

Le ML ne nous donnera pas de meilleures probabilités que le marché **avec les données qu'on a**. Ce n'est pas un problème d'algorithme (logistique et boosting disent la même chose, l'ombre XGBoost aussi) : c'est que nos features décrivent ce que le marché sait déjà, en moins bien.

Il peut nous aider à trois conditions, aucune remplie aujourd'hui :

1. **Une information que le marché n'a pas encore au moment où on analyse.** Les candidates sérieuses sont les **compositions officielles** (publiées ~1 h avant, le prix met quelques minutes à les absorber ; on a la ré-analyse à T−0,5 h mais `shadow_lineups` est nul sur 100 % des matchs), le **mouvement de ligne** entre l'ouverture et la clôture (47 matchs sur 6 462 l'ont) et les **blessures** (2 360 matchs sur 6 462). Collecter d'abord, mesurer ensuite, apprendre en dernier.
2. **Un juge qui est le résidu contre le marché**, jamais le Brier absolu ni le « roiShadow » interne du worker. Les métriques actuelles de `ml_model_version` ont laissé des modèles faux paraître bons pendant des semaines.
3. **Un volume qui permette de conclure** : 6 400 matchs en quatre mois suffisent pour dire « rien » (les intervalles sont étroits) ; pour trouver un effet de +0,002 de Brier, il en faudrait trois fois plus par source d'information.

Ce que le ML peut faire **dès maintenant**, ce n'est pas prédire : c'est **détecter**. Les mêmes modèles, retournés, signaleraient les analyses où le moteur s'éloigne le plus du prix (entrée corrompue, stats gelées), ce que `shadow_predictions.conflict` fait déjà grossièrement. C'est un usage d'exploitation, pas de pronostic.

## 4. Recommandation

- **Couper l'ombre ML** : `ML_CORRECTION` à `false` dans le code (constante, pas un réglage admin), ce rapport en commentaire. Effet : ~1 000 appels ml-worker par jour en moins, une passe du soir plus courte, aucune perte (rien ne lit `shadow_ml_by_channel` pour décider ; les rapports qui le lisent perdent une colonne vide de sens).
- **Ne pas planifier le ré-entraînement** (cron du lundi) tant qu'aucune nouvelle source n'est collectée ; garder le code et les tests du ml-worker, retirer son conteneur de la prod si le lot config le permet.
- **Rouvrir le dossier avec les compositions** : c'est la seule source où l'avance sur le marché est documentée, et la ré-analyse à T−0,5 h existe déjà pour la porter. Première étape : collecter `shadow_lineups` sur tous les matchs pendant deux mois et mesurer le résidu des matchs où un titulaire habituel manque, avant d'entraîner quoi que ce soit.

## Reproduire

Dans `scripts/ml-utilite/` : `market_fair.sql` (partie 1, prix au moment de l'analyse), `residual_dataset.sql` (partie 2, un match par ligne), `study_part1.py`, `study_part2.py`, `probe_models.py` (lecture des `.pkl` dans l'image `evcore-ml-worker`, hors réseau), et les deux sorties brutes. Les scripts tournent dans l'image de prod (`docker run --rm --network none … --entrypoint python … -I`), jamais depuis le dossier des modèles.


_Suite : la direction proposée pour un ML utile est dans [ML-V2-PROPOSITION.md](ML-V2-PROPOSITION.md) (29/10)._
