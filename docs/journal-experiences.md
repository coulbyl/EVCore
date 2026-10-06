# Journal des expériences

> Une ligne par test mené, avec son verdict. Tenu pour ne jamais retester une
> piste déjà fermée — c'est le coût caché d'un travail d'exploration : sans
> trace, la même idée revient tous les trois mois et consomme les mêmes jours.
>
> Ouvert le 2026-09-15 (chantier E, tâche `E-12` de
> [plan-rentabilite.md](plan-rentabilite.md)).
>
> **Règle** : on n'inscrit ici que ce qui a été _mesuré_. Une intuition
> abandonnée sans mesure n'est pas une piste fermée, c'est une piste non
> explorée — elle n'a rien à faire dans ce journal.

## Comment lire les verdicts

| Verdict         | Sens                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------- |
| **Fermée**      | Mesuré, négatif, avec assez de volume pour trancher. Ne pas rouvrir sans données nouvelles.     |
| **Impossible**  | Écarté par l'arithmétique, pas par les données. Aucune donnée future ne changera la conclusion. |
| **Sans signal** | Mesuré, ni positif ni concluant. Rouvrable si le volume ou la qualité des données change.       |
| **Ouvert**      | Effet réel mesuré, insuffisant seul. À combiner ou approfondir.                                 |

---

## 2026-09-15 — Audit initial

### Sélection par championnat

**Verdict : fermée.** 255 cellules championnat × marché d'au moins 300 issues.
49,8 % dépassent la probabilité implicite — le pile ou face exact. 6 cellules
significatives à 95 % pour **6,4 attendues par pur hasard**. Écart moyen sur
220 204 issues : **+0,00 point**.

Les tendances de championnat existent et sont stables entre saisons (ARG1 sous
2,5 buts à 67,3 %, BL1 sur 3,5 à 42,7 %, ARG2 nul à la mi-temps à 52,0 %) —
mais elles sont déjà dans la cote. Source :
[LEAGUE-REPORT.md](audits/2026-09-15/LEAGUE-REPORT.md).

### Marchés exotiques

**Verdict : fermée.** ROI d'une mise sur chaque choix coté, reproduit à
l'identique sur deux périodes disjointes : OVER_UNDER_HT −8,0 %, CLEAN_SHEET
−8 à −9 %, WIN_TO_NIL −13 à −14,5 %, TEAM_TOTAL −16 à −19 %,
HALF_TIME_FULL_TIME −25,2 %, CORRECT_SCORE −55,9 %.

Balayage de 169 cellules championnat × marché × choix : **0 significative pour
4,2 attendues par hasard**, 0 répliquée. La marge croît avec l'exotisme du
marché — c'est la grille tarifaire du bookmaker, pas du bruit.

### Edge annoncé par le moteur comme critère de sélection

**Verdict : fermée**, et anti-prédictive. Sur paris dédupliqués, le taux
réalisé suit la probabilité implicite, pas la probabilité annoncée. Décile 10 :
+23,4 points d'edge annoncé, réalisé 37,8 % contre 40,5 % d'implicite.

Reproduit l'audit du 2026-08-22 sur données fraîches.

### Pouvoir discriminant du moteur à cote égale

**Verdict : fermée.** Découpage en terciles d'edge annoncé _à l'intérieur_ de
chaque tranche de cote — le test correct, que le décile global ne faisait pas.
Dans les cinq tranches, le tercile de plus fort edge annoncé n'est jamais
meilleur, et souvent pire. La probabilité du moteur ne porte aucune information
au-delà du prix.

### Coupon à cote 5 rentable la plupart des semaines

**Verdict : impossible.** Il faut 2 tickets gagnants sur 7 ; P(≥2 | p = 0,20)
= **42,3 % même avec une marge nulle**. Mesuré : 35,8 % de semaines rentables,
jusqu'à 12 semaines perdantes d'affilée.

Aucun modèle ne peut changer ce résultat : c'est la loi binomiale.

### Mouvement de cote

**Verdict : sans signal.** 5 735 rencontres à relevés multiples. La relation
entre dérive et résidu n'est pas monotone. La cote de clôture reste le meilleur
estimateur — ce qui est le résultat classique, et justifie le chantier B.

Rouvrable une fois la ligne de clôture réellement capturée.

### Portefeuille de favoris

