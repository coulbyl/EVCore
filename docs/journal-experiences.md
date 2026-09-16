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

| Statut | Picks | Annoncé | Réalisé | Écart |
| --- | --- | --- | --- | --- |
| **retenu** | 636 | 57,9 % | **42,9 %** | **−14,9 pts** |
| rejeté `ev_below_threshold` | 4 321 | 54,1 % | **57,4 %** | **+3,3 pts** |
| rejeté `probability_too_low` | 2 435 | 33,5 % | 45,2 % | **+11,7 pts** |
| rejeté `odds_below_floor` | 438 | 68,3 % | 52,1 % | −16,3 pts |

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

| Poids du moteur | Brier |
| --- | --- |
| **0 % (marché seul)** | **0,59876** |
| 10 % | 0,59880 |
| 30 % | 0,60152 |
| 50 % | 0,60776 |
| 100 % (moteur seul) | 0,63874 |

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

| Cote | Jambes | Renc. | Écart | ROI |
| --- | --- | --- | --- | --- |
| < 1,50 | 2566 | 466 | **+2,74 pts** | −0,46 % ± 2,54 |
| 1,50–1,75 | 1281 | 466 | +0,88 | −2,23 % ± 2,65 |
| 1,75–1,95 | 700 | 454 | +1,27 | −0,85 % ± 3,52 |
| 1,95–2,15 | 641 | 438 | −1,10 | −5,45 % ± 4,33 |
| 2,15–2,50 | 863 | 453 | −1,10 | −6,20 % ± 3,80 |
| 2,50+ | 3007 | 466 | **−2,09 pts** | −11,21 % ± 6,41 |

Sur la tranche qui construit le coupon visé (cote 1,22–1,40, 1 780 jambes /
465 rencontres) : ROI par jambe **+0,22 % ± 2,78** au prix Pinnacle,
**+1,41 % ± 2,83** au meilleur des huit books. Huit jambes y donnent une cote
combinée de **8,5 à 9,6** : la cible 5–15 en 8 jambes est atteignable *dans la
tranche où le biais joue pour nous*, ce qui n'est vrai d'aucun autre marché
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

## Modèle d'entrée

```markdown
### Titre de la piste

**Verdict : fermée / impossible / sans signal / ouvert.** Mesure chiffrée,
volume, et ce qui rouvrirait la question. Source vers le rapport régénérable.
```
