# Chasseur Nul à la mi-temps — rejeu sur les clôtures

_04/11/2026, phase 1 du plan du 03/11 (`docs/plan-strategies-2026-11-03.md`). Copie de prod du 03/11. Clôtures `odds_closing_line` du marché `FIRST_HALF_WINNER` à moins de 24 h du coup d'envoi, matchs finis avec score à la mi-temps. Scripts : `scripts/ht-draw-closings.sql` (extraction), `scripts/ht-draw-replay.py` (rejeu)._

## Réponse courte

1. **Le marché est calibré, la règle aussi.** Sur 14 291 matchs, Pinnacle annonce 39,7 % de nuls à la mi-temps et il en tombe 40,0 % ± 0,8 (marge 4,7 %, cote moyenne 2,44) : les chiffres de l'étude (§ 3.1) se retrouvent exactement.
2. **La règle rejouée** (un nul à la mi-temps par jour, cote 2,10 à 2,80, la marge la plus basse d'abord) : composée **847 jours sur 889**, cote moyenne 2,40, **gagnée 39,7 % ± 3,3** des jours pour 40,3 % annoncés.
3. **Ce n'est pas un avantage.** Au prix Pinnacle, le retour est de 0,950 ± 0,079 par unité misée ; au prix 1xBet, environ 0,90. C'est le coût du marché, rien de plus : on propose un pari de variété au juste prix du marché, comme le Chasseur Nul.
4. **Pire série : 12 jours perdus de suite** sur trois ans, 5 à 6 sur sept semaines. C'est l'arithmétique d'un pari gagné deux fois sur cinq : sur 850 jours, la plus longue série attendue est d'environ 11 jours. Le plan en attendait ~6 en lisant une période plus courte.

## Le marché, tous les matchs

| Book                             | Matchs | Annoncé (sans marge) |      Réalisé | Marge | Cote moyenne du nul |
| -------------------------------- | -----: | -------------------: | -----------: | ----: | ------------------: |
| Pinnacle                         | 14 291 |               39,7 % | 40,0 % ± 0,8 | 4,7 % |                2,44 |
| Pinnacle, nul entre 2,10 et 2,80 | 11 592 |               40,2 % | 40,3 % ± 0,9 | 4,7 % |                2,39 |
| 1xBet (depuis le 16/09)          |  2 890 |               40,6 % | 40,1 % ± 1,8 | 9,9 % |                2,28 |

La bande 2,10–2,80 garde 81 % des matchs : presque chaque jour en a un. La marge de 1xBet sur ce marché est le double de celle de Pinnacle (9,9 % contre 4,7 %), d'où une cote du nul plus courte de 0,15 en moyenne.

## La règle rejouée, un pari par jour

Par jour de coup d'envoi (UTC) : parmi les matchs dont le nul à la mi-temps est coté de 2,10 à 2,80, le groupe à trois issues à la marge la plus basse, puis la fréquence du marché la plus haute. Rejoué sur les clôtures Pinnacle (classement sur la marge Pinnacle : 1xBet n'est relevé que depuis le 16/09).

| Période / règle                       |   Jours | Gagnés |      Réalisé | Annoncé | Cote | Marge retenue | Retour / unité (Pinnacle) | Pire série |
| ------------------------------------- | ------: | -----: | -----------: | ------: | ---: | ------------: | ------------------------: | ---------: |
| 2023-08 → 2026-11, bande 2,10–2,80    | 847/889 |    336 | 39,7 % ± 3,3 |  40,3 % | 2,40 |         3,6 % |             0,950 ± 0,079 |         12 |
| même période, bande 2,20–2,70 (étude) | 823/889 |    331 | 40,2 % ± 3,4 |  40,2 % | 2,41 |         3,7 % |             0,962 ± 0,080 |         11 |

Par année (bande 2,10–2,80) :

| Année | Jours |       Réalisé | Annoncé | Retour / unité | Pire série |
| ----- | ----: | ------------: | ------: | -------------: | ---------: |
| 2023  |    60 | 46,7 % ± 12,6 |  40,5 % |          1,128 |          9 |
| 2024  |   209 |  42,1 % ± 6,7 |  39,7 % |          1,028 |          8 |
| 2025  |   282 |  35,1 % ± 5,6 |  40,5 % |          0,837 |         10 |
| 2026  |   296 |  40,9 % ± 5,6 |  40,6 % |          0,967 |         12 |

Les écarts d'une année à l'autre sont dans le bruit (± 6 points sur 200 à 300 jours) ; l'ensemble réalise ce qu'il annonce. La bande de l'étude (2,20–2,70) et celle du plan (2,10–2,80) donnent la même chose ; on garde 2,10–2,80, qui compose plus de jours.

## Au prix 1xBet

Le joueur paie chez 1xBet. Deux lectures :

- **L'écart de marge sur tout le rejeu** : retour Pinnacle 0,950 × (1 + 3,6 %) / (1 + 9,9 %) ≈ **0,90 par unité**.
- **La règle telle qu'en production**, bande et coût lus chez 1xBet, du 16/09 au 03/11 : composée 48 jours sur 49, cote 2,33, gagnée 33,3 % ± 13,3 pour 39,9 % annoncés, marge payée 8,2 %, pire série 5. Sur les mêmes jours, la règle Pinnacle gagne 36,7 % ± 13,5 (pire série 6). Sept semaines ne départagent rien (± 13 points).

Les 47 jours où 1xBet cote aussi le match retenu par la règle Pinnacle : 0,906 de retour chez Pinnacle, 0,829 chez 1xBet. Classer sur la marge payée chez 1xBet (ce que fait la production) retient une marge de 8,2 % au lieu de 9,1 % pour les mêmes jours.

## Ce qui est livré

- `HUNTER_HT_DRAW` : `FIRST_HALF_WINNER`/`DRAW`, cote 1xBet 2,10 à 2,80, la marge 1xBet la plus basse d'abord, matchs AVOID exclus, source `PRICE_COMPOSER`, après le Chasseur Nul.
- **Le vivier lit tous les matchs cotés.** La porte du moteur sur les championnats sans historique de mi-temps (`htftCalibrated`) rejette ~85 % des lignes `FIRST_HALF_WINNER` en `market_suspended` : elle protège le Poisson du moteur, ce produit ne lit que le prix. Seule une vraie suspension du marché (`calibration.market_suspension`, aucune aujourd'hui) l'arrête. Sans cela, le chasseur n'aurait vu que 0 à 44 nuls par jour au lieu de 18 à 193 (25/10 → 05/11).
- Chance affichée : la fréquence du marché sans marge (Shin sur le groupe 1xBet au-dessus de 1,80), jamais 1 / cote, jamais la probabilité du moteur. Aucune marge montrée au joueur.
- Règlement sur `homeHtScore`/`awayHtScore` : un match fini sans score à la mi-temps attend, puis est remboursé après 14 jours, jamais compté perdu (17 matchs finis sur 7 076 en 120 jours).

## Limites

- Rejeu à la clôture Pinnacle, pas à la cote d'analyse de la veille au soir ; le prix publié est celui de 20 h la veille, en moyenne un peu plus long ou plus court sans biais connu.
- Les matchs AVOID et les alertes de calibration ne sont pas retirés du rejeu (le méta-canal n'existe pas sur tout l'historique) : ils retirent quelques matchs par jour sur des centaines.
- Retour par unité : rapporté pour mémoire, sans puissance pour départager des règles (CLAUDE.md). Le produit se lit jambe par jambe : réalisé contre fréquence annoncée.
