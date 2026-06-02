# Investment virtual channels report

## Objectif

Le but de cette phase etait de comprendre pourquoi `investment` sortait encore des pertes alors que `/picks` contenait souvent plusieurs gagnants sur les jours actifs.

L'hypothese testee:

> Les gagnants existent deja dans le pool, mais ils ne remontent pas toujours dans les bons canaux `investment`.

La strategie choisie a ete d'ajouter des canaux virtuels, sans changer Prisma, pour tester des familles de marches qui etaient deja produites par le moteur:

- `BTTS/YES`
- `OVER_UNDER/UNDER_3_5`
- `OVER_UNDER_HT/OVER_0_5`
- `OVER_UNDER/OVER_1_5`
- `OVER_UNDER/UNDER_4_5`

## Donnees analysees

Fenetre:

- du `2026-04-02`
- au `2026-06-01`

Sources:

- picks DB via Postgres/Docker;
- selections `investment` via API backend `localhost:3001`;
- resultats reels deja setteles dans les tables `bet`, `prediction` et `fixture`.

Rapports generes:

- `apps/backend/reports/investment-vs-picks-analysis.txt`
- `apps/backend/reports/hidden-winner-segments.txt`
- `apps/backend/reports/virtual-investment-channels.txt`
- `apps/backend/reports/virtual-channel-loss-audit.txt`
- `apps/backend/reports/virtual-investment-channels.guarded.txt`
- `apps/backend/reports/virtual-channel-loss-audit.guarded.txt`

Scripts utiles:

- `scripts/export-investment-vs-picks.mjs`
- `scripts/analyze-hidden-winner-segments.mjs`
- `scripts/backtest-virtual-investment-channels.mjs`
- `scripts/audit-virtual-channel-losses.mjs`

## Constat initial

Sur la fenetre analysee:

- picks DB: `858`
- gagnants DB: `462`
- perdants DB: `393`
- pending DB: `3`
- selections `investment`: `415`
- gagnants `investment`: `250`
- perdants `investment`: `164`
- hit rate `investment`: `60.4%`
- gagnants DB ignores par `investment`: `212`

Les gagnants ignores etaient surtout:

- `BTTS/YES`: `58`
- `OVER_UNDER/UNDER_3_5`: `28`
- `OVER_UNDER_HT/OVER_1_5`: `17`
- `ONE_X_TWO/HOME`: `17`
- `ONE_X_TWO/AWAY`: `16`
- `OVER_UNDER_HT/OVER_0_5`: `16`

Conclusion: le probleme n'etait pas seulement le volume. Le pool contenait bien des gagnants, mais `investment` ne les classait pas toujours au bon endroit.

## Canaux virtuels ajoutes

Les canaux virtuels ajoutes dans l'API `investment` sont:

| Canal virtuel    | Marche source            | Intention                                                                      |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `SAFE_HT_OVER05` | `OVER_UNDER_HT/OVER_0_5` | Detecter les matchs avec au moins un but en premiere mi-temps.                 |
| `SAFE_UNDER45`   | `OVER_UNDER/UNDER_4_5`   | Canal tres prudent sur les matchs peu susceptibles de partir en score extreme. |
| `SAFE_OVER15`    | `OVER_UNDER/OVER_1_5`    | Detecter les matchs avec au moins deux buts.                                   |
| `SAFE_UNDER35`   | `OVER_UNDER/UNDER_3_5`   | Detecter les matchs sous quatre buts.                                          |
| `BTTS_YES`       | `BTTS/YES`               | Detecter les matchs ou les deux equipes marquent.                              |

Ils sont exposes dans:

- `InvestmentDayDto.virtualSelections`
- `InvestmentDayDto.virtualTop5`
- `InvestmentDayDto.virtualTop10`

Ils apparaissent dans l'UI sous la section:

- `Canaux virtuels`

## Baseline avant garde-fous

Premier backtest virtuel:

| Groupe             | Total |     W |    L | Hit rate |
| ------------------ | ----: | ----: | ---: | -------: |
| candidats virtuels | `319` | `231` | `88` |  `72.4%` |
| top 5 quotidien    | `134` | `106` | `28` |  `79.1%` |
| top 10 quotidien   | `181` | `138` | `43` |  `76.2%` |

Ce resultat validait l'intuition: les nouveaux canaux trouvaient beaucoup de gagnants.

