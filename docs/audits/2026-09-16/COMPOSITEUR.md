# Compositeur par le prix — frontière cote visée / régularité

Régénérable : `pnpm --filter @evcore/backtest-core backtest:composer`.

## Protocole

231819 jambes réglées sur 75 journées, du 2026-07-01 au
2026-09-13. Calibration en **fenêtre glissante** : pour composer la journée
D, le coût de chaque cellule (marché × tranche de cote) n'est estimé que sur les
journées strictement antérieures à D. Les 20 premières
journées servent d'amorce et ne sont pas jouées.

Le compositeur ne voit **aucune probabilité du moteur** : uniquement le prix et
le coût mesuré du marché. Une seule jambe par rencontre, au plus
3 par championnat, 8 jambes au
maximum.

## Frontière — estimateur robuste (borne basse plafonnée à 1)

| Cote visée | Coupons | Refus | Gagnants | Pire série | ROI | Cote moy | Jambes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2 - 3 | 6 | 49 | 0 (0 %) | 6 j | -100.0 % | 2.85 | 2.0 |
| 3 - 5 | 40 | 15 | 3 (8 %) | 25 j | -64.0 % | 4.88 | 2.0 |
| 5 - 8 | 46 | 9 | 9 (20 %) | 12 j | 23.0 % | 6.29 | 2.0 |
| 8 - 15 | 53 | 2 | 1 (2 %) | 44 j | -76.6 % | 12.15 | 2.0 |
| 15 - 30 | 53 | 2 | 0 (0 %) | 53 j | -100.0 % | 22.15 | 2.2 |

## Ce que coûte la naïveté de l'estimateur

Même compositeur, même protocole : seule change la façon d'estimer le coût
d'une cellule. À gauche la moyenne observée, à droite sa borne basse à 95 %.

| Cote visée | Moyenne observée | Borne basse | Borne basse plafonnée à 1 | Écart naïf → robuste |
| --- | --- | --- | --- | --- |
| 2 - 3 | -33.4 % | -100.0 % | -100.0 % | -66.6 % |
| 3 - 5 | -21.8 % | -64.0 % | -64.0 % | -42.2 % |
| 5 - 8 | -52.9 % | 23.0 % | 23.0 % | 75.8 % |
| 8 - 15 | -18.0 % | -76.6 % | -76.6 % | -58.6 % |
| 15 - 30 | -68.1 % | -100.0 % | -100.0 % | -31.9 % |

Sur une tranche de cote longue, quelques gagnants suffisent à faire passer la
moyenne d'une cellule au-dessus de 1. Le compositeur s'y précipite alors, car
c'est exactement ce qu'on lui demande d'optimiser — et il sélectionne du bruit.
C'est la même erreur que la règle d'EV, commise un cran plus haut : dès qu'un
critère est estimé puis maximisé sur la même donnée, il faut créditer la borne
basse, jamais le point.

## Lecture

⚠️ **La colonne ROI ne conclut rien.** Chaque cible ne compte que quelques
dizaines de coupons ; à ces volumes l'erreur type dépasse largement les écarts
affichés. Les deux seules grandeurs exploitables de ce tableau sont le **retour
attendu plafond** et la **mécanique du nombre de jambes**, qui ne dépendent pas
du tirage.

La fréquence de gain et la cote visée sont liées par une contrainte
arithmétique que nulle sélection ne desserre : un coupon à cote C ne gagne pas
plus souvent que (1 + ROI) / C, quelle que soit la qualité du choix des jambes.
Viser la cote 10 en gagnant une fois sur deux n'est pas un objectif difficile,
c'est un objectif impossible. Le seul levier sur la régularité est la cote
visée elle-même.

**Le compositeur choisit systématiquement le minimum de jambes** (2,0 en
moyenne). Ce n'est pas un défaut de réglage : chaque jambe ajoutée est une
multiplication supplémentaire par un nombre inférieur à 1, donc atteindre une
cote donnée coûte toujours moins cher avec peu de jambes longues qu'avec
beaucoup de jambes courtes. Autrement dit, tant que toutes les jambes sont
taxées, **il n'existe aucune intelligence de combinaison à récupérer** : la
combinaison n'est qu'une multiplication, elle n'invente pas d'avantage. C'est
ce que ce backtest établit de plus solide.

Le retour attendu maximal atteint sur l'ensemble des journées et des cibles,
estimateur robuste, est de
**0.9616**.
Tant qu'il reste sous 1,0000, aucun réglage du plancher de refus ne rend le
compositeur rentable : il ne peut que réduire le nombre de coupons joués. C'est
cohérent avec la mesure de l'espace d'opportunités — les 17 marchés coûtent de
4,4 % à 12,2 % et aucun n'est positif
(`docs/audits/2026-09-16/ESPACE-OPPORTUNITES.md`).

Le compositeur est donc correct et prêt ; ce qui lui manque est un marché dont
le coût soit assez faible pour que le produit des jambes dépasse 1. Le seul
candidat mesuré est l'Asian Handicap
(`docs/audits/2026-09-16/ASIAN-HANDICAP.md`).