**Verdict : fermée.** Parier tous les favoris qualifiés d'une journée plutôt
qu'un seul : ROI −0,22 % sur 2 074 paris, contre +1,95 % sur 731 paris pour le
seul favori le plus marqué. L'edge ne passe pas à l'échelle.

### Features point-in-time

**Verdict : ouvert.** 15 features × 5 cibles sur 38 653 rencontres, testées
contre le _résidu_ (réalisé moins implicite), pas contre le résultat.

Deux répliquent sur les deux moitiés de l'historique :

| Feature                           | Écart 2023-24 | Écart 2025-26 |
| --------------------------------- | ------------- | ------------- |
| xG différentiel élevé → domicile  | +2,01 pts     | +1,76 pts     |
| Repos court à domicile → over 2,5 | −2,04 pts     | −2,06 pts     |

Aucune ne couvre seule la marge. Le cumul biais favori + xG atteint +3,30 pts
en validation, pour un ROI de −0,4 % : à la porte, pas au-delà.

### Filtre xG ajouté au générateur quotidien

**Verdict : fermée.** Dégrade le générateur : 85,0 % de jours gagnants sans
filtre, 79,8 % avec. La sélection du favori le plus marqué capte déjà
l'extrémité favorable de la courbe ; le filtre ne fait qu'écarter des candidats
sans rien apporter.

### Plusieurs coupons par jour

**Verdict : fermée** pour l'objectif de régularité. À cote courte, la journée
n'est positive que si _tous_ les tickets gagnent : passer de 1 à 2 tickets fait
tomber les jours gagnants de 72 % à 51 %.

### Marchés exotiques comme cible de pari (corners, cartons, issues fixes)

**Verdict : fermée.** Mesure sur 100 rencontres : corners 6,58 %, cartons
6,44 %, mi-temps la plus prolifique 9,71 %, première équipe à marquer 10,94 %.
Tous plus chers que l'Asian Handicap (4,26 %) et le Match Winner (4,84 %).

Collectés quand même, chez Pinnacle seul, pour rester ré-étudiables. Source :
[MARKET-MARGINS.md](audits/2026-09-15/MARKET-MARGINS.md).

### Odd/Even comme cible

**Verdict : fermée**, et instructive. C'est le marché le **moins cher** mesuré
(3,81 % chez SBO) et il est inexploitable : la parité du nombre de buts n'est
pas prédictible.

À garder en tête pour tout le plan — **une marge basse ne vaut rien sans
information**.

### Valeur des books mous contre la clôture Pinnacle

**Verdict : sans signal**, mais le test était biaisé et reste à refaire.

Sur prix alignés à 3 h près : tranche d'EV 0–2 % à +8,9 % de ROI (n = 1 251),
tranche 5 %+ à **−12,8 %** malgré +10,9 % d'EV annoncée. Le petit écart paie,
le gros écart perd — signature d'un prix périmé plutôt que d'une valeur.

Test à refaire contre une vraie ligne de clôture (chantier B), l'écart de
fraîcheur entre books (7,5 h contre 43 h) rendant la comparaison actuelle peu
concluante.

---

## 2026-09-16 — Le contrefactuel était en base

### La règle de sélection retient les pires estimations du moteur

**Verdict : ouvert — premier levier identifié qui ne dépende pas du marché.**

`ModelRun.features.evaluatedPicks` enregistre **tout ce que le moteur a
envisagé**, avec la raison de chaque rejet : 1,64 million de picks évalués,
dont 2,5 % seulement retenus. L'audit du 2026-09-15 n'avait regardé que ces
2,5 %.

Réglés rétroactivement, sur la même tranche de cote (1,20–2,60) :

| Statut                       | Picks | Annoncé | Réalisé    | Écart         |
| ---------------------------- | ----- | ------- | ---------- | ------------- |
| **retenu**                   | 636   | 57,9 %  | **42,9 %** | **−14,9 pts** |
| rejeté `ev_below_threshold`  | 4 321 | 54,1 %  | **57,4 %** | **+3,3 pts**  |
| rejeté `probability_too_low` | 2 435 | 33,5 %  | 45,2 %     | **+11,7 pts** |
| rejeté `odds_below_floor`    | 438   | 68,3 %  | 52,1 %     | −16,3 pts     |