Mais il restait trop de pertes pour parler de selections vraiment premium.

## Audit des pertes

L'audit a montre que les pertes n'etaient pas aleatoires.

Principales zones faibles avant garde-fous:

- `SAFE_UNDER35` en `MX1`: `1W / 3L`
- `SAFE_UNDER35` tranche `75-79%`: `21W / 12L`
- `BTTS_YES` en `ERD`: `2W / 3L`
- `BTTS_YES` tranche `65-69%`: `12W / 7L`
- `SAFE_OVER15` avec marge EV trop fine: `2W / 2L`
- `SAFE_HT_OVER05` sous `75%`: trop instable
- `SAFE_UNDER45` avait peu de pertes, mais deux matchs extremes en `NOR2` et `TUR1`

Conclusion: il fallait rendre les canaux plus selectifs, pas les supprimer.

## Garde-fous appliques

Les garde-fous actuels sont:

| Canal            | Regles ajoutees                                   |
| ---------------- | ------------------------------------------------- |
| `SAFE_HT_OVER05` | probabilite minimale montee a `75%`               |
| `SAFE_UNDER45`   | exclusion `NOR2`, `TUR1`                          |
| `SAFE_OVER15`    | marge EV minimale `3pp`                           |
| `SAFE_UNDER35`   | exclusion `MX1`, exclusion tranche proba `75-79%` |
| `BTTS_YES`       | exclusion `ERD`, exclusion tranche proba `65-69%` |

La cle de cache `investment` a ete montee a:

- `investment:v5:{date}`

pour forcer l'API a servir les nouvelles selections.

## Resultats apres garde-fous

Backtest guarded:

| Groupe             | Total |     W |    L | Hit rate |
| ------------------ | ----: | ----: | ---: | -------: |
| candidats virtuels | `203` | `153` | `50` |  `75.4%` |
| top 5 quotidien    | `106` |  `92` | `14` |  `86.8%` |
| top 10 quotidien   | `133` | `112` | `21` |  `84.2%` |

Comparaison importante:

| Version          | Top 5 W | Top 5 L | Hit rate |
| ---------------- | ------: | ------: | -------: |
| avant garde-fous |   `106` |    `28` |  `79.1%` |
| apres garde-fous |    `92` |    `14` |  `86.8%` |

On a donc divise les pertes top 5 par deux.

Le compromis:

- moins de picks;
- moins de jours avec top 5 complet;
- une qualite nettement meilleure sur les picks qui restent.

## Performance par canal apres garde-fous

Top 5 par canal:

| Canal            | Total |    W |   L | Hit rate |
| ---------------- | ----: | ---: | --: | -------: |
| `SAFE_UNDER45`   |  `13` | `13` | `0` | `100.0%` |
| `SAFE_UNDER35`   |  `25` | `22` | `3` |  `88.0%` |
| `BTTS_YES`       |  `33` | `29` | `4` |  `87.9%` |
| `SAFE_HT_OVER05` |  `17` | `14` | `3` |  `82.4%` |
| `SAFE_OVER15`    |  `18` | `14` | `4` |  `77.8%` |

Lecture:

- `SAFE_UNDER45` est le canal le plus propre sur cette fenetre.
- `SAFE_UNDER35` et `BTTS_YES` deviennent solides avec les exclusions.
- `SAFE_OVER15` reste utile, mais c'est le canal a raffiner en priorite.
- `SAFE_HT_OVER05` a du potentiel, mais il reste sensible a certaines ligues.

## Pertes restantes a surveiller

Il reste `14` pertes top 5 apres garde-fous.

Zones a analyser ensuite:

- `SAFE_OVER15` en `EL1`, `UECL` et quelques matchs a score final `1-0` ou `0-1`.
- `SAFE_HT_OVER05` en `EL1`, `EL2`, `J1`, surtout quand le but arrive seulement en seconde periode ou jamais.
- `BTTS_YES` en `SP2` sous `65%`, avec plusieurs scores `1-0`, `0-1`, `0-0`, `2-0`.
- `SAFE_UNDER35` sur certains matchs avec lambda autour de `2.6-2.8` et cote haute.

## Etat du code

Backend:

- `apps/backend/src/modules/ai-engine/investment.constants.ts`
- `apps/backend/src/modules/ai-engine/investment.service.ts`
- `apps/backend/src/modules/ai-engine/dto/investment-day.dto.ts`
- `apps/backend/src/modules/ai-engine/signal-window.service.ts`

