# Coupon cote 2 : choisir ses jours fait-il gagner plus souvent ?

_Étude du 24/10/2026. Question posée le 23/10 : « pourquoi 1 jour sur 2 ? On ne gagne pas tous les jours, donc on doit sortir le coupon quand on peut gagner ; il y a des jours riches en matchs et des jours pauvres. » Données : dump de production du 24/10 à 08:22 restauré localement, 120 jours (02/07 → 24/10), scripts dans `scripts/`._

## Réponse courte

1. **Le critère de sélection compte plus que le jour.** Composer la paire « la plus probable selon le moteur » annonce 72 % et réalise 50 %. Composer « la plus probable selon la cellule » (marché × tranche de cote, taux réalisé des jours précédents) annonce 55 % et réalise 55 %. Le moteur ne sait pas reconnaître ses bons jours ; le prix, si.
2. **« Environ 1 jour sur 2 » reste la phrase honnête.** 55 % sur 80 jours, c'est ± 11 points.
3. **Les jours riches aident, mais pas tous les mois.** Avec le compositeur par cellule, les jours à 41 rencontres et plus gagnent 25 fois sur 37 (67,6 %), contre 46,7 % les jours pauvres. Septembre et octobre vont dans ce sens, août dit le contraire (5 sur 13). C'est une hypothèse à tester en ombre, pas un résultat.
4. **Jamais la probabilité du moteur comme critère de jour.** C'est le seul résultat solide, et il tient tous les mois.

## 1. Pourquoi le plafond est à peu près un jour sur deux

À cote 2 le marché dit « une fois sur deux », et il est mieux calibré que le moteur (Brier 0,599 contre 0,639, `docs/journal-experiences.md`). La marge prélève 5 à 6 % par jambe. Un coupon à cote 2 juste gagne donc 45 à 48 % des jours.

**Simulation** (`scripts/cote2-simulate.js`, 20 000 jours par cas) : N candidats par jour, cotes 1,20–1,65, marge 3 à 6 %, compositeur prenant la paire la plus probable à cote combinée 1,80–2,30, probabilité connue à une erreur σ près.

| Candidats du jour | σ = 0 : vraie réussite | σ = 2 pts : annoncée / vraie | σ = 4 pts : annoncée / vraie |
| ----------------- | ---------------------: | ---------------------------: | ---------------------------: |
| 6                 |                 49,0 % |              49,7 % / 48,4 % |              51,2 % / 47,7 % |
| 12                |                 50,7 % |              52,1 % / 49,8 % |              54,9 % / 49,0 % |
| 25                |                 51,6 % |              53,9 % / 50,5 % |              57,7 % / 49,6 % |
| 50                |                 52,0 % |              55,1 % / 50,8 % |              60,0 % / 49,9 % |
| 150               |                 52,2 % |              56,8 % / 51,1 % |              63,2 % / 50,2 % |

Deux leçons. La richesse du jour vaut **3 points** au mieux, de 49 à 52 %, quand les probabilités sont connues. Et plus le jour est riche, plus la paire « la plus probable » **annonce** haut sans **réaliser** plus : c'est la malédiction du vainqueur (on choisit parmi N la paire la plus surestimée). Avec 4 points d'erreur, un samedi affiche 63 % pour gagner 50 %.

## 2. Ce que disent 120 jours de production

`scripts/cote2-day-selection.js`, sortie complète dans `scripts/cote2-day-selection-120j.txt`. Vivier : sélections SELECTED des canaux non méta (hors VALUE, SAFE, VANTAGE), dernière analyse d'avant coup d'envoi, cote 1,20–1,65, réglées, une jambe par rencontre (la plus courte) : 14 958 jambes, 115 jours composés.

### Trois compositeurs de paire (cote combinée 1,80–2,30)

