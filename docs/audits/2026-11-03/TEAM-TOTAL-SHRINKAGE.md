# TEAM_TOTAL : un retrait plus fort sur la tranche 1,45–1,80

_03/11/2026, phase 5 étape 1 du plan du 03/11 (`docs/plan-strategies-2026-11-03.md`). Copie de prod du 03/11. Script : `packages/backtest-core/scripts/backtest-team-total-band-shrinkage.ts` (`pnpm --filter @evcore/backtest-core backtest:team-total-band-shrinkage`), chaîne de production partagée avec le rejeu du 06/10 dans `scripts/production-chain.ts`. Sortie : `outputs/backtest-team-total-band-shrinkage.txt`._

## Réponse courte

1. **Rien n'est expédié.** Le retrait plus fort sur la tranche ne fait pas passer le ratio réalisé ÷ annoncé au-dessus de 0,90 hors échantillon, dans aucun des deux sens : **0,792 → 0,781** (ajusté sur l'ancienne moitié, F = 0,8) et **0,836 → 0,854** (ajusté sur la récente, F = 0,4). Sous 1,45, rien ne se dégrade (0,960 → 0,960 et 0,928 → 0,922).
2. **Le rejeu retrouve le défaut mesuré en direct** : 0,836 et 0,792 sur la tranche (371 et 367 jambes par moitié) pour 0,83 sur 1 796 jambes en direct ; 0,93–0,96 sous 1,45 pour 0,96.
3. **Aucun F de la grille ne corrige la tranche**, même en ramenant la probabilité au taux de base (F = 0) : 0,78 à 0,87 partout. Le défaut n'est pas un excès d'écart au taux de base du championnat ; c'est l'écart au **prix**. Sur ces matchs, une cote de 1,45 à 1,80 dit 55 à 69 % (marge comprise) ; le moteur annonce 74–76 %, il en tombe 59–64 %. Le taux de base du choix (51 à 80 % selon la ligne) ne sait pas ce que le prix sait du match.

## Hypothèse, fixée avant le rejeu

Ramener la probabilité d'un choix TEAM_TOTAL coté dans [1,45 ; 1,80[ vers le taux de base de ce choix (côté × ligne × sens, toutes ligues, mesuré sur la moitié d'ajustement) — `p' = base + F × (p − base)`, la forme des blocs de `OU_SHRINKAGE_CONFIG` — fait passer le ratio de la tranche au-dessus de 0,90 hors échantillon, sans dégrader la tranche sous 1,45.

Protocole, figé lui aussi :

- deux moitiés par date de coup d'envoi (coupure à la médiane, 09/09) ;
- sur la moitié d'ajustement : taux de base, puis F choisi sur la grille 1 / 0,8 / 0,6 / 0,4 / 0,2 / 0 par « |ratio de la tranche − 1| minimal » (à égalité, le retrait le plus faible) ;
- une seule mesure sur l'autre moitié, dans les deux sens ;
- expédition seulement si, dans les deux sens, la tranche dépasse 0,90 et la tranche sous 1,45 ne perd pas plus de 0,01.

Le retrait est appliqué au contexte avant la décision : il change ce qui passe le seuil, la ligne retenue par le classement de production (`probability_in_band` 1,20–1,80) et la probabilité annoncée.

## Ce qui est rejoué

Matchs finis du 01/06 (premières cotes TEAM_TOTAL : 31/05) au 03/11, dans les ligues où TEAM_TOTAL tourne : 6 085, dont 5 900 rejoués (185 sans team_stats ou sans cotes à l'heure de décision). Décision à coup d'envoi − 1 h, avec la chaîne de production du moteur (team_stats point-in-time, λ, ajustement H2H, Poisson, blend 1X2, shrinkage actuel, signaux H2H par marché, congestion) et les cotes connues à cet instant, puis `decideTeamTotal` avec les lignes de la ligue. Réglé contre le score.

## Résultats hors échantillon

| Sens                        | F retenu | Tranche     | Jambes (F = 1 → F) | Ratio F = 1 (IC 95 %)     | Ratio au F retenu (IC 95 %) |
| --------------------------- | -------: | ----------- | -----------------: | ------------------------- | --------------------------- |
| ajusté ancienne → test récente |    0,8 | 1,45–1,80   |          367 → 363 | 0,792 [0,724 ; 0,860]     | 0,781 [0,711 ; 0,851]       |
|                             |          | sous 1,45   |      2 457 → 2 463 | 0,960 [0,938 ; 0,981]     | 0,960 [0,939 ; 0,982]       |
| ajusté récente → test ancienne |    0,4 | 1,45–1,80   |          371 → 412 | 0,836 [0,772 ; 0,900]     | 0,854 [0,791 ; 0,917]       |
|                             |          | sous 1,45   |      2 057 → 2 027 | 0,928 [0,904 ; 0,952]     | 0,922 [0,898 ; 0,945]       |

Lecture :

- **Les deux F retenus ne se ressemblent pas** (0,8 et 0,4) et ce qui gagne sur une moitié ne gagne pas sur l'autre : c'est du bruit de sélection, la règle du 06/10 (« une porte de validation seule est une sélection ») s'applique.
- **Plus de retrait ne monte pas le ratio, il fait entrer d'autres jambes dans la tranche** : à F = 0, la tranche passe de ~370 à 530–665 jambes et le ratio tombe à 0,77–0,81 : ramener vers le taux de base remonte aussi les choix que le moteur annonçait sous ce taux, qui passent alors le seuil et entrent dans la tranche. Retirer de la probabilité aux choix de la tranche déplace le classement, il ne corrige pas ce qui y reste.
- Sous 1,45, le ratio ne bouge pas (± 0,01) : l'hypothèse ne casse rien, elle ne sert simplement à rien.

## Ce que ça veut dire

Le moteur se trompe entre 1,45 et 1,80 parce qu'il est d'accord avec lui-même et pas avec le prix : quand une cote d'équipe est à 1,60, le book sait déjà que ce match n'est pas un match moyen, et le taux de base du championnat ne le sait pas. Le seul retrait qui corrigerait la tranche est un retrait vers la fréquence du marché, c'est-à-dire la grille de marché comme entrée du moteur — phase 3 redéfinie le 29/10 (`docs/audits/2026-10-29/ML-V2-PROPOSITION.md`), hors de cette phase.

En attendant, rien n'est perdu côté joueur : les produits coupent déjà à 1,80, les jambes TEAM_TOTAL de la tranche ne vont dans aucun coupon court (Combiné, Favori : < 1,50), et la pastille canal × compétition sur 90 jours abaisse déjà les cellules qui annoncent trop.

## Ce qui a changé dans le code

Rien dans le moteur. Le rejeu de la chaîne de production est sorti de `backtest-strategy-ranking.ts` vers `scripts/production-chain.ts` (`replayContext`), partagé par les deux scripts ; le rejeu du 06/10 est inchangé.