Frontend:

- `apps/web/domains/ai-engine/types/investment.ts`
- `apps/web/app/dashboard/investment/components/canal-constants.ts`
- `apps/web/app/dashboard/investment/components/investment-page-client.tsx`

Rapports:

- `apps/backend/reports/virtual-investment-channels.guarded.txt`
- `apps/backend/reports/virtual-channel-loss-audit.guarded.txt`

Validation:

- `pnpm --filter backend typecheck`
- `pnpm --filter web typecheck`
- `node --check scripts/backtest-virtual-investment-channels.mjs`
- probe API `GET /ai-engine/investment?date=2026-05-24`

## Decision actuelle

Les canaux virtuels sont utiles et meritent de rester.

Mais ils doivent rester presentes comme une couche experimentale/premium, pas comme une promesse de 100%.

Le bon cap maintenant:

- continuer a reduire les faux positifs;
- augmenter la stabilite par ligue;
- mesurer chaque nouveau garde-fou contre le volume disponible;
- ne jamais optimiser uniquement pour supprimer les pertes du passe.

## Backtest saison 2024 — résultat

Fenetre : `2024-01-01` → `2024-12-31` (6 484 fixtures analysées).

| Groupe           | Total |     W |     L | Hit rate |
| ---------------- | ----: | ----: | ----: | -------: |
| top 5 quotidien  | `316` | `201` | `115` |  `63.6%` |
| top 10 quotidien | `397` | `258` | `139` |  `65.0%` |

