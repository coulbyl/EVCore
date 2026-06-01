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

| Canal virtuel | Marche source | Intention |
| --- | --- | --- |
| `SAFE_HT_OVER05` | `OVER_UNDER_HT/OVER_0_5` | Detecter les matchs avec au moins un but en premiere mi-temps. |
| `SAFE_UNDER45` | `OVER_UNDER/UNDER_4_5` | Canal tres prudent sur les matchs peu susceptibles de partir en score extreme. |
| `SAFE_OVER15` | `OVER_UNDER/OVER_1_5` | Detecter les matchs avec au moins deux buts. |
| `SAFE_UNDER35` | `OVER_UNDER/UNDER_3_5` | Detecter les matchs sous quatre buts. |
| `BTTS_YES` | `BTTS/YES` | Detecter les matchs ou les deux equipes marquent. |

Ils sont exposes dans:

- `InvestmentDayDto.virtualSelections`
- `InvestmentDayDto.virtualTop5`
- `InvestmentDayDto.virtualTop10`

Ils apparaissent dans l'UI sous la section:

- `Canaux virtuels`

## Baseline avant garde-fous

Premier backtest virtuel:

| Groupe | Total | W | L | Hit rate |
| --- | ---: | ---: | ---: | ---: |
| candidats virtuels | `319` | `231` | `88` | `72.4%` |
| top 5 quotidien | `134` | `106` | `28` | `79.1%` |
| top 10 quotidien | `181` | `138` | `43` | `76.2%` |

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

| Canal | Regles ajoutees |
| --- | --- |
| `SAFE_HT_OVER05` | probabilite minimale montee a `75%` |
| `SAFE_UNDER45` | exclusion `NOR2`, `TUR1` |
| `SAFE_OVER15` | marge EV minimale `3pp` |
| `SAFE_UNDER35` | exclusion `MX1`, exclusion tranche proba `75-79%` |
| `BTTS_YES` | exclusion `ERD`, exclusion tranche proba `65-69%` |

La cle de cache `investment` a ete montee a:

- `investment:v5:{date}`

pour forcer l'API a servir les nouvelles selections.

## Resultats apres garde-fous

Backtest guarded:

| Groupe | Total | W | L | Hit rate |
| --- | ---: | ---: | ---: | ---: |
| candidats virtuels | `203` | `153` | `50` | `75.4%` |
| top 5 quotidien | `106` | `92` | `14` | `86.8%` |
| top 10 quotidien | `133` | `112` | `21` | `84.2%` |

Comparaison importante:

| Version | Top 5 W | Top 5 L | Hit rate |
| --- | ---: | ---: | ---: |
| avant garde-fous | `106` | `28` | `79.1%` |
| apres garde-fous | `92` | `14` | `86.8%` |

On a donc divise les pertes top 5 par deux.

Le compromis:

- moins de picks;
- moins de jours avec top 5 complet;
- une qualite nettement meilleure sur les picks qui restent.

## Performance par canal apres garde-fous

Top 5 par canal:

| Canal | Total | W | L | Hit rate |
| --- | ---: | ---: | ---: | ---: |
| `SAFE_UNDER45` | `13` | `13` | `0` | `100.0%` |
| `SAFE_UNDER35` | `25` | `22` | `3` | `88.0%` |
| `BTTS_YES` | `33` | `29` | `4` | `87.9%` |
| `SAFE_HT_OVER05` | `17` | `14` | `3` | `82.4%` |
| `SAFE_OVER15` | `18` | `14` | `4` | `77.8%` |

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

## Prochaine iteration

Priorites recommandees:

1. Raffiner `SAFE_OVER15`, car c'est le canal top 5 le moins propre.
2. Ajouter une analyse des scores mi-temps pour `SAFE_HT_OVER05`.
3. Isoler `BTTS_YES/SP2` sous `65%` pour voir si une variable supplementaire separe les gagnants des pertes.
4. Tester un mode `ultra-safe top3` a cote du `top5`, pour voir si le noyau le plus fiable approche mieux le 100%.
5. Rejouer la meme methode sur une autre fenetre temporelle pour limiter le sur-ajustement.
