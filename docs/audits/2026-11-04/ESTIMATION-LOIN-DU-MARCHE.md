# Estimation loin du marché : Rennes – Olympiakos et les coupes européennes

Audit du 2026-11-04, en lecture seule, sans aucune modification de code. Base locale (copie de prod) : derniers matchs `FINISHED` le **2026-11-03 00:15**. `evaluatedPicks` est enregistré depuis le 2026-07-01. Toutes les mesures passent par la vue `evaluated_pick`, qui garde la dernière analyse avant le coup d'envoi, donc **un pari par match**. Le prix de référence est la dernière cote Pinnacle 1X2 relevée dans les 72 h avant le match, marge retirée par normalisation proportionnelle. Verdict : **candidate_for_shadow** pour le correctif, et cause **établie**.

## 1. D'où vient le motif affiché

- `ev_above_hard_cap` : `EV > EV_HARD_CAP = 0.90` (`packages/analysis-core/src/selection/constants.ts`). C'est le premier test de `getPickRejectionReason` (`selection/pick-validation.ts`), il s'applique à tous les canaux et à tous les marchés.
- `ev_above_soft_cap` : `EV > getPickEvSoftCap(compétition, marché, pick)`, qui lit `PICK_EV_SOFT_CAP_MAP` dans `apps/backend/src/modules/betting-engine/ev.constants.ts`, avec `EV_HARD_CAP` comme valeur par défaut. Ce match tombe sur **`UEL|ONE_X_TWO|AWAY` = 0.35** (audit du 07/04 : n = 7, ROI −56 %).
- `MAX_LEG_EDGE = 0.10` est un autre plafond, appliqué à la composition des coupons. Il n'intervient pas ici.
- La page affiche `fr.json` → « notre estimation et la cote sont trop éloignées : par prudence, on suit le marché ». Le texte est juste.

Ce match, d'après le model_run (`betting-engine-2026-09-14.1`) : P(Olympiakos) = **0.454** au moteur, contre **0.311** chez Pinnacle (2.26 / 3.58 / 3.07). À la cote 3.07 cela donne EV = 0.393, au-dessus du plafond de 0.35, d'où le rejet. Le moteur ajoute environ 14 points de probabilité à l'extérieur et en retire 21 au nul (0.224 contre 0.267).

## 2. Mécanique reproduite exactement

`deriveLambdas` (`probability/match-stats.ts`) calcule λ_home = 0.7·(xgFor_H·xgAgainst_A / moyenne des 4) + 0.3·meanLambda(UEL = 1.4), multiplié par 1.10, et λ_away de la même façon, multiplié par 0.85. En Europe, `resolveEffectiveTeamStats` mélange la ligne de la coupe (poids xG 0.4) avec la dernière ligne hors coupe (0.6), c'est-à-dire le **championnat national** :

| Équipe | Ligne UEL (3 matchs) | Ligne nationale | Mélange xgFor / xgAgainst |
| --- | --- | --- | --- |
| Rennes | 1.82 / 1.32 | **L1** 2.04 / **2.33** | 1.954 / 1.927 |
| Olympiakos | 1.80 / 0.73 | **GRE1** 1.49 / **0.70** | 1.616 / 0.710 |

Moyenne des quatre = 1.552, ce qui donne λ = **1.150 / 1.551**, identique au model_run. L'écart vient de la confrontation entre la défense de Rennes mesurée en L1 (2.33 contre) et celle d'Olympiakos mesurée en GRE1 (0.70 contre). **Aucun terme ne tient compte du niveau du championnat** : 0.70 encaissé face aux attaques grecques compte comme 0.70 face à celles de la L1. Le mélange 1X2 (`UEL` = 0.20) s'appuie lui aussi sur les taux de victoire nationaux (Rennes 1.0 à domicile, Olympiakos 0.8 à l'extérieur, nul 0.111), qui sont tout aussi aveugles au niveau. L'Elo (`elo-sync`, `fri-model`) ne sert qu'aux sélections nationales.

Hypothèses écartées : la **forme récente** n'entre pas dans λ, seulement dans le `deterministicScore`. Le **H2H** est nul ici (`shadow_h2h` = null). Le **facteur domicile/extérieur** (1.10/0.85, global depuis le 06/10, l'ancienne carte UEL 1.04/0.96 a été retirée) est secondaire : voir §3, entre équipes de même niveau. Le **petit échantillon** de la coupe (3 matchs) existe, mais il ne pèse que 40 % et va dans le même sens que la ligne nationale.

## 3. Mesures (réglées, un match = un pari)

**Paris écartés par plafond, tous marchés** : réalisé ÷ annoncé ≈ **0.33** (ONE_X_TWO 0.346, n = 625 ; DNB 0.323 ; RESULT_TOTAL_GOALS 0.326). Le réalisé est toujours **au niveau de 1/cote, voire en dessous** (ONE_X_TWO : annoncé 0.393, 1/cote 0.155, réalisé 0.136). Plafond souple, n = 59 : annoncé 0.584, 1/cote 0.382, réalisé 0.305. Le marché a raison et le moteur se trompe, sur tous les marchés.

**ONE_X_TWO face à Pinnacle**