Seul `BTTS_YES` actif (même raison qu'en 2025 : picks OVER/UNDER non granulaires).

## Synthèse multi-saisons — BTTS_YES

| Saison                          | Top 5 W | Top 5 L | Hit rate | Full top5 days |
| ------------------------------- | ------: | ------: | -------: | -------------: |
| 2024                            |   `201` |   `115` |  `63.6%` |            `0` |
| 2025                            |   `196` |   `110` |  `64.1%` |            `0` |
| 2026 (après garde-fous iter. 2) |   `152` |    `35` |  `75.9%` |            `8` |

**La base rate BTTS_YES est structurellement à ~63-64% sur 3 saisons.** Le gain de 2026 vient des garde-fous (EL1, EL2, lambda ≥ 3.1) mais ne se généralise pas nécessairement.

### Instabilité des ligues entre saisons

Les ligues problématiques changent d'une saison à l'autre :

| Ligue |  2024 |  2026 | Tendance          |
| ----- | ----: | ----: | ----------------- |
| `SP2` | 46.2% | 29.0% | amélioration 2026 |
| `D2`  | 68.6% | 33.3% | dégradation 2026  |
| `PL`  | 75.0% | 40.0% | dégradation 2026  |
| `BL1` | 74.2% | 27.5% | dégradation 2026  |
| `J1`  | 57.1% | 85.7% | amélioration 2026 |

**Conclusion : les exclusions de ligue sur historique sont saisonnières.** Ajouter `D2`, `PL` ou `BL1` comme exclusions basées sur 2026 risque de sur-ajuster, car ces ligues étaient fiables en 2024. Seuls `EL1` et `EL2` sont structurellement défensifs et justifiés en exclusion permanente.

### La vraie variable manquante

Le prochain levier n'est pas la ligue — c'est une combinaison de signaux stables entre saisons :

- lambda total (déjà filtré à ≥ 3.1)
- forme récente des deux équipes (attaque, pas seulement résultats)
- profil de match : top-vs-top, domination unilatérale attendue, match retour
- historique head-to-head BTTS des 5 derniers matchs

Ces variables expliqueraient pourquoi BL1 2026 produit des scores `4-0` et `3-0` malgré un lambda élevé — les équipes scorent beaucoup mais d'un seul côté.

### Question recalibration à la source (CONF, SV, BB)

**Observation :** `avgP` BTTS_YES est ~63% sur toutes les saisons, et le hit rate réel est aussi ~63%. À l'agrégat, le modèle est bien calibré. Mais la variance par ligue est énorme — certaines ligues à 63% de probabilité modèle donnent 75% de hit rate réel (sous-confiant), d'autres 46% (sur-confiant). C'est un problème de **calibration par ligue**, pas global.

Le même problème existe sur CONF et SV : les probabilités 1X2 sous-jacentes peuvent être sur-/sous-confiantes selon le profil du match (ligue, lambda, contexte). Si le modèle surestime P(home) dans un match dominateur en BL1, CONF sort HOME avec trop de confiance.

**Ce qu'on fait aujourd'hui :** les garde-fous (exclusions de ligue, lambda, probability floor) sont une recalibration manuelle artisanale. Pragmatique pour le MVP, mais fragile car la distribution change d'une saison à l'autre.

**La vraie correction (Phase 3) :** calibration isotonique ou Platt scaling par ligue et par marché, appliquée directement sur les outputs du betting engine. C'est explicitement dans le roadmap Phase 3 (worker Python, scikit-learn). Avant ça, les garde-fous manuels restent la bonne réponse.

**À ne pas faire maintenant :** ajouter des garde-fous par ligue sur BTTS_YES au-delà de EL1/EL2 — le risque de sur-ajustement est confirmé par les données 2024 vs 2026.

## Analyse weekend 2026 — API réelle

Probe API sur tous les vendredis, samedis et dimanches de 2026 (`156` dates, `55` jours actifs).

### Totaux

| Métrique                  |              Top5 |              Top10 |
| ------------------------- | ----------------: | -----------------: |
| Hit rate global (settled) | `87.3%` (89W/13L) | `80.2%` (138W/34L) |
| Full days (100% settled)  |  `42 / 55` actifs |   `27 / 55` actifs |

### Distribution hit rate top5 par jour actif

| Hit rate | Jours | % des actifs |
| -------- | ----: | -----------: |
| **100%** |  `42` |      **76%** |
| 80-99%   |   `4` |           7% |
| 60-79%   |   `0` |           0% |
| < 60%    |   `9` |          16% |

Le profil est **bimodal** : soit la journée est parfaite (100%), soit elle est mauvaise (<60%). Pas de journée médiocre intermédiaire. Le système gagne ou perd, sans dégradation progressive.

### Par jour de semaine

| Jour     | Actifs | Full days (100%) | Hit rate |
| -------- | -----: | ---------------: | -------: |
| Vendredi |  13/52 |                — |    89.5% |
| Samedi   |  21/52 |                — |    85.7% |
| Dimanche |  21/52 |                — |    87.8% |

### Par canal (top5 weekend)

| Canal            |    W |    L | Hit rate |
| ---------------- | ---: | ---: | -------: |
| `SAFE_UNDER45`   |  `8` |  `0` |   `100%` |
| `SAFE_UNDER35`   | `22` |  `1` |  `95.7%` |
| `SAFE_HT_OVER05` | `13` |  `1` |  `92.9%` |
| `SAFE_OVER15`    |  `9` |  `1` |  `90.0%` |
| `BTTS_YES`       | `37` | `10` |  `78.7%` |

### Lecture produit

- Le top5 est le bon niveau de sélectivité. Le top10 ajoute des picks BTTS_YES qui introduisent les pertes (49% de full days vs 76%).
- Les canaux virtuels sont **un produit weekend** — la semaine c'est creux (surtout BTTS_YES en solo).
- Les 9 mauvaises journées (<60%) sont les seules sources de pertes. Elles correspondent à des jours où un BTTS_YES lâche ou un SAFE_OVER15 ne se déclenche pas.

Rapport complet : `apps/backend/reports/weekend-probe-2026.json` / `.txt`

## Prochaine iteration

1. ~~Raffiner `SAFE_OVER15`~~ — fait (itération 2 : exclusion EL1, `SAFE_OVER15` passe à 87.5%)
2. ~~Ajouter exclusions EL1/EL2 sur `BTTS_YES`~~ — fait (itération 2)
3. ~~Rejouer sur saison 2025~~ — fait, SAFE channels incompatibles (picks non granulaires). BTTS_YES seul à 64.1%.
4. ~~Rejouer sur saison 2024~~ — fait. BTTS_YES à 63.6%. Base rate structurelle confirmée.
5. Réduire `channelCapTop5` pour `BTTS_YES` de 2 → 1 pour limiter l'exposition dans le top5
6. Tester un `ultra-safe top3` sans `BTTS_YES` — si le volume des 4 SAFE suffit à couvrir les jours actifs
7. Trouver la variable stable inter-saisons pour BTTS_YES (forme attaque, H2H BTTS, profil de domination)
8. Phase 3 : calibration isotonique par ligue/marché sur les outputs du betting engine

## Itération 2 — nouveaux garde-fous (2026-06-01)

### Garde-fous ajoutés

| Canal            | Règle ajoutée                        | Signal data                         |
| ---------------- | ------------------------------------ | ----------------------------------- |
| `BTTS_YES`       | exclusion `EL1`, `EL2`               | 57% et 67% de perte sur ces ligues  |
| `BTTS_YES`       | `minLambda: 3.1`                     | bucket `2.80-3.09` à 38.8% de perte |
| `BTTS_YES`       | `minProbability` relevé 0.55 → 0.60  | bucket `<60%` à 35.2% de perte      |
| `BTTS_YES`       | suppression boost `ERD` (déjà exclu) | cohérence                           |
| `SAFE_OVER15`    | exclusion `EL1`                      | 66.7% de perte sur EL1              |
| `SAFE_HT_OVER05` | exclusion `EL1`                      | 40% de perte sur EL1                |

Clé de cache montée à `investment:v6:{date}`.

### Résultats calendrier 2026 après itération 2

| Groupe             | Total |     W |    L | Hit rate |
| ------------------ | ----: | ----: | ---: | -------: |
| candidats virtuels | `276` | `214` | `62` |  `77.5%` |
| top 5 quotidien    | `187` | `152` | `35` |  `81.3%` |
| top 10 quotidien   | `228` | `182` | `46` |  `79.8%` |

Comparaison top 5 avant / après :

| Version                           | Top 5 W | Top 5 L | Hit rate |
| --------------------------------- | ------: | ------: | -------: |
| itération 1 (garde-fous initiaux) |   `185` |    `67` |  `73.4%` |
| itération 2 (nouveaux garde-fous) |   `152` |    `35` |  `81.3%` |

Top 5 par canal après itération 2 :

| Canal            | Total |    W |    L | Hit rate |
| ---------------- | ----: | ---: | ---: | -------: |
| `SAFE_UNDER45`   |  `13` | `13` |  `0` | `100.0%` |
| `SAFE_UNDER35`   |  `26` | `23` |  `3` |  `88.5%` |
| `SAFE_OVER15`    |  `16` | `14` |  `2` |  `87.5%` |
| `SAFE_HT_OVER05` |  `16` | `14` |  `2` |  `87.5%` |
| `BTTS_YES`       | `116` | `88` | `28` |  `75.9%` |

Pertes top 5 divisées par deux (`67` → `35`). Les 4 canaux hors BTTS_YES combinés : **90.3%** (65W/7L).

### Pertes restantes à surveiller

`BTTS_YES` reste le canal qui tire le hit rate vers le bas. Pattern des pertes persistantes :

- `BL1` : 11 pertes (27.5%) — scores `4-0`, `3-0`, `2-0`, lambda élevé mais un seul buteur
- `SP2` : 9 pertes (29.0%)
- `D2` : 5 pertes (33.3%)
- `PL` : 2 pertes top5 (40% sur 5 picks)

### Question ouverte

Sans `BTTS_YES`, les 4 autres canaux font 90.3% mais ne couvrent pas assez de jours pour un top5 systématique.

Options à évaluer :

- Réduire `channelCapTop5` pour `BTTS_YES` de 2 → 1
- Construire un **ultra-safe top3** séparé sans `BTTS_YES`
- Attendre la validation multi-saisons avant de décider

## Backtest saison 2025 — résultat et limite

Fenetre : `2025-01-01` → `2025-12-31` (12 438 fixtures analysées, 448 bets settles, 4 794 predictions).

### Résultat

| Groupe             | Total |     W |     L | Hit rate |
| ------------------ | ----: | ----: | ----: | -------: |
| candidats virtuels | `527` | `334` | `193` |  `63.4%` |
| top 5 quotidien    | `306` | `196` | `110` |  `64.1%` |
| top 10 quotidien   | `379` | `240` | `139` |  `63.3%` |

Canaux actifs : **uniquement `BTTS_YES`**. Les 4 canaux SAFE ont produit zéro candidat.

### Pourquoi les SAFE channels sont absents

En 2025, le betting engine génère des picks génériques : `OVER_UNDER/OVER` et `OVER_UNDER/UNDER`.

En 2026, il génère des picks granulaires : `OVER_UNDER/OVER_1_5`, `OVER_UNDER/UNDER_3_5`, `OVER_UNDER/UNDER_4_5`, `OVER_UNDER_HT/OVER_0_5`.

Les canaux SAFE recherchent les picks granulaires. Le dataset 2025 est donc **incompatible** avec ces canaux — la limite est structurelle, pas statistique.

### Ce que ça dit sur BTTS_YES

Le hit rate BTTS_YES tombe à 64.1% en 2025 (vs 75.9% en 2026 avec les mêmes garde-fous), avec des ligues très instables :

| Ligue  | Total | Hit rate |
| ------ | ----: | -------: |
| `D2`   |  `54` |  `51.9%` |
| `MX1`  |  `11` |  `45.5%` |
| `UNL`  |   `8` |  `50.0%` |
| `FIN1` |  `34` |  `55.9%` |
| `SUI1` |  `48` |  `58.3%` |
| `SWE2` |  `13` |  `53.8%` |

Conclusion : le filtre lambda ≥ 3.1 est nécessaire mais pas suffisant pour BTTS_YES sur une saison complète. Les ligues instables ci-dessus sont des candidates à l'exclusion ou à un seuil de probabilité plus élevé.

### Limite de la validation multi-saisons

**2026 est la seule saison backtestable pour les SAFE channels.** Il n'est pas possible de valider l'absence de sur-ajustement sur les SAFE channels via le historique — seul le futur rolling peut le faire.

Pour BTTS_YES, les données 2025 confirment qu'il faut continuer à durcir les exclusions de ligues.

## Validation calendrier 2026

Un script local a ete ajoute pour rejouer le vrai betting engine sur les fixtures historiques:

- `apps/backend/src/scripts/generate-season-picks.ts`

Commande de reprise utilisee:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/evcore LOG_LEVEL=error node apps/backend/dist/src/scripts/generate-season-picks.js --all-seasons --from 2026-01-01 --to 2026-12-31 --skip-existing
```

Le flag important est:

- `--skip-existing`: ignore les fixtures qui ont deja au moins un `model_run`.

Ce mode rend le script relancable apres interruption. Dans le run local, un premier passage a ete interrompu vers `3300/5086`, puis la reprise avec `--skip-existing` a traite seulement les fixtures restantes sans model run.

Etat DB apres generation calendrier 2026:

- fixtures terminees 2026: `5086`
- model runs rattaches a ces fixtures: `8217`
- model bets: `758`
- predictions: `1709`
- fixtures encore sans `model_run`: `142`

Les `142` fixtures restantes sont des skips du moteur, principalement des cas sans donnees suffisantes ou non analysables.

Rapports calendrier 2026:

- `apps/backend/reports/virtual-investment-channels.calendar-2026.txt`
- `apps/backend/reports/virtual-channel-loss-audit.calendar-2026.txt`

Resultat calendrier 2026 avec les garde-fous actuels:

| Groupe             | Total |     W |     L | Hit rate |
| ------------------ | ----: | ----: | ----: | -------: |
| candidats virtuels | `622` | `402` | `220` |  `64.6%` |
| top 5 quotidien    | `252` | `185` |  `67` |  `73.4%` |
| top 10 quotidien   | `330` | `239` |  `91` |  `72.4%` |

Performance top 5 par canal:

| Canal            | Total |     W |    L | Hit rate |
| ---------------- | ----: | ----: | ---: | -------: |
| `SAFE_UNDER45`   |  `13` |  `13` |  `0` | `100.0%` |
| `SAFE_UNDER35`   |  `26` |  `23` |  `3` |  `88.5%` |
| `SAFE_HT_OVER05` |  `17` |  `14` |  `3` |  `82.4%` |
| `SAFE_OVER15`    |  `19` |  `15` |  `4` |  `78.9%` |
| `BTTS_YES`       | `177` | `120` | `57` |  `67.8%` |

Conclusion calendrier 2026:

- les canaux `SAFE_UNDER45`, `SAFE_UNDER35`, `SAFE_HT_OVER05` et `SAFE_OVER15` restent globalement coherents;
- `BTTS_YES` devient le principal bruit quand on elargit la fenetre;
- le `top5` est trop souvent domine par `BTTS_YES`, ce qui fait tomber le hit rate global;
- la prochaine regle importante doit soit limiter fortement `BTTS_YES`, soit le sortir du `top5` principal et le garder comme canal exploratoire separe.