| Compositeur                                                                            | Jours | Réussite réelle | Chances annoncées |
| -------------------------------------------------------------------------------------- | ----: | --------------: | ----------------: |
| A. La plus probable selon le moteur                                                    |   107 |      **50,5 %** |        **72,4 %** |
| B. La plus probable selon la cellule (taux réalisé marché × tranche, jours précédents) |    80 |      **55,0 %** |        **55,3 %** |
| C. Marge payée la plus basse (`marginPaid`, écrit depuis le 11/10 seulement)           |    10 |          50,0 % |                 — |

A : 22 points de malédiction du vainqueur, exactement ce que `05-COUPON-COTE-2-ET-CHASSE.md` avait vu (70 % annoncé, 47 % réalisé). B : honnête, et il publie 30 % de jours en moins parce qu'il refuse quand une cellule n'a pas 50 jambes d'historique.

### Par richesse du jour (nombre de rencontres du vivier)

| Tercile | Jours | Rencontres | A réalisé | A annoncé |  B réalisé | B annoncé |
| ------- | ----: | ---------: | --------: | --------: | ---------: | --------: |
| Pauvre  |    39 |       1–16 |    54,3 % |    65,7 % |     46,7 % |    51,4 % |
| Moyen   |    39 |      16–41 |    41,7 % |    73,2 % |     45,2 % |    55,5 % |
| Riche   |    37 |     41–200 |    55,6 % |    78,2 % | **67,6 %** |    56,8 % |

L'annonce de B monte avec la richesse (51 → 57 %), comme dans la simulation. Le réalisé riche (67,6 %) dépasse sa propre annonce : une part de chance.

### Le même effet, mois par mois et par jour de semaine

| Mois  | Jours pauvres (< 40) | Jours riches (≥ 40) |
| ----- | -------------------: | ------------------: |
| Août  |      9 / 15 (60,0 %) |     5 / 13 (38,5 %) |
| Sept. |      8 / 14 (57,1 %) |     9 / 14 (64,3 %) |
| Oct.  |      4 / 10 (40,0 %) |     8 / 10 (80,0 %) |

| Jour    |  Dim. | Lun. | Mar. | Mer. | Jeu. | Ven. | Sam. |
| ------- | ----: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vivier  |   117 |   23 |   22 |   21 |   26 |   38 |  129 |
| B gagné | 10/13 | 5/10 |  5/9 |  4/9 | 7/13 | 5/13 | 8/13 |

Trois mois sur quatre et le week-end vont dans le sens de l'intuition ; août la contredit. Avec 10 à 14 jours par mois, aucune cellule n'est significative.

### Abstention par seuil

Avec B, publier seulement si la probabilité de la paire ≥ 0,55 divise le nombre de jours par deux et donne 56 à 71 % selon le mois (10 à 21 jours). Avec A, aucun seuil ne sauve septembre : 32 % de 0 à 0,65. Le moteur ne distingue pas ses bons jours de ses mauvais.

## 3. Ce qu'on en fait

- **Règle de composition** : paire choisie par probabilité calibrée de cellule puis marge la plus basse ; jamais la probabilité annoncée du moteur. Chances affichées = produit des taux de cellule, pas des probabilités du moteur.
- **Affichage** : « Gagne environ 1 jour sur 2 », solde cumulé à mise fixe et pire série sur la carte.
- **Jours** : publication de préférence vendredi à dimanche ; l'effet jour riche se teste en ombre, règle figée à l'avance (vivier ≥ 40 rencontres, paire B ≥ 0,52), 6 à 8 semaines, jugée par jambe. Si août se reproduit, on publie tous les jours.
- **Le plancher du compositeur par le prix** (`PRICE_COMPOSER_POLICY.minExpectedReturn`, aujourd'hui 0) est le bouton d'abstention qui existe déjà : « le refus est un résultat ».

## Limites

- La cellule de B est marché × 3 tranches de cote sur l'historique complet antérieur au jour composé (≥ 50 jambes), pas la courbe canal × compétition sur 90 jours du produit. Elle est plus grossière et un peu plus stable.
- Terciles et seuils ont été lus sur ces mêmes données : la seule règle pré-spécifiée est « cellule plutôt que moteur ».
- 115 jours, dont 80 composables par B : ± 11 points sur l'ensemble, ± 16 par tercile.
