# Le combiné IA à cote 4–10

_Étude du 03/11, demandée par l'utilisateur : « le combiné IA, la cote est trop petite, je pense qu'on peut aller de 4 à 10 avec l'IA ». Copie de prod du 03/11 04:01. Scripts : `scripts/ai-plays.sql`, `scripts/ai-combo.py`._

## Réponse courte

1. **Oui, c'est faisable, à condition de combiner les avis de l'IA elle-même.** Aujourd'hui le combiné IA, c'est l'IA qui choisit 2 jambes de 1,20 à 1,50 (cible 1,4) dans le vivier du moteur. Il n'est plus montré aux joueurs depuis la refonte (décision du 29/10).
2. **Les avis de l'IA entre 1,45 et 1,80 sont calibrés** : 1,05 en v4, 1,10 en v5 (± 0,06), 0,99 sur toute la période. Les jambes du moteur dans la même tranche annoncent trop (0,94). Aucune des deux sources ne bat la cote : elles réalisent ~60 % pour ~62 % de prix payé.
3. **La règle rejouée** : 3 ou 4 avis joués par l'IA, entre 1,45 et 1,80, un par championnat, le marché le moins cher d'abord, jusqu'à une cote combinée de 4 à 10.
   - Composé **36 jours sur 44**, cote ~5,2, **gagné 1 jour sur 3** (annoncé 1 sur 4), pire série 8 jours.
4. **C'est de l'arithmétique, pas un avantage.** Un jour sur trois à cote 5 tient parce que les jambes sont calibrées. Le retour de 1,78 par unité mesuré sur 36 jours n'a aucune puissance (CLAUDE.md) : il faut attendre la marge, soit ~0,9 par unité au prix 1xBet.

## Calibration des avis joués de l'IA, par tranche de cote

Dernier avis joué avant le coup d'envoi, par match fini et réglé (1 712 avis, 08/09 – 03/11) :

| Version | Cote            | Avis |       Réalisé | Annoncé | Prix payé (1/cote) | Réalisé ÷ annoncé |
| ------- | --------------- | ---: | ------------: | ------: | -----------------: | ----------------: |
| v3      | 1,45 – 1,80     |  397 |  59,7 % ± 4,8 |  60,5 % |             62,1 % |              0,99 |
| v4      | 1,45 – 1,80     |  162 |  61,1 % ± 7,5 |  58,3 % |             62,0 % |              1,05 |
| v5      | 1,45 – 1,80     |  209 |  65,6 % ± 6,4 |  59,7 % |             62,6 % |              1,10 |
| v5      | au-delà de 1,80 |   27 | 33,3 % ± 17,8 |  53,9 % |             55,6 % |              0,62 |

Même tranche, toutes sélections de rang 1 dédoublonnées (`channel_selection_deduped`, depuis le 08/09) : l'IA réalise 59,9 % pour 60,3 % annoncés (0,99, n = 1 359), le moteur hors score exact 60,4 % pour 64,2 % (0,94, n = 4 896).

Le plafond de 1,80 reste nécessaire : au-delà, la calibration de l'IA s'effondre, comme celle de toutes les jambes (CLAUDE.md).

## Rejeu des règles de composition

Un combiné par jour de coup d'envoi, avec les avis de ce jour-là. Pour chaque règle : v4 + v5 (13/10 – 03/11, 22 jours avec des avis réglés, la panne Together du 10/10 au 28/10 en retire) puis toute la période (v3 et plus, 44 jours).

| Règle                               | Période | Jours composés | Jambes | Cote |    Gagnés | Joint annoncé | Jambes réalisé ÷ annoncé | Pire série |
| ----------------------------------- | ------- | -------------: | -----: | ---: | --------: | ------------: | -----------------------: | ---------: |
| 1,45–1,80, le moins cher d'abord    | v4 + v5 |        20 / 22 |    3,4 |  5,0 |  7 (35 %) |          22 % |                1,13 (68) |          5 |
| 1,45–1,80, le moins cher d'abord    | v3 et + |        36 / 44 |    3,5 |  5,2 | 12 (33 %) |          25 % |               0,98 (126) |          8 |
| 1,45–1,80, le plus probable d'abord | v3 et + |        36 / 44 |    3,5 |  5,2 | 10 (28 %) |          26 % |               0,94 (127) |          8 |
| 1,20–1,80, le plus long d'abord     | v3 et + |        36 / 44 |    3,0 |  5,0 |  9 (25 %) |          20 % |               0,98 (108) |          4 |
| 1,20–1,80, le moins cher d'abord    | v3 et + |        14 / 44 |    3,9 |  4,8 |  5 (36 %) |          23 % |                0,95 (54) |          4 |

