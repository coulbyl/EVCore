# L'espace d'opportunités complet — 17 marchés, tous les matchs

Reproductible : concaténer `packages/backtest-core/scripts/market-cells/settled-picks.sql`
et la requête voulue, puis
`docker exec -i evcore-postgres psql -U postgres -d evcore`.

## Ce qui est mesuré

`ModelRun.features.evaluatedPicks` porte **tout ce que le moteur a envisagé**
sur chaque rencontre — 17 marchés, retenus comme rejetés — avec le prix du
marché au moment de l'analyse. C'est exactement l'espace qu'un compositeur de
coupon explore : tous les championnats du jour, tous les matchs, tous les
marchés.

**1,67 M de jambes**, réglées contre le score réel (jamais contre une décision
enregistrée : une décision porte la configuration de son époque). Une seule
analyse par rencontre, la dernière d'avant coup d'envoi. 3 631 rencontres
réglées, du 2026-06-30 au 2026-09-13.

Contrôle du règlement : la somme des taux réalisés vaut **1,0000** sur
ONE_X_TWO, BTTS et RESULT_BTTS, 1,93 sur Double Chance (deux issues vraies sur
trois par match, attendu), 0,73 sur Draw No Bet avec 1 742 remboursements.

Tous les intervalles sont **groupés par rencontre**.

## Le coût de chaque marché (cote 1,25–3,00)

| Marché | Jambes | Renc. | ROI | ± 95 % | P1 | P2 |
| --- | --- | --- | --- | --- | --- | --- |
| TEAM_TOTAL_AWAY | 8947 | 3316 | −4,40 % | 0,88 | −4,22 | −4,56 |
| OVER_UNDER | 14819 | 3631 | −4,66 % | 0,50 | −4,75 | −4,57 |
| TEAM_TOTAL_HOME | 9540 | 3318 | −4,86 % | 0,80 | −4,74 | −4,97 |
| DOUBLE_CHANCE | 7590 | 3309 | −4,87 % | 1,03 | −3,47 | −6,22 |
| DRAW_NO_BET | 4569 | 2559 | −5,17 % | 0,86 | −5,15 | −5,20 |
| CLEAN_SHEET_AWAY | 2184 | 1492 | −5,81 % | 1,95 | −6,10 | −5,53 |
| OVER_UNDER_HT | 10095 | 3628 | −5,81 % | 0,93 | −6,12 | −5,50 |
| CLEAN_SHEET_HOME | 4049 | 2412 | −6,24 % | 1,21 | −5,16 | −7,28 |
| FIRST_HALF_WINNER | 6503 | 3625 | −6,31 % | 1,81 | −6,90 | −5,67 |
| WIN_TO_NIL_AWAY | 614 | 414 | −6,63 % | 3,67 | −8,08 | −5,09 |
| ONE_X_TWO | 4426 | 3484 | −6,87 % | 2,59 | −7,88 | −5,78 |
| BTTS | 7200 | 3623 | −6,88 % | 0,50 | −6,49 | −7,31 |
| TO_WIN_EITHER_HALF | 5355 | 2770 | −7,19 % | 2,23 | −7,66 | −6,82 |
| WIN_TO_NIL_HOME | 2252 | 1372 | −7,36 % | 1,79 | −6,39 | −8,38 |
| RESULT_BTTS | 1579 | 1259 | −9,50 % | 5,35 | −8,53 | −10,49 |
| HALF_TIME_FULL_TIME | 1772 | 1772 | −11,55 % | 5,43 | −12,12 | −10,89 |
| RESULT_TOTAL_GOALS | 6585 | 2579 | −12,17 % | 3,67 | −18,34 | −9,98 |

**Aucun marché n'est positif.** Les meilleures cellules de tout l'espace
(17 marchés × 6 tranches de cote) plafonnent à −1,94 % hors une cellule de
345 jambes à +6,56 % ± 17,34, qui est du bruit.

## Le test qui tranche : est-ce que ça persiste ?

Corrélation entre le ROI de la première moitié de la période et celui de la
seconde, sur des cellules disjointes :

| Niveau | Cellules | Corrélation P1/P2 | Gagnantes P1 | Encore gagnantes P2 | ROI P2 des gagnantes P1 |
| --- | --- | --- | --- | --- | --- |
| **Championnat × marché** | 160 | **−0,022** | 26 | 6 | **−4,68 %** |
| Championnat seul | 16 | 0,171 | 0 | — | — |
| **Marché seul** | 17 | **+0,696** | 0 | — | — |

Trois lectures, et elles se contredisent utilement :

1. **Championnat × marché : corrélation nulle (−0,022).** Une cellule qui gagne
   en juillet ne dit **rien** de son mois d'août. Les 26 cellules gagnantes de
   P1 rendent −4,68 % en P2, pire que la moyenne (−6,16 %). Chercher « le bon
   marché dans le bon championnat » revient à tirer au sort.
2. **Championnat seul : rien non plus** (0,171 sur 16 cellules, aucune
   positive).
3. **Marché seul : corrélation +0,696, forte et stable.** Mais aucun marché
   n'est positif : ce qui persiste est **le montant de la taxe**, pas un edge.

## Conséquence pour le compositeur

Le classement des jambes ne peut pas se faire sur « le marché le plus
susceptible de rentrer » : c'est exactement ce que fait déjà la règle d'EV, et
elle retient les picks que le modèle surestime le plus
(`docs/journal-experiences.md`, angle mort `evaluatedPicks`). Élargir la
recherche à 17 marchés avec ce critère amplifie le biais de sélection.

Le seul classement qui survit à la mesure est **le prix payé** : préférer les
marchés dont la taxe est la plus faible et vérifiée sur deux périodes, prendre
le meilleur prix disponible parmi les books (mesuré à **+1,19 %** de cote sur
l'Asian Handicap), et refuser de composer quand la meilleure combinaison du
jour reste négative.

Réserve : ces ROI sont au prix d'un seul bookmaker, celui qu'a retenu le
moteur. Le shopping ramènerait ~1,2 point sur chaque ligne — insuffisant pour
faire passer le moins cher (−4,40 %) au-dessus de zéro. L'Asian Handicap, à
3,98 % de marge et avec le biais favori mesuré, reste moins cher que **tous**
les marchés de ce tableau : c'est la raison pour laquelle c'est la seule piste
ouverte (`docs/audits/2026-09-16/ASIAN-HANDICAP.md`).
