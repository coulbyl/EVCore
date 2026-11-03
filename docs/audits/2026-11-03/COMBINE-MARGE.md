# Combiné du jour : départager par la marge 1xBet

_03/11/2026, phase 5 étape 2 du plan du 03/11 (`docs/plan-strategies-2026-11-03.md`). Copie de prod du 03/11. Script : `packages/backtest-core/scripts/backtest-engine-combo-margin.ts` (`pnpm --filter @evcore/backtest-core backtest:engine-combo-margin`), sortie : `outputs/backtest-engine-combo-margin.txt`._

> **À rejouer avant fusion.** La revue de code (`/code-review high`) a durci la règle après ce rejeu : « chance égale » se lit maintenant aussi sur la fréquence sans marge du marché (Shin, relevé 1xBet), pas seulement sur la probabilité du moteur — le moteur seul laissait passer une jambe plus longue où il s'écarte du prix, et l'écart annoncé est anti-prédictif. Les chiffres ci-dessous sont ceux de la règle d'avant (fenêtre sur le moteur seul). Le second rejeu, avec la lecture appariée des seules jambes échangées (retirées contre prises à la place), a été coupé par l'arrêt de la base locale le 03/11 vers 15 h 45. À relancer : `DATABASE_URL=postgresql://claude_check:claude_check@localhost:5433/evcore pnpm --filter @evcore/backtest-core backtest:engine-combo-margin`. La nouvelle règle ne peut échanger que des jambes à chance égale des deux côtés, donc un sous-ensemble des cas d'avant ; si la marge ne baisse plus ou si les jambes prises réalisent nettement moins que les jambes retirées, remettre la règle de la moins chère.

## Réponse courte

1. **Expédié.** Dans chaque championnat retenu, parmi les jambes éligibles dont la probabilité est à 2 points de celle de la moins chère, le Combiné prend maintenant la marge 1xBet la plus basse (`COMBO_CONFIG.marginTieBreak`, politique `engine-combo-v2`).
2. **Marge payée par jambe : 8,93 % → 8,52 %** sur 49 jours, et elle baisse dans les deux moitiés (8,24 → 8,00 et 9,38 → 8,87).
3. **Réalisé ÷ annoncé par jambe : 1,020 [0,935 ; 1,105] → 1,028** sur 95 / 94 jambes. Le nouveau ratio est dans l'intervalle de l'ancien : rien ne bouge hors du bruit.
4. **L'effet est petit** : 20 jambes changent sur 16 jours (sur 48 jours composés). C'est un gain de coût de 0,4 point par jambe, pas un avantage ; il ne change ni les championnats retenus ni la sélection mise en avant de chaque match.

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

## Résultats, par jambe

| Période       | Règle           | Jours composés (gagnés) | Jambes | Annoncé | Réalisé | Réalisé ÷ annoncé (IC 95 %) | Marge 1xBet (connue) | Cote 1xBet |
| ------------- | --------------- | ----------------------: | -----: | ------: | ------: | --------------------------: | -------------------: | ---------: |
| 14/09 → 07/10 | la moins chère  |                 23 (15) |     45 |   0,807 |   0,822 |       1,019 [0,880 ; 1,157] |       8,24 % (32/45) |      1,222 |
|               | départage marge |                 23 (14) |     45 |   0,811 |   0,800 |       0,987 [0,843 ; 1,131] |       8,00 % (33/45) |      1,230 |
| 08/10 → 01/11 | la moins chère  |                 25 (20) |     50 |   0,862 |   0,880 |       1,021 [0,916 ; 1,125] |       9,38 % (50/50) |      1,165 |
|               | départage marge |                 25 (21) |     49 |   0,863 |   0,918 |       1,064 [0,975 ; 1,153] |       8,87 % (49/49) |      1,186 |
| **Total**     | la moins chère  |                 48 (35) |     95 |   0,836 |   0,853 |       1,020 [0,935 ; 1,105] |       8,93 % (82/95) |      1,187 |
|               | départage marge |                 48 (35) |     94 |   0,838 |   0,862 |   **1,028** [0,945 ; 1,112] |   **8,52 %** (82/94) |      1,203 |

Lecture :

- **La marge baisse partout**, de 0,24 à 0,51 point par jambe selon la moitié. Sur les seules 20 jambes changées, l'écart est d'environ 1,7 point chacune.
- **Le ratio ne bouge pas** : −0,03 sur la première moitié, +0,04 sur la seconde, chaque fois dans l'intervalle (± 0,09 à 0,14 sur 45 à 50 jambes). La jambe prise à la place est, par construction, à 2 points de probabilité près : il n'y a pas de raison qu'elle gagne moins souvent, et elle ne le fait pas.
- **La cote 1xBet monte un peu** (1,187 → 1,203) : à chance égale, une marge plus basse paie plus.
- Les jours gagnés (35 / 35) ne disent rien : le ROI ou la réussite d'un coupon n'ont pas de puissance à ce volume ; seule la lecture par jambe compte.
- 13 jambes sur 95 n'ont pas de marge connue, toutes dans la première quinzaine (relevés 1xBet incomplets au démarrage).

## Ce qui a changé dans le code

- `ComboCandidate.margin` (marge 1xBet du choix, nulle si le groupe est incomplet) et `ComboConfig.marginTieBreak: { window }` dans `packages/analysis-core/src/coupon/combo-generator.ts` ; `COMBO_CONFIG` l'active à 0,02.
- `CouponEngineComboGenerationService` passe la marge du relevé déjà lu (`operatorPrice`) à chaque candidat : aucune requête en plus.
- `ENGINE_COMBO_POLICY.version` passe à `engine-combo-v2` pour comparer les jambes avant / après.
- Le coupon long (`composeEngineLong`) n'est pas touché.

## À relire

Le 10/12 avec les autres produits : marge payée et réalisé ÷ annoncé des jambes `engine-combo-v2` contre `engine-combo-v1`, par jambe.
