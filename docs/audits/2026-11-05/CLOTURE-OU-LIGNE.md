# Clôture du plus/moins 2,5 : la ligne dans le pick (05/11)

## Constat

Le rapport ML-2a disait la clôture Pinnacle du plus/moins 2,5 « stockée sans ligne », donc introuvable par les juges `OVER_2_5`.

**Ce n'est pas un défaut de stockage.** La ligne 2,5 de `OVER_UNDER` vit sous les picks nus `OVER` / `UNDER`, colonne `line` nulle, par convention des deux ingesteurs :

- `extractOverUnderOdds` (`odds-prematch-sync.worker.ts`) : « Over 2.5 » → `OVER`, « Over 1.5 » → `OVER_1_5`, etc. ;
- l'import historique (`odds-historical-import.worker.ts`, `point === 2.5`) → `upsertOverUnderOddsSnapshot` → `OVER` / `UNDER`.

Copie de prod (au 03/11), `market = OVER_UNDER`, `line IS NULL` : picks nus chez les 11 books en PREMATCH (Pinnacle 45 777 paires, mars → novembre) et en HISTORICAL (Pinnacle 9 011, Unibet 13 745, 2022 → 2026). Aucun `OVER_2_5` n'existe en base. `odds_closing_line` (Pinnacle, ≤ 2 h) : 8 060 paires `OVER`/`UNDER`. Les moteurs, eux, choisissent aussi le pick nu (14 632 `OVER`, 17 971 `UNDER` dans `channel_selection` ; 4 `UNDER_2_5` laissés par VANTAGE, sans cote).

La convention était déjà écrite (`outcome-groups.ts`, `market-fair.ts`, `overUnderPickLine`). Les marchés de total d'équipe, eux, stockent `OVER_2_5` : la clé nue n'est 2,5 que sur `OVER_UNDER`.

## Lecteurs

| Lecteur                                          | Lecture du pick nu                                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| CLV des jambes, `outcomeGroup`, Shin             | 2,5, correct                                                                                                                  |
| `odds_closing_line`                              | vue brute, correcte                                                                                                           |
| Grille de marché (`selectMarketGridQuotes`)      | 2,5 via `overUnderPickLine`, correct                                                                                          |
| Cohérence O/U, fiche, feuille de match, libellés | `OVER` = 2,5, correct                                                                                                         |
| Rejeu ML-1 (`backtest-market-grid.ts`)           | clé `${market}\|${sel.pick}` = `OVER`, **correct** : les GOALS de ML-1 ont bien été jugés contre Pinnacle (+0,0032 → +0,0004) |
| Rejeu ML-2a (`backtest-goal-dependence.ts`)      | clé `OVER_2_5` : **0 match jugé** sur « moins 2,5 »                                                                           |
| **Fait de jambe** (`leg-fact.ts`, production)    | attendait `OVER_2_5` : **aucun fait** sur une jambe plus/moins 2,5 (115 jambes `OVER`/`UNDER` de coupon en base)              |

## Correctif

Un seul lecteur, `totalPickLine(market, pick, line)` (`packages/analysis-core/src/pricing/outcome-groups.ts`) : la colonne `line` si posée, sinon le suffixe du pick, sinon 2,5 pour la clé nue **sur `OVER_UNDER` seulement** (ailleurs `null`, jamais deviné). Branché sur le fait de jambe, la grille de marché et le juge de ML-2a. Rien à réécrire en base : aucune migration.

## Juge des totaux

À relancer par l'utilisateur (la base locale est sur 5433, `packages/db/.env` pointe 5432) :

```bash
DATABASE_URL=postgresql://…@localhost:5433/evcore \
  pnpm --filter @evcore/backtest-core backtest:goal-dependence
```

La ligne « moins 2,5 » du bloc « contre la clôture » donne alors l'écart² ρ − indépendant et le biais contre la clôture, IC bootstrap par jour. Pour ML-1, le juge des totaux n'est pas à refaire : il lisait déjà la bonne clé.
