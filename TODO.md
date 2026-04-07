# EVCore — TODO

## Branche courante : `feat/european-competitions-engine`

Référence : `EUROPEAN_COMPETITIONS_ENGINE.md` — lire avant toute implémentation.

---

## Plan d'implémentation

### ✅ Étape 1 — OddsSnapshot.source (prérequis)

- ✅ Ajout `source OddsSnapshotSource @default(PREMATCH)` sur `OddsSnapshot` (enum: `PREMATCH | HISTORICAL`)
- ✅ Prisma `db:generate` + rebuild `@evcore/db`
- ✅ `OddsSnapshotRetentionWorker` : filtrer `source = PREMATCH` uniquement
- ✅ `upsertOneXTwoOddsSnapshot` / `upsertOddsSnapshot` / `upsertSecondaryMarketOdds` : `source` optionnel, défaut `PREMATCH`

### ✅ Étape 2 — Activer les ligues européennes

- ✅ Seed : `isActive: true` sur UCL (leagueId=2), Europa (leagueId=3), Conference (leagueId=848)

### ✅ Étape 3 — Détection aller/retour

- ✅ Schema : `round String?`, `leg Int?`, `aggregateHomeGoals Int?`, `aggregateAwayGoals Int?` sur `Fixture`
- ✅ `MatchLegDetectionService` : detection par paires inversées dans les rounds KO, score agrégé calculé
- ✅ `fixtures-sync.worker.ts` : mapping `round` depuis `league.round` (support "League Stage - N")
- ✅ 6 tests unitaires

### ✅ Étape 4 — Config EUROPEAN_BACKTEST_SEASON_FROM

- ✅ `EUROPEAN_BACKTEST_SEASON_FROM = 2022` dans `backtest.constants.ts`

### ✅ Étape 5 — Worker import historique The Odds API

- ✅ `odds-historical-import.worker.ts` : UCL/UEL/UECL, saisons 2022/23 → 2024/25
- ✅ Matching fixtures par `(date + homeTeam + awayTeam)` fuzzy (normalisation accents, suffixes FC/AC)
- ✅ Tagger `source: HISTORICAL` sur chaque `OddsSnapshot`
- ✅ Endpoint ETL : `POST /sync/odds-historical/:competitionCode/backfill`
- ✅ Zod schema `TheOddsApiHistoricalResponseSchema`

### ✅ Étape 6 — Forme cross-compétitions

- ✅ `blendTeamStats({ primary, secondary, formWeight, xgWeight })` exportée depuis `betting-engine.service.ts`
- ✅ `isEuropeanCompetition()` + `EUROPEAN_CROSS_COMP_FORM_WEIGHT=0.6` + `EUROPEAN_CROSS_COMP_XG_WEIGHT=0.4` dans `ev.constants.ts`
- ✅ `analyzeFixture()` : pour UCL/UEL/UECL, fetch stats domestiques + blend (fallback si stats EU absentes)
- ✅ `backtest.service.ts` : `loadCrossCompStatsIndex()` + blend par fixture sur saisons européennes
- ✅ 5 tests unitaires `blendTeamStats`

### ✅ Étape 7 — Calibration par compétition UEFA

- ✅ `MODEL_SCORE_THRESHOLD` : UCL/LDC/UEL/UECL → 0.45
- ✅ `LEAGUE_MEAN_LAMBDA_MAP` : UCL=1.35, UEL=1.40, UECL=1.45 (initial — à affiner après backtest)
- ✅ `LEAGUE_HOME_ADVANTAGE_MAP` : UCL=[1.03, 0.97], UEL/UECL=[1.04, 0.96] (home advantage réduit en Europe)
- ✅ `LEAGUE_MIN_SELECTION_ODDS_MAP` : UCL/UEL/UECL=2.00

---

## Prochaines étapes (post-branche)