| Groupe | Classe | Pick | n | Moteur | Pinnacle | Réalisé | Réalisé − Pinnacle |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Europe | plafonné | AWAY | 157 | 0.433 | 0.160 | 0.153 | −0.007 ± 0.028 |
| Europe | plafonné | HOME | 52 | 0.479 | 0.168 | 0.173 | +0.005 ± 0.051 |
| National | plafonné | AWAY | 216 | 0.373 | 0.147 | 0.106 | −0.041 ± 0.024 |
| National | plafonné | HOME | 175 | 0.451 | 0.210 | 0.183 | −0.027 ± 0.030 |
| Europe | autres | HOME | 470 | 0.417 | 0.507 | 0.515 | +0.008 |

Les coupes européennes représentent environ 7 % des picks 1X2, mais **36 % des plafonnés** (239 sur 671). Sur le pick HOME, l'écart absolu moyen avec Pinnacle est de **0.192 en Europe contre 0.091 en championnat**, et l'écart de Brier binaire avec Pinnacle de **+0.057 contre +0.017**, soit 3,4 fois plus. Le résidu par rapport au marché reste nul partout : l'écart ne contient **aucune information**.

**Matchs européens selon le championnat national de chaque équipe** (207 matchs résolus, **100 % inter-championnats**, 88 plafonnés) :

| Domicile / extérieur | n | Plafonnés | P(dom) moteur / Pinnacle / réalisé | P(ext) moteur / Pinnacle / réalisé |
| --- | --- | --- | --- | --- |
| Big-5 / autre | 30 | **23** | 0.411 / 0.658 / 0.733 | 0.376 / 0.159 / 0.267 |
| Autre / Big-5 | 32 | 16 | 0.461 / 0.259 / 0.281 | 0.320 / 0.520 / 0.438 |
| Autre / autre | 121 | 45 | 0.416 / 0.489 / 0.488 | 0.353 / 0.294 / 0.264 |
| Big-5 / Big-5 | 24 | 4 | 0.434 / 0.467 / 0.625 | 0.336 / 0.299 / 0.250 |

Le moteur annonce entre 0.41 et 0.46 à domicile quel que soit le niveau des deux équipes. Le marché, lui, distingue nettement les cas. Rennes – Olympiakos est dans la case « Big-5 / autre ». 107 autres matchs européens n'ont pas de championnat national connu pour au moins une équipe, ce qui veut dire que leur ligne croisée est une autre coupe ou n'existe pas.

## 4. Conclusion et correctif

**Cause principale, établie** : les λ inter-championnats comparent des xG mesurés dans des championnats de niveaux différents, sans aucun facteur de force. Un leader d'un championnat faible paraît plus fort qu'un club moyen d'un championnat fort. **Cause secondaire** : un avantage du domicile sous-estimé en coupe, d'environ 3 à 7 points sur « autre / autre » (n faible). Le plafond fait exactement ce qu'il doit faire : il détecte des surestimations.

**Correctif proposé, au niveau des λ (`analysis-core`, pas des plafonds)** : un coefficient de force par championnat national `s_L`, estimé **point-in-time** sur les matchs inter-championnats déjà réglés (résultats des coupes, ou bien l'écart moteur − Pinnacle sur ces matchs, ce qui donne une estimation informée par le marché). On l'applique à la ligne croisée : `xgFor × s_L` et `xgAgainst ÷ s_L`, avec un rétrécissement vers 1 pour les championnats peu représentés. Alternative plus simple, à rejouer en concurrence : rapprocher le 1X2 européen du prix Pinnacle, puisque le poids optimal du moteur dans un mélange est déjà de 0 %. La carte des soft caps (`UEL|…`, fixée sur n = 7) deviendrait inutile une fois la cause corrigée.

**Validation** : rejeu via `PointInTimeLoader` / `runValidationProtocol` sur les matchs UCL, UEL et UECL de toutes les saisons qui ont des cotes. `s_L` doit être ajusté uniquement sur les saisons antérieures, puis validé chronologiquement, avec un bootstrap par match. Le critère est le **résidu contre Pinnacle** (Brier moteur − Brier Pinnacle, poids optimal dans le mélange, réalisé ÷ annoncé par tranche de cote), **jamais** le ROI de coupon. On vérifie aussi que le taux `ev_above_*` européen redescend vers le niveau national, environ 3,6 %.

**À ne pas faire** : desserrer `EV_HARD_CAP` ou `UEL|ONE_X_TWO|AWAY` pour laisser passer ces paris (réalisé ÷ annoncé 0.33, réalisé égal au marché). Exclure les coupes (on règle, on ne désactive pas). Conclure sur ce seul match.

## Requêtes (relançables)

```sql
-- Plafonnés, tous marchés
SELECT rejection_reason, market, count(*), avg(model_prob), avg(1/odds), avg(won::int)
FROM evaluated_pick WHERE rejection_reason LIKE 'ev_above%' AND won IS NOT NULL GROUP BY 1,2;
-- 1X2 contre Pinnacle : prix Pinnacle juste =
-- DISTINCT ON ("fixtureId") 1/odds normalisé, depuis odds_closing_line
-- WHERE bookmaker='Pinnacle' AND market='ONE_X_TWO' AND "hoursBeforeKickoff" BETWEEN 0 AND 72,
-- ORDER BY "hoursBeforeKickoff", jointure sur evaluated_pick (market='ONE_X_TWO'),
-- groupes competition IN ('UCL','UEL','UECL'), classe rejection_reason LIKE 'ev_above%', pick.
-- Championnat national = competition.code de la dernière ligne team_stats de l'équipe
-- avant le match, hors UCL/UEL/UECL/FRI.
```