Le seuil d'EV sélectionne sur `probabilité × cote − 1 ≥ 0,08`, donc à cote
donnée il retient les picks où le modèle surestime le plus. **C'est un
détecteur de surestimation**, et l'explication du constat « l'edge annoncé est
anti-prédictif » posé le 2026-08-22 sans mécanisme.

Le ROI reste négatif partout (−3 à −8 %) : corriger la sélection ne rend pas le
moteur rentable, cela récupère ~15 points de calibration. Toute modification
d'une règle de rejet se teste sur `evaluatedPicks` sans rien déployer.

### Le moteur est-il meilleur que le prix du marché ?

**Verdict : fermé, et c'est le résultat central.** Sur 3 633 rencontres, score
de Brier 1X2 du moteur **0,6387** contre **0,5992** pour le marché (implicite
normalisée) : **+0,0395 ± 0,0080**, soit cinq erreurs types en défaveur du
moteur. Reproduit tous les mois — juillet +0,065, août +0,037, septembre
+0,029.

Mélange optimal, mesuré par balayage de poids :

| Poids du moteur       | Brier       |
| --------------------- | ----------- |
| **0 % (marché seul)** | **0,59876** |
| 10 %                  | 0,59880     |
| 30 %                  | 0,60152     |
| 50 %                  | 0,60776     |
| 100 % (moteur seul)   | 0,63874     |

Le poids optimal est **zéro**, et la dégradation est monotone. La probabilité
du moteur n'apporte donc **aucune information** que le prix ne porte déjà.

Ce résultat explique tous les précédents : l'edge annoncé anti-prédictif,
aucun canal ne battant la marge, le réalisé qui suit l'implicite. Ce n'était
pas plusieurs problèmes mais un seul.

Conséquence d'architecture : `EV = p × cote − 1` avec `p` issu du modèle
suppose que `p` batte le prix. Elle ne le bat pas, donc l'EV calculée est du
bruit, et la couche de sélection entière repose sur une fondation qui ne tient
pas. La voie n'est pas d'améliorer le modèle à la marge mais de **prédire le
résidu** — l'écart au prix — plutôt que la probabilité absolue (`F-5` du plan).

### Les corrections du moteur (H2H, congestion) aident-elles ?

**Verdict : sans signal.** Gain de Brier du corrigé sur le brut, par situation :
aucune correction +0,0080 ± 0,0063, congestion seule +0,0046 ± 0,0061, H2H +
congestion +0,0040 ± 0,0050, **H2H seul −0,0008 ± 0,0047**.

Aucune n'est démontrée nuisible, aucune n'est franchement utile. Le gain le
plus net vient des corrections **non tracées** par ces deux drapeaux
(shrinkage, lambda scale, mélange empirique). Sans objet tant que le modèle
reste derrière le marché de 0,04.

### Le biais favori existe-t-il sur le handicap asiatique ?

**Verdict : ouvert — la seule piste non fermée.** 467 rencontres servant le
marché sur 15 jours, 9 058 jambes Pinnacle, marge mesurée **3,98 %** (et non
les 2,6–3,7 % annoncés sur une rencontre isolée : chiffre corrigé).

Le biais **existe et il est monotone**, même sens que sur le 1X2. Intervalles
groupés par rencontre — une rencontre sert une dizaine de jambes corrélées, les
compter indépendantes divise l'intervalle par trois :

| Cote      | Jambes | Renc. | Écart         | ROI             |
| --------- | ------ | ----- | ------------- | --------------- |
| < 1,50    | 2566   | 466   | **+2,74 pts** | −0,46 % ± 2,54  |
| 1,50–1,75 | 1281   | 466   | +0,88         | −2,23 % ± 2,65  |
| 1,75–1,95 | 700    | 454   | +1,27         | −0,85 % ± 3,52  |
| 1,95–2,15 | 641    | 438   | −1,10         | −5,45 % ± 4,33  |
| 2,15–2,50 | 863    | 453   | −1,10         | −6,20 % ± 3,80  |
| 2,50+     | 3007   | 466   | **−2,09 pts** | −11,21 % ± 6,41 |

