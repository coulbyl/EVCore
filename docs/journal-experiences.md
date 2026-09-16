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

## Modèle d'entrée

```markdown
### Titre de la piste

**Verdict : fermée / impossible / sans signal / ouvert.** Mesure chiffrée,
volume, et ce qui rouvrirait la question. Source vers le rapport régénérable.
```
