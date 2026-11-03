# Combiné du jour : départager par la marge 1xBet

_03/11/2026, phase 5 étape 2 du plan du 03/11 (`docs/plan-strategies-2026-11-03.md`). Copie de prod du 03/11. Script : `packages/backtest-core/scripts/backtest-engine-combo-margin.ts` (`pnpm --filter @evcore/backtest-core backtest:engine-combo-margin`), sortie : `outputs/backtest-engine-combo-margin.txt`._

> **Rejoué le 03/11 au soir avec la règle de la revue** : « chance égale » se lit sur la probabilité du moteur **et** sur la fréquence sans marge du marché chez 1xBet (Shin). Les chiffres ci-dessous sont ceux de cette règle, celle qui est expédiée. Le premier rejeu (moteur seul) donnait 8,93 % → 8,52 % sur 20 jambes changées : la règle durcie échange moins, et gagne moins.

## Réponse courte

1. **Expédié, petit.** Dans chaque championnat retenu, parmi les jambes éligibles à 2 points de la moins chère sur la probabilité du moteur et sur la fréquence du marché, le Combiné prend la marge 1xBet la plus basse (`COMBO_CONFIG.marginTieBreak`, politique `engine-combo-v2`).
2. **Marge payée par jambe : 8,93 % → 8,87 %** sur 49 jours (8,24 → 8,21 et 9,38 → 9,30 par moitié). **11 jambes changent, sur 11 jours.**
3. **Réalisé ÷ annoncé par jambe : 1,020 [0,935 ; 1,105] → 1,044** sur 95 / 94 jambes, dans l'intervalle de l'ancien.
4. **Lecture appariée des seules jambes échangées** : les 11 retirées réalisaient 72,7 % pour 83,4 % annoncés (0,87), les 10 prises à la place 90,0 % pour 83,2 % (1,08), marge 8,61 % → 8,08 %. Sens favorable, intervalles larges (± 0,3) : du bruit, mais pas de signe que la règle prenne de moins bonnes jambes.
5. **Ce n'est pas un avantage** : un gain de coût de 0,06 point par jambe en moyenne (0,5 point sur une jambe échangée). Si les relectures en direct montrent que la marge payée ne baisse pas, retirer l'option (pas de flag dormant).

## Hypothèse, fixée avant le rejeu

Prendre, dans un championnat, la marge 1xBet connue la plus basse parmi les jambes dont la probabilité est à 2 points de celle de la jambe la moins chère fait baisser la marge payée par jambe, sans que le réalisé/annoncé par jambe sorte de l'intervalle à 95 % de la règle actuelle. Règle d'expédition : les deux conditions sur toute la période. Aucun paramètre n'est ajusté (la fenêtre de 2 points vient du plan), donc pas de moitié d'ajustement ; les deux moitiés sont rapportées pour montrer que le sens ne dépend pas de la période.

Ce qui ne change pas, par construction :

