> Rejeu du 2026-10-12 sur le dump du 2026-10-10 (2026-07-01 → 2026-10-10), cibles courtes 1,3–1,6 et 1,5–2 ajoutées. Lecture dans `MESURES-DECISIONS-COUPONS.md` §3.

# Compositeur par le prix — frontière cote visée / régularité

Régénérable : `pnpm --filter @evcore/backtest-core backtest:composer`.

## Protocole

318861 jambes réglées sur 102 journées, du 2026-07-01 au
2026-10-10. Calibration en **fenêtre glissante** : pour composer la journée
D, le coût de chaque cellule (marché × tranche de cote) n'est estimé que sur les
journées strictement antérieures à D. Les 20 premières
journées servent d'amorce et ne sont pas jouées.

Le compositeur ne voit **aucune probabilité du moteur** : uniquement le prix et
le coût mesuré du marché. Une seule jambe par rencontre, au plus
3 par championnat, 8 jambes au
maximum.

## Frontière — estimateur robuste (borne basse plafonnée à 1)

| Cote visée | Coupons | Refus | Gagnants  | Pire série | ROI      | Cote moy | Jambes |
| ---------- | ------- | ----- | --------- | ---------- | -------- | -------- | ------ |
| 1.3 - 1.6  | 6       | 76    | 6 (100 %) | 0 j        | 57.7 %   | 1.58     | 2.0    |
| 1.5 - 2    | 50      | 32    | 23 (46 %) | 4 j        | -10.9 %  | 1.95     | 2.0    |
| 2 - 3      | 19      | 63    | 3 (16 %)  | 12 j       | -59.4 %  | 2.78     | 2.1    |
| 3 - 5      | 61      | 21    | 7 (11 %)  | 14 j       | -45.5 %  | 4.86     | 2.0    |
| 5 - 8      | 66      | 16    | 13 (20 %) | 15 j       | 25.0 %   | 6.29     | 2.0    |
| 8 - 15     | 77      | 5     | 4 (5 %)   | 44 j       | -31.4 %  | 12.19    | 2.0    |
| 15 - 30    | 79      | 3     | 0 (0 %)   | 79 j       | -100.0 % | 21.98    | 2.1    |

## Ce que coûte la naïveté de l'estimateur

Même compositeur, même protocole : seule change la façon d'estimer le coût
d'une cellule. À gauche la moyenne observée, à droite sa borne basse à 95 %.

| Cote visée | Moyenne observée | Borne basse | Borne basse plafonnée à 1 | Écart naïf → robuste |
| ---------- | ---------------- | ----------- | ------------------------- | -------------------- |
| 1.3 - 1.6  | 30.6 %           | 57.7 %      | 57.7 %                    | 27.1 %               |
| 1.5 - 2    | -7.5 %           | -10.9 %     | -10.9 %                   | -3.4 %               |
| 2 - 3      | -43.6 %          | -59.4 %     | -59.4 %                   | -15.7 %              |
| 3 - 5      | -24.1 %          | -45.5 %     | -45.5 %                   | -21.4 %              |
| 5 - 8      | -46.2 %          | 25.0 %      | 25.0 %                    | 71.2 %               |
| 8 - 15     | -28.7 %          | -31.4 %     | -31.4 %                   | -2.7 %               |
| 15 - 30    | -47.9 %          | -100.0 %    | -100.0 %                  | -52.1 %              |

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