Sur la tranche qui construit le coupon visé (cote 1,22–1,40, 1 780 jambes /
465 rencontres) : ROI par jambe **+0,22 % ± 2,78** au prix Pinnacle,
**+1,41 % ± 2,83** au meilleur des huit books. Huit jambes y donnent une cote
combinée de **8,5 à 9,6** : la cible 5–15 en 8 jambes est atteignable _dans la
tranche où le biais joue pour nous_, ce qui n'est vrai d'aucun autre marché
mesuré. ROI projeté du coupon +1,8 % à +11,9 %, intervalle **[−11 % ; +39 %]**.
Indéterminé, dans les deux sens.

Le coupon gagne **~12 % du temps**. C'est l'arithmétique de la cote 9, pas un
défaut de construction : aucune sélection ne rend une cote 9 fréquente.

**Ce qui bloque, et ce n'est pas statistique.** API-Football **purge les cotes
au bout de ~7 jours** : sur les mêmes appels, zéro handicap asiatique servi
avant le 2026-09-09 et 100 % à partir du 09-09. **Aucun backtest historique de
ce marché n'est possible**, ni maintenant ni plus tard. La seule donnée
obtenable est celle collectée en avant. L'ingestion est câblée sur cette
branche : chaque jour non mergé est un jour perdu définitivement.

**Ce qui trancherait :** ~300 rencontres de plus, collectées en avant, puis
relecture de la tranche 1,22–1,40 avec le même protocole groupé. Le résultat ne
dépend d'aucune probabilité du moteur — il ne vient que du prix — donc il n'est
pas atteint par l'écart de 0,04 au marché.

Source : `docs/audits/2026-09-16/ASIAN-HANDICAP.md`, régénérable par
`pnpm --filter @evcore/backtest-core backtest:asian-handicap`.

---

## 2026-10-06 — Re-fit des facteurs de λ dans la chaîne complète

### Le facteur extérieur 0,75 retire des buts que les marchés « buts » paient (suite)

**Verdict : validé et appliqué.** `HOME_ADVANTAGE_LAMBDA_FACTOR` 1,00 → 1,10,
`AWAY_DISADVANTAGE_LAMBDA_FACTOR` 0,75 → 0,85, overrides par ligue (D2, I2,
UCL, UEL, UECL) retirés. Script `packages/db/scripts/backtest-lambda-factors-goal-conservation.ts`,
rapport `docs/audits/2026-10-06/lambda-factors-refit.txt`.