Lecture :

- « Le moins cher d'abord » suit le seul résultat qui persiste d'une période à l'autre : le coût du marché (r = +0,70). On ne retient pas une règle sur 36 jours de gains.
- La marge payée n'est enregistrée sur les avis que depuis le 27/10. Avant, le classement retombe sur la probabilité.
- Avec des jambes de 1,20 à 1,45, il en faut trop pour atteindre 4 : le combiné n'est composé qu'un jour sur trois.
- Les cotes rejouées sont celles enregistrées avec l'avis. Chez 1xBet elles sont 2 à 5 % plus basses, donc une cote combinée plutôt de 4,6 que de 5.

## Proposition

Un **Combiné IA 4–10**, montré sur Aujourd'hui après les chasseurs :

- les avis joués par l'IA pour les matchs du jour, cote 1xBet de 1,45 à 1,80, un par championnat ;
- classés par la marge 1xBet la plus basse, puis par la probabilité de l'IA ;
- ajoutés tant que la cote combinée ne dépasse pas 10, jusqu'à atteindre 4, et au plus 4 jambes ; sinon, pas de combiné ce jour-là ;
- composé de façon déterministe à partir des avis de l'IA, sans nouvel appel au modèle : c'est l'IA qui a choisi chaque jambe, en avis ;
- présenté comme les autres coupons : fréquence du marché sur chaque jambe, « gagne environ 1 jour sur 4 », pire série ;
- mesuré jambe par jambe, jamais au retour du coupon.

Il remplacerait le combiné IA à 2 jambes, qui ne sert plus qu'à la comparaison jambe à jambe avec le moteur. Cette comparaison est faite : l'IA est calibrée et ne bat pas la cote (`docs/audits/2026-10-29/BILAN-IA.md`).

**Décidé le 03/11** : l'utilisateur revient sur la décision du 29/10, et le Combiné IA est affiché.

## Ce que livre la PR

- **`AI_COMBO_COUPON_CLASS`** (`analysis-core`) : jambes de 1,45 à 1,80, au plus 4, cote combinée de 4 à 10. `composeAiCombo` applique la règle ci-dessus : un avis par championnat et par match, la marge 1xBet la plus basse d'abord, puis la fréquence du marché.
- **Composition** : à la passe du soir (17:00 UTC la veille), avec les chasseurs (`CouponHunterGenerationService`). Elle reprend le dernier avis de l'IA par match du jour quand il joue (`CouponRepository.findAiPlays`), hors matchs signalés par AVOID, au prix 1xBet. Un avis sans fréquence du marché chez 1xBet (groupe incomplet) n'entre pas. Source `PRICE_COMPOSER`, bande 4. L'abstention est enregistrée (`ai-combo`).
- **Chance affichée** : la fréquence du marché chez 1xBet, comme pour les chasseurs, jamais la probabilité de l'IA.
- **Écrans** : « Combiné IA » sur Aujourd'hui, après les chasseurs ; dans Résultats (depuis le 04/11) ; dans le résumé du matin.
- **L'ancien combiné IA à 2 jambes est coupé** (décision du 03/11 : « plus besoin de lui »). La passe `generate-coupons` du vantage-worker est retirée, ainsi que tout son code (`src/coupon/`), la passe « Combiné IA » de 17:45 dans la console et `COUPON_SCHEDULE.LLM_COUPON_CRON`. Son planificateur encore présent dans Redis est supprimé au démarrage. Ses anciens coupons restent visibles des admins dans Résultats. Économie : un appel au modèle par soir.