- **la sélection mise en avant de chaque match** (palier, probabilité, cote : celle de l'écran Décisions) — le départage ne choisit qu'entre matchs d'un même championnat ;
- **les championnats retenus** : pris dans l'ordre de leur jambe la moins chère, comme avant ;
- une marge inconnue ne gagne jamais contre une marge connue ; sans marge connue, la moins chère.

## Ce qui est rejoué

Chaque jour du 14/09 (premier prix 1xBet en base : 13/09) au 02/11, à l'heure de composition (17 h UTC la veille) :

- le vivier du service : sélections retenues de la **dernière analyse connue à cet instant** (pas celle d'avant coup d'envoi), canaux affichés sur Décisions, marchés du vivier, matchs sans alerte de calibration ;
- la calibration canal × compétition sur les 90 jours précédents, matchs finis avant l'heure de composition ;
- le prix 1xBet connu à cet instant (dernier relevé observé avant 17 h), marge sur le groupe d'issues complet de ce relevé, garde « jouable chez l'opérateur » ;
- `composeEngineCombo` avec et sans départage (deux jambes, classe `COMBO_COUPON_CLASS` actuelle).

Le vivier est fait des sélections que le moteur a écrites à l'époque : ce qui change est le compositeur, son entrée est celle qu'il aurait vue. Jambes réglées par le résultat enregistré de la sélection.

## Résultats, par jambe (règle expédiée)

| Période       | Règle           | Jours composés (gagnés) | Jambes | Annoncé | Réalisé | Réalisé ÷ annoncé (IC 95 %) | Marge 1xBet (connue) | Cote 1xBet |
| ------------- | --------------- | ----------------------: | -----: | ------: | ------: | --------------------------: | -------------------: | ---------: |
| 14/09 → 07/10 | la moins chère  |                 23 (15) |     45 |   0,807 |   0,822 |       1,019 [0,880 ; 1,157] |       8,24 % (32/45) |      1,222 |
|               | départage marge |                 23 (15) |     45 |   0,807 |   0,822 |       1,018 [0,880 ; 1,157] |       8,21 % (32/45) |      1,221 |
| 08/10 → 01/11 | la moins chère  |                 25 (20) |     50 |   0,862 |   0,880 |       1,021 [0,916 ; 1,125] |       9,38 % (50/50) |      1,165 |
|               | départage marge |                 25 (21) |     49 |   0,862 |   0,918 |       1,066 [0,977 ; 1,154] |       9,30 % (49/49) |      1,163 |
| **Total**     | la moins chère  |                 48 (35) |     95 |   0,836 |   0,853 |       1,020 [0,935 ; 1,105] |       8,93 % (82/95) |      1,187 |
|               | départage marge |                 48 (36) |     94 |   0,836 |   0,872 |   **1,044** [0,963 ; 1,124] |   **8,87 %** (81/94) |      1,186 |

Jambes échangées seules (appariées) :

|                   | Jambes | Annoncé | Réalisé | Réalisé ÷ annoncé (IC 95 %) | Marge 1xBet | Fréquence 1xBet | Cote 1xBet |
| ----------------- | -----: | ------: | ------: | --------------------------- | ----------: | --------------: | ---------: |
| Retirées          |     11 |   0,834 |   0,727 | 0,872 [0,556 ; 1,188]       |      8,61 % |           0,787 |      1,201 |
| Prises à la place |     10 |   0,832 |   0,900 | 1,082 [0,859 ; 1,306]       |      8,08 % |           0,799 |      1,191 |

Lecture :

- **La marge baisse dans les deux moitiés**, de 0,03 et 0,08 point par jambe ; sur les jambes échangées, de 0,5 point chacune.
- **Le ratio ne bouge pas hors du bruit** (± 0,08 à 0,14). Les jambes prises à la place ont une fréquence de marché égale ou plus haute (0,799 contre 0,787) : la règle durcie ne prend pas de jambe plus longue.
- Les jours gagnés (35 → 36) ne disent rien : la réussite d'un coupon n'a pas de puissance à ce volume ; seule la lecture par jambe compte.
- 13 jambes sur 95 n'ont pas de marge connue, toutes dans la première quinzaine (relevés 1xBet incomplets au démarrage).
- Premier rejeu, règle d'avant la revue (moteur seul) : 8,93 % → 8,52 %, ratio 1,028, 20 jambes changées sur 16 jours.

## Ce qui a changé dans le code

- `ComboCandidate.margin` (marge 1xBet du choix, nulle si le groupe est incomplet) et `ComboConfig.marginTieBreak: { window }` dans `packages/analysis-core/src/coupon/combo-generator.ts` ; `COMBO_CONFIG` l'active à 0,02.
- `CouponEngineComboGenerationService` passe la marge du relevé déjà lu (`operatorPrice`) à chaque candidat : aucune requête en plus.
- `ENGINE_COMBO_POLICY.version` passe à `engine-combo-v2` pour comparer les jambes avant / après.
- Le coupon long (`composeEngineLong`) n'est pas touché.

## À relire

Le 10/12 avec les autres produits : marge payée et réalisé ÷ annoncé des jambes `engine-combo-v2` contre `engine-combo-v1`, par jambe.
