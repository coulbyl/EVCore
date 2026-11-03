# Corners, tirs, cartons : quelles stratégies ?

_Étude du 03/11, demandée par l'utilisateur : « le corners, les tirs, cartons, on devrait avoir des stratégies pour ça aussi afin de les inclure comme marchés ». Copie de prod du 03/11 04:01, suite de `docs/audits/2026-10-29/CORNERS.md` (lot 6)._

## Réponse courte

1. **Un marché ne devient une stratégie que si le joueur peut le jouer et si on peut le régler.** Il faut donc deux choses : une cote chez 1xBet, et la stat du match en base.
2. **Corners (match entier)** : les deux conditions sont réunies. C'est le Chasseur Corners (lot 6), le côté le moins cher entre 1,70 et 2,10, à relire le 10/12. Le marché tombe juste, il n'y a pas d'avantage à en attendre.
3. **Cartons** : le marché de Pinnacle tombe juste lui aussi. On a les stats (cartons jaunes sur 47 000 matchs). Mais **on jetait les cotes cartons de 1xBet à l'ingestion**, si bien qu'on ne sait pas s'il y a assez à jouer. Cette PR les garde. Dans deux semaines, on saura si un Chasseur Cartons tient.
4. **Tirs** : pas de stratégie possible. 1xBet ne cote aucun marché de tirs dans notre flux (sonde du 29/10), et aucun autre book qu'on ingère ne le fait non plus. Les stats existent (tirs, tirs cadrés sur 47 000 matchs), mais il n'y a pas de pari à proposer.
5. **Corners à la mi-temps** : Pinnacle les cote sur 1 525 matchs, mais nos stats de match ne distinguent pas les mi-temps. Le pari ne peut pas être réglé, donc il n'y a pas de stratégie tant qu'on ne collecte pas les stats par mi-temps.

## Ce qu'on reçoit (cotes relevées depuis le 15/10)

| Marché           | Book     |                 Matchs | Relevés |
| ---------------- | -------- | ---------------------: | ------: |
| Corners          | Pinnacle |                  1 525 |  74 108 |
| Corners          | 1xBet    |                    511 |  44 354 |
| Corners mi-temps | Pinnacle |                  1 525 |  43 852 |
| Cartons          | Pinnacle |                    406 |  16 256 |
| Cartons          | 1xBet    | — (jeté à l'ingestion) |       — |
| Tirs             | aucun    |                      — |       — |

Stats de match en base (`fixture_statistic`, matchs avec la stat) : corners 47 790, tirs cadrés 47 671, tirs 47 578, cartons jaunes 46 963, cartons rouges 12 462 (la stat n'est écrite que lorsqu'il y en a eu).

## Le marché des cartons tombe juste

Lignes en ,5 de Pinnacle à moins de 6 h du coup d'envoi, paire plus/moins dé-margée, matchs finis avec les cartons des deux équipes : **1 836 matchs**.

| Mesure                                        | Valeur |
| --------------------------------------------- | -----: |
| Probabilité du « plus », marché sans marge    | 50,1 % |
| « Plus » réalisé, en comptant jaunes + rouges | 48,7 % |
| « Plus » réalisé, en comptant le rouge double | 51,3 % |
| « Plus » réalisé, jaunes seuls                | 45,3 % |
| Marge Pinnacle                                |  6,5 % |

Les deux décomptes usuels encadrent le marché à ± 1,3 point, dans le bruit (± 2,3). Le marché est calibré, comme celui des corners (49,9 % annoncés, 49,9 % réalisés, lot 6). Un modèle maison ne fera pas mieux que le prix (CLAUDE.md, moteur derrière le marché). Un chasseur cartons serait un pari de variété au prix du marché, comme le Chasseur Corners.

**Le décompte compte pour le règlement.** Chez 1xBet, « total cartons » compte souvent un rouge pour un, ou deux selon le marché. Il faudra lire l'intitulé exact du marché 1xBet avant de régler sur `yellow_cards + red_cards`.

## Ce que livre la PR

- `OPERATOR_EXTENDED_MARKETS = ['CORNERS', 'CARDS']` : les cotes cartons de 1xBet sont gardées à l'ingestion, lignes en ,5 seulement, comme les corners. Le volume est faible : la sonde du 29/10 ne trouvait qu'une ligne, sur 2 matchs sur 5.
- Aucun produit nouveau.

## Prochaines étapes

1. **Vers le 17/11 : décider d'un Chasseur Cartons**, à trois conditions :
   - 1xBet cote les cartons sur assez de matchs par jour (au moins 5 dans les championnats où les stats arrivent) ;
   - sa marge est lisible (paire plus/moins sur une même ligne) ;
   - l'intitulé dit comment se compte un rouge.

   Même forme que le Chasseur Corners : le côté le moins cher, puis le plus probable, et remboursé si les stats ne viennent jamais.

2. **Corners à la mi-temps** : demander à API-Football les stats par mi-temps (paramètre `half` de `/fixtures/statistics`). C'est un appel de plus par match fini, à mettre en regard du quota. Sans ces stats, pas de règlement possible.
3. **Tirs** : rien à faire tant qu'aucun book du flux ne les cote. Si 1xBet les ajoute un jour, la sonde `probe:extras` le dira.
4. **Modèles (lot ML v2, phase 3)** : les corners et les cartons font partie des pistes où le prix ne dit peut-être pas tout. Elles seront jugées sur le résidu face à Pinnacle, jamais sur le Brier absolu (`docs/audits/2026-10-29/ML-V2-PROPOSITION.md`).