- [ ] Générer la migration Prisma (`pnpm --filter @evcore/db db:migrate -- --name european-competitions-engine`)
- [ ] Lancer le seed sur les nouvelles compétitions
- [ ] Lancer `POST /sync/fixtures/:leagueId` pour UCL/UEL/UECL (saisons 2022/23 → 2024/25)
- [ ] Lancer `POST /sync/rolling-stats` pour ces saisons
- [ ] Lancer `POST /sync/odds-historical/UCL/backfill` (+ UEL, UECL) après achat The Odds API
- [ ] Backtest européen + audit Brier score / ROI
- [ ] Affiner `LEAGUE_MEAN_LAMBDA` / home advantage sur données réelles

---

## Nouveaux marchés — `feat/new-markets` (à démarrer)

Audit API-Football du 2026-04-07 : les cotes Over/Under multiples lignes et HTFT sont
disponibles chez 14 bookmakers (dont Pinnacle id=4). Tout est calculable via le Poisson existant.

### Étape A — Over/Under 1.5 et 3.5

- [ ] `betting-engine.utils.ts` : ajouter `over15`, `under15`, `over35`, `under35` dans `DerivedMarketsProba`
      → même logique que `over25`/`under25` dans `deriveMarketsFromDistributions`
- [ ] `betting-engine.service.ts` : exposer ces 4 picks comme candidats (fetch cotes bet id=5)
- [ ] `OVER_UNDER` enum Prisma : vérifier si des picks `OVER_1.5` / `UNDER_3.5` nécessitent un nouveau `pick` label ou si le champ `pick` string suffit
- [ ] Ajouter les conditions dans `PICK_CONDITIONS` (`betting-engine.utils.ts`) + `resolvePickBetStatus`
- [ ] Tests unitaires : vérifier P(over15) et P(over35) sur inputs Poisson connus
- [ ] Filtres directionnels : appliquer `MIN_QUALITY_SCORE` — pas de seuil directionnel spécifique (marché goals)

### Étape B — HT/FT comme marché standalone évalué

- [ ] `betting-engine.service.ts` : les 9 probabilités HTFT sont calculées mais non comparées aux cotes
      → fetcher les cotes bet id=7 (HT/FT Double) et générer des picks candidats
- [ ] Ajouter `HALF_TIME_FULL_TIME` dans l'enum `Market` Prisma (si absent) + migration
- [ ] Filtres : seuil directionnel à définir (HOME_HOME et AWAY_AWAY les plus liquides)
- [ ] Tests unitaires : résolution `resolveHalfTimeFullTimeBetStatus` déjà testée — ajouter les cas candidats

### Étape C — Goals Over/Under 1st Half (optionnel, après A+B)

- [ ] Calculer Poisson(λ/2) pour Under 1.5 HT / Over 0.5 HT — déjà fait partiellement dans HTFT
- [ ] Fetch cotes bet id=6 et évaluer comme picks candidats
- [ ] Complexité : dépendance à la Mi-temps → évaluer si le volume de données justify l'effort

---

## Contexte technique

- Odds uniquement disponibles sur API-Football pour la saison 2025 (courante)
- Odds historiques 2022-2024 : import one-shot via The Odds API (~$30), Pinnacle inclus
- xG natif disponible sur UCL/Europa/Conference (pas besoin du proxy shots×0.35)
- Aller/retour : pas de champ `leg` dans l'API — inférence obligatoire par date + paires d'équipes
- "To Qualify" : absent sur Pinnacle, disponible sur Bet365/Marathonbet uniquement

---

## Historique précédent (branche main — R6 record)

Référence backtest R6 : **468 bets, +15.7% ROI, +73.46u**

Classement ligues actif sur `main` :

- Very Good : EL2, EL1, L1, PL
- Good : LL, J1, D2, F2, CH
- Medium : SP2
- Low : POR, MX1, SA, BL1
- Red : ERD, I2

Guide méthodologie : `docs/league-calibration-audit.md`
