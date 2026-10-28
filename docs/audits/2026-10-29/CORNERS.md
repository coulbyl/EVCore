# Le Chasseur Corners

_Lot 6 (`docs/plan-lot-6-2026-10-29.md`). Copie de prod du 24/10. Sources : sonde `probe:extras` (API-Football, 29/10), cotes Pinnacle en base depuis le 15/09, stats de match (`fixture_statistic`)._

## Réponse courte

1. **Parmi les extras, 1xBet ne cote que les corners.** Sur 5 matchs de grands championnats, il propose 8 à 9 marchés de corners. Les cartons n'ont qu'une seule ligne, sur 2 matchs sur 5. Tirs, tirs cadrés, fautes, hors-jeu et arrêts : **rien chez 1xBet** dans notre flux, seul Bet365 les sert.
2. **Le marché des corners est calibré.** Sur 1 564 matchs avec cotes Pinnacle, 49,9 % sont annoncés et 49,9 % réalisés (± 1,5). À mise fixe, on perd −5,4 % sur le plus et −5,7 % sur le moins, c'est-à-dire la marge. Les cartons donnent le même résultat (535 matchs). Aucun modèle maison ne prétend faire mieux.
3. **1xBet coûte plus cher** : environ 9,5 % sur le plus/moins total (sonde), contre 6,3 % de marge médiane chez Pinnacle. C'est du niveau du plus/moins buts chez 1xBet (10,3 %), et loin du 1X2 des grands championnats (1,5 %).
4. **Le chasseur est un pari de variété, pas un avantage.** Il prend le côté le moins cher de la journée, entre 1,70 et 2,10, et seulement dans les championnats où les stats arrivent : il en faut pour régler le pari.

## Rejeu de la règle (prix Pinnacle, 16/09 – 24/10)

1xBet n'est collecté qu'à partir de ce lot : le rejeu se fait sur le seul prix historique, Pinnacle.

| Jours composés | Cote moyenne | Marge Pinnacle moyenne | Marché (sans marge) |       Réalisé | À mise fixe (Pinnacle) |
| -------------: | -----------: | ---------------------: | ------------------: | ------------: | ---------------------: |
|      38 sur 39 |         1,87 |                 4,51 % |              51,2 % | 52,6 % ± 16,1 |                 −1,4 % |

18 « plus » et 20 « moins ». Sur 38 jours, l'écart au marché est du bruit. Au prix 1xBet, avec environ 5 points de marge de plus que le côté Pinnacle choisi, le coût attendu est d'environ −6 % à mise fixe.

## Les stats de corners, condition du règlement

- Les stats sont réécrites à chaque synchronisation (04:00 UTC), donc leur date d'écriture ne dit pas quand elles sont arrivées.
- Ce qui compte, c'est si elles arrivent. Dans les grands championnats, **100 % des matchs** finissent par avoir leurs corners. Certains petits championnats n'en ont jamais (ARG2, USA2, NOR2, POL2, KOR2, CHN2, ISL1… : 0 %).
- Règle du chasseur : un championnat est jouable si au moins 95 % de ses matchs finis depuis plus de 3 jours ont leurs corners, sur 60 jours. **42 championnats** passent, dont les cinq grands, la Ligue des champions, la MLS, l'Argentine et le Brésil.
- Une jambe dont les stats ne viennent jamais est **remboursée après 14 jours**, jamais comptée perdue.

## Ce que le lot livre

- Les cotes corners de 1xBet sont gardées à l'ingestion, et nulle part ailleurs (`OPERATOR_EXTENDED_MARKETS`).
- Une colonne `line` sur les jambes de coupon, et la cote 1xBet d'une ligne lue sur la paire plus/moins d'un même relevé.
- Le Chasseur Corners (`HUNTER_CORNERS`, 1,70–2,10) : le côté le moins cher, puis le plus probable. Matchs AVOID exclus.
- Le règlement sur les stats de match, avec délai de grâce.
- À l'écran : « Moins de 9,5 corners », et « 1xBet prend X % » sur la jambe. Le coupon se suit avec « Suivre ce coupon », mais ne se déclare pas, parce qu'un pari déclaré n'a pas de ligne.

## À relire

Vers le 10/12, avec le prix 1xBet réel : jours composés, réalisé contre marché par jambe, marge 1xBet payée, et part des jambes remboursées faute de stats.
