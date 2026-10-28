# Le combiné du jour : rejoué avec la méthode de l'étude

_28/10/2026, suite de `SELECTIONS-LAISSEES.md`. Même copie de prod (116 jours, 01/07 → 24/10). Scripts : `scripts/combo.py`, `combo_check.py`, `combo_persist.py` ; sorties `combo-*-out.txt`._

## Réponse courte

**On ne change pas le combiné.** Pour le coupon cote 2, composer sur tout ce qui est coté et classer par le prix gagnait sur tous les plans. Pour le combiné, ce n'est pas le cas :

- **L'élargissement fait gagner** 8 jours couverts, 1,7 point de coût et une pire série plus courte.
- **La règle actuelle réalise davantage.** Ses jambes passent 8,8 points plus souvent que le marché ne l'annonce, contre 2,4 points pour « tout ce qui est coté ». L'écart tient sur les deux périodes.
- Ce n'est pas assez solide pour conclure que le moteur bat le marché. C'est assez pour ne pas remplacer une règle qui réalise plus par une règle qui coûte un peu moins.

## Les règles comparées

Partout : deux jambes, une par match, de championnats différents, cote de jambe entre 1,20 et 1,50. Les matchs « Données suspectes », les types de pari suspendus et le « remboursé si nul » sont exclus.

- **A. Règle actuelle**, rejouée à l'identique (`composeEngineCombo`). On part de nos sélections retenues. On garde la sélection principale de chaque match, si son canal est calibré sur la compétition : réalisé ÷ annoncé ≥ 0,70 sur au moins 30 paris, dans les 90 jours **précédents**. On retient ensuite les deux cotes les plus basses.
- **B. Méthode de l'étude** : tout ce qui est coté, classé par la probabilité du marché sans marge.
- **C. Mélange** : le vivier de A, classé par la probabilité du marché.

## Résultats

| Règle                                    |   Jours | Cote moy. | Annoncé (marché) | Réalisé | Pire série | Coût au prix d'analyse |
| ---------------------------------------- | ------: | --------: | ---------------: | ------: | ---------: | ---------------------: |
| A. Règle actuelle                        | 106/116 |      1,53 |           63,4 % |  71 ± 9 |          5 |                −11,1 % |
| B. Tout ce qui est coté, classé par prix | 114/116 |      1,46 |           62,0 % |  65 ± 9 |          3 |                 −9,4 % |
| C. Vivier actuel, classé par prix        | 106/116 |      1,55 |           59,1 % |  70 ± 9 |          3 |                −10,7 % |

Le coût est calculé au **même prix pour tous**, la cote d'analyse. Un premier calcul mélangeait deux sources de prix et donnait à A un faux −3,7 %.

### Par jambe : réalisé moins probabilité du marché

| Ensemble                                                       | Jambes | Écart au marché | Juil.–août | Sept.–oct. |
| -------------------------------------------------------------- | -----: | --------------: | ---------: | ---------: |
| A, les deux jambes retenues chaque jour                        |    184 |  **+8,8 ± 5,0** | +9,7 ± 7,2 | +7,8 ± 7,0 |
| B, les deux jambes retenues chaque jour                        |    228 |      +2,4 ± 5,1 | +2,0 ± 7,1 | +2,8 ± 7,3 |
| Tout le vivier éligible de A (pas seulement les deux retenues) |  3 081 |  **+2,3 ± 1,5** | +3,3 ± 2,6 | +1,8 ± 1,9 |
| Tout le reste coté, même tranche 1,20–1,50                     | 32 535 |      +0,7 ± 0,5 |          — |          — |
| Référence, tout ce qui est coté à 1,20–1,25                    |  7 708 |      +1,1 ± 0,9 |          — |          — |

À même cote, le reste du marché passe environ 1 point au-dessus de sa probabilité : c'est le biais favori–outsider.

Le vivier de « Notre sélection » fait un peu mieux : +2,3 contre +0,7, sur les deux périodes. Les deux jambes que la règle actuelle en retient chaque jour font beaucoup mieux (+8,8), surtout en double chance et en buts.

## Comment le lire

- **C'est le premier indice mesuré que le moteur apporte quelque chose**, sur un sous-ensemble précis : la sélection principale des canaux calibrés sur la compétition, à cote courte.
  - Il contredit en partie l'étude principale. Celle-ci ne trouvait aucun écart entre nos sélections et ce qu'on laisse (+0,4 point), mais elle comparait **toutes** nos sélections retenues, sans le filtre de calibration ni le choix de la sélection principale.
- **Ce n'est pas une preuve.** Pour l'ensemble du vivier, l'écart de +1,6 point vaut environ deux erreurs-types. Pour les deux jambes retenues, +8,8 repose sur 184 jambes, et plusieurs découpages ont été essayés. L'avantage de B en coût (1,7 point) est précis, mais petit.
- **Décision : rien ne change.** La règle actuelle reste ; elle exclut déjà le « remboursé si nul », et sa fréquence affichée vient désormais du marché.

## À refaire

- **Relancer ce rejeu vers le 10/12**, soit environ 45 jours de plus, avec les mêmes scripts sur une copie de prod fraîche.
  - Si le vivier éligible garde environ +2 points au-dessus du marché, et les deux jambes retenues nettement plus, l'indice devient un résultat : on le garde et on cherche pourquoi.
  - S'il retombe vers +1 point, c'était du bruit, et le combiné passe à la méthode B.
- **L'étude du choix de Notre sélection sur chaque match**, étape 4 de l'ordre recommandé, teste directement cet indice sur toutes les cotes, pas seulement sur le combiné.