Protocole : chaîne de production complète (meanLambda et lambdaScale par
ligue, blend 1X2 empirique, blocs de shrinkage O/U tels quels), xG
point-in-time, 39 528 matchs des compétitions de backtest. Grille figée de
40 configurations (4 × 5 paires × overrides gardés ou retirés), critère figé
= somme des Brier 1X2 + Over 2.5 + BTTS, choix sur la fenêtre de sélection
[2023-07 ; 2026-01[ seule, mesure unique sur la validation [2026-01 ; 2026-10[.
Faux positifs attendus par le balayage : 1.

| Validation, n = 8 020                    | Brier 1X2 | Brier O2.5 | Brier BTTS | Somme   | λ total vs buts | P(over) vs réel |
| ---------------------------------------- | --------- | ---------- | ---------- | ------- | --------------- | --------------- |
| 1,00 / 0,75, overrides gardés (prod)     | 0,62095   | 0,25061    | 0,24725    | 1,11882 | 2,54 vs 2,80    | 0,476 vs 0,538  |
| 1,10 / 0,85, overrides retirés (retenue) | 0,62016   | 0,24646    | 0,24433    | 1,11095 | 2,81 vs 2,80    | 0,523 vs 0,538  |

Écart sur validation −0,00787, plus grand que sur sélection (−0,00381) :
le biais est plus fort en 2026, là où la mesure n'a pas servi au choix. Les
trois métriques s'améliorent, le 1X2 compris (−0,0008). 35 compétitions sur
40 gagnent ; les 5 qui perdent (ARG1 +0,012, SWE2 +0,011, F2, AUT1, EL1)
sont celles où le modèle sur-annonçait déjà les buts : leurs corrections par
ligue (`LAMBDA_SCALE_MAP`, blocs `OU_SHRINKAGE_CONFIG`) ont été fittées à
l'ancien global et sont le prochain re-fit, pas la paire. Avec la paire
retenue, le shrinkage O/U apporte encore 0,0009 sur Over 2.5 et 0,0017 sur
BTTS : les blocs restent utiles, ils compensent moins.

Retirer les overrides gagne aussi seul : pour la paire retenue, 1X2 0,62016
contre 0,62098 en les gardant, D2 −0,016 et I2 −0,010 de Brier 1X2.

Ce que ça ne change pas : rien face au marché. Le gain est de l'ordre de 0,4
point de Brier sur Over 2.5, l'écart au prix de clôture reste de 0,04. Il
corrige une annonce fausse de 5 à 10 points sur la famille « buts », il ne
crée pas d'avantage.

Suite : re-fitter `LAMBDA_SCALE_MAP` et les blocs O/U du 08-15 avec le même
protocole, puis mesurer sur le résidu face au prix.

---

## 2026-10-05 — Première lecture sur la base restaurée du 5 octobre

Base locale = dump de production du 2026-10-05 (72 798 runs, 45 782
sélections dédupliquées, 36 102 matchs avec statistiques). Trois mesures
sont des lectures de pistes ouvertes, la quatrième est née de la revue de
code. Toutes sont en SQL ou en script rejouable, aucune ne lit une décision
enregistrée comme preuve.

### Le biais favori sur le handicap asiatique, relu sur les cotes collectées en avant

**Verdict : sans signal, à la limite de l'insuffisant.** 151 rencontres
terminées depuis le 15 septembre avec un prix AH capturé à moins de 2 h du
coup d'envoi, une jambe par rencontre, favori à la ligne la plus courte dans
la tranche 1,22–1,40, meilleur prix sur 8 books, règlement quart de ligne
inclus : **−4,0 % ± 4,3 par jambe** (HOME n = 113 −3,0 % ± 4,8, AWAY n = 38
−7,1 % ± 9,2). La tranche 1,10–1,22 (n = 55) donne +0,8 % ± 3,9, la tranche
1,40–1,60 (n = 156) +1,6 % ± 4,9. L'intervalle exclut le +5 % qui rendrait
un coupon de 8 jambes intéressant ; il n'exclut pas zéro. Le +1,41 % ± 2,83
du 16 septembre ne se reproduit pas. Ce qui rouvrirait : rien de ce qui
dépend du moteur. Seulement plus de rencontres au prix de clôture, qui ne
s'accumulent qu'à ~10 par jour.

Piège documenté au passage : `odds_snapshot.line` est exprimée **du point de
vue du domicile pour les deux côtés** (« Away −3,5 » à 1,01 = l'extérieur
reçoit 3,5 buts). Lue comme le handicap du côté joué, la même requête donne
−53 % par jambe. Le règlement du moteur n'a aucune règle pour ce marché
(`resolvePickBetStatus` retombait sur la sémantique 1X2) ; corrigé en VOID
explicite le 2026-10-05.

### Les tirs cadrés portent-ils un signal que le prix ignore ?

**Verdict : sans signal.** 23 646 matchs des compétitions de backtest
(2023-07 → 2026-10), xG et tirs cadrés point-in-time (dernière ligne
`team_stats` avant le coup d'envoi, ≥ 5 matchs de statistiques), prix = moyenne
dé-viggée des books au dernier relevé avant le coup d'envoi, cible = victoire
domicile. Résidu (réalisé − implicite) par décile du différentiel de tirs
cadrés : tous entre −0,7 et +0,8 pt sauf le dernier décile à **+1,9 ± 0,9
pt**, que le différentiel d'xG reproduit à l'identique (+2,7 ± 0,9) : c'est
le biais favori-outsider du marché, pas une information des tirs. L'écart
« tirs cadrés moins xG » (finition) est plat partout. C'est la première
passe du chantier D-10 sur une feature brute ; les features D-4 à D-8
(fenêtres par terrain, finition sur 10 matchs) restent à construire, mais
cette lecture ne les annonce pas prometteuses sur le 1X2.

### Le facteur extérieur 0,75 retire des buts que les marchés « buts » paient

**Verdict : ouvert, candidat à un re-fit coordonné.** Revue de code du
2026-10-05 : `AWAY_DISADVANTAGE_LAMBDA_FACTOR = 0,75` a été ajusté le
2026-07-19 sur le Brier 1X2 seul ; le produit 1,00 × 0,75 retire ~12 % des
buts attendus et n'a jamais été scoré sur Over/Under ni BTTS. Mesure en
production (runs pré-coup d'envoi depuis le 20 juillet, n = 4 387) : Over 2.5
annoncé 0,478 contre 0,534 réalisé, BTTS 0,502 contre 0,549, λ total 2,53
contre 2,81 buts. Dans les ligues sans bloc `OU_SHRINKAGE_CONFIG` (n = 1 805)
l'écart monte à 0,424 contre 0,526.

Expérience rejouable (`scripts/lambda-factor-goal-conservation.py`, protocole
simplifié du script de calibration du 07-19 étendu aux buts, 39 528 matchs,
découpage chronologique 70/30, test intouché n = 11 859) :

| Facteurs (dom / ext)                             | Brier 1X2 | Brier O2.5  | Brier BTTS  | P(over) vs réel | λ total vs buts |
| ------------------------------------------------ | --------- | ----------- | ----------- | --------------- | --------------- |
| 1,000 / 0,750 (prod)                             | 0,61964   | 0,25349     | 0,25119     | 0,458 vs 0,534  | 2,51 vs 2,77    |
| 0,975 / 0,750 (meilleur 1X2 seul)                | 0,61945   | 0,25491     | 0,25195     | 0,449 vs 0,534  | 2,48 vs 2,77    |
| 1,075 / 0,850 (meilleur somme, choisi sur train) | 0,61965   | **0,24808** | **0,24710** | 0,519 vs 0,534  | 2,77 vs 2,77    |
| 1,000 / 1,000 (neutre)                           | 0,63013   | 0,24839     | 0,24695     | 0,545 vs 0,534  | 2,88 vs 2,77    |

Le 1X2 est plat le long de l'axe « total de buts » (0,6194 → 0,6197), les
marchés buts ne le sont pas : conserver le total à asymétrie égale rend 0,5
pt de Brier sur Over 2.5 et 0,4 sur BTTS, hors échantillon. Ce n'est pas un
changement à poser dans la config : les blocs `OU_SHRINKAGE_CONFIG` re-fittés
le 08-15, `LEAGUE_MEAN_LAMBDA_MAP.BL1` et `LAMBDA_SCALE_MAP` ont absorbé ce
biais ligue par ligue et devraient être re-fittés avec. Ce qui trancherait :
le même protocole dans le harnais complet (`BacktestRunner`, config par
ligue incluse), facteurs et blocs re-fittés ensemble sur la fenêtre de
sélection, validation sur la suivante, et la mesure sur le résidu face au
prix comme pour tout le reste.

### Ce que la base dit de l'exploitation, en passant

- **VANTAGE et le générateur de coupon LLM sont morts depuis le 20 septembre**
  (845 décisions le 20/09, zéro ensuite ; 3 coupons LLM depuis le 16/09
  contre 17 PRICE). Aucune ligne `coupon_generation_attempt` les jours où le
  vivier avait 74 à 354 candidats : l'appel LLM levait sans être enregistré.
  La comparaison par jambe prévue le 30 septembre est impossible (13 jambes
  LLM). Corrigé côté code (tentative `ERROR` enregistrée puis relancée) ; la
  cause en prod reste à lire dans les logs du worker.
- **La ligne de clôture était capturée mais invisible** : `snapshotAt` est
  l'heure de mise à jour du prix chez le book et fait partie de la clé
  d'unicité, donc une capture T−10 d'un prix inchangé ne laisse aucune
  trace. Sur `snapshotAt` : 0 rencontre à moins de 15 min ; sur l'heure de
  capture : 217 sur 884. Colonne `observedAt` ajoutée, vues et rapport de
  fraîcheur recalculés dessus.
- **Calibration par tranche de cote, 30 derniers jours, 19 canaux
  dédupliqués** : < 1,45 ratio 1,002 (n = 4 004, ROI −3,7 %), 1,45–1,80
  0,887, 1,80–2,50 0,819, > 2,50 0,771 (n = 10 088, ROI −22,9 %). Le résultat
  du 22 août tient : seule la tranche courte est calibrée, et elle rend la
  marge.

---

## Modèle d'entrée

```markdown
### Titre de la piste

**Verdict : fermée / impossible / sans signal / ouvert.** Mesure chiffrée,
volume, et ce qui rouvrirait la question. Source vers le rapport régénérable.
```
