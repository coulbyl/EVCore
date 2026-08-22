# EVCore — Roadmap d'implémentation

> Source de vérité pour le suivi d'avancement. Mettre à jour à chaque merge significatif.
> Spécification complète : [EVCORE.md](EVCORE.md) | Conventions : [CLAUDE.md](CLAUDE.md)

**Statut actuel : Phase 2 en production (argent réel) + Phase 3 ML en shadow — mise à jour le 2026-08-15 (Bloc 11)**

> Révisé le 2026-08-15 : sections Mois 1-3 condensées (détail non-critique,
> tout est `[x]` depuis mars 2026) ; plusieurs items marqués `[ ]`/`[~]`
> corrigés en `[x]` car déjà faits mais jamais mis à jour ici (Refactor
> Domaine canaux, multi-ligues) — voir TODO.md pour ce qui reste réellement
> ouvert.

---

## Légende

- `[ ]` À faire
- `[x]` Terminé
- `[~]` En cours
- `[-]` Annulé / reporté

---

## MVP — Phase 1 (3 mois) ✅ terminé — Go Phase 2 le 2 mars 2026

> Condensé le 2026-08-15 (détail semaine par semaine plus utile, tout est
> `[x]` depuis mars). Fondations (monorepo NestJS, Docker Compose, Prisma,
> CI/CD) ; Mois 1 — ETL historique 3 saisons EPL, stats rolling, modèle
> Poisson, backtest 3 saisons ; Mois 2 — odds historiques, calcul EV
> (`decimal.js`), simulation value bets, tracking ROI/Brier + suspension
> auto ; Mois 3 — automatisation BullMQ, boucle d'apprentissage
> (`AdjustmentService` auto-apply/rollback), stabilisation E2E.
>
> **Validation MVP (2 mars 2026)** : Brier Score **0.592** (3 saisons
> agrégées, seuil ≤0.65), Calibration Error **2.5%** (seuil ≤5%), ROI simulé
> **+2.28%** (seuil ≥-5%) — modèle bat le hasard sur 3 saisons EPL. **GO Phase 2.**

---

## Phase 2 (après validation MVP)

- [x] Sources live : API-Football (worker `odds-live-sync`, Pinnacle → Bet365 fallback)
- [x] Snapshot odds horodaté pré-match (`OddsSnapshot` live par fixture)
- [x] ETL multi-ligue (config `COMPETITIONS`, `isActive`, jobs avec `competitionCode`)
- [x] Odds CSV multi-compétitions (`divisionCode` par ligue, import PL/SA/LL/BL1 configurable)
- [x] API rolling-stats multi-ligue (`POST /rolling-stats/backfill/:competition/:season`)
- [x] `getActiveCsvSeasonCodes()` — fenêtre glissante 3 saisons (remplace `CSV_ODDS_SEASONS` hardcodé)
- [x] ETL controller : endpoints paramétrés `/sync/:type`, `/sync/:type/:competitionCode` + Swagger complet
- [x] `odds-live-sync` : lockDuration 600s + schema odds assoupli (Exact Score > 1000, Asian Handicap = 1.00)
- [x] `odds-csv-import` : rows sans cotes (saison en cours) skippées en `debug` silencieux
- [x] `odds-csv-import` incrémental : snapshots closing déjà présents skippés sans upsert
- [x] Pipeline live validé en prod : `synced: 4, skipped: 0` sur 4 fixtures EPL (2 mars 2026)
- [x] Kelly fractionnelle (0.25) — config flag `KELLY_ENABLED`
- [x] Multi-ligues — bien au-delà de SA/LL/BL1 : 26 compétitions actives en
      production (`packages/db/src/seed.ts`), item corrigé le 2026-08-15
      (marqué à tort "activation progressive")

### Bloc 3 — Daily Picks Generator ✅ (2 mars 2026)

> Notion de "coupon" retirée (bloc combiné supprimé) — le moteur produit désormais
> des picks individuels par fixture (référence historique uniquement ci-dessous).

**Feature flags + shadow scoring**

- [x] `feature-flags.constants.ts` — `FEATURE_FLAGS.SCORING` (LINE_MOVEMENT=true, INJURIES/H2H/CONGESTION/LINEUPS=false shadow)
- [x] Shadow scoring dans `analyzeFixture()` — facteurs calculés mais non pris en compte, shadow\_\* loggés dans `ModelRun.features`
- [x] Filtre line movement — delta cote > 10% sur 7 jours → fixture exclue (depuis `OddsSnapshot` DB)

**Picks quotidiens**

- [x] ~~Calcul probabilité jointe combo-match depuis table Poisson bivariée (`betting-engine.utils.ts`)~~ — **retiré 2026-07-18**, remplacé par les marchés bookmaker pré-combinés `RESULT_TOTAL_GOALS`/`RESULT_BTTS`
- [x] ~~`COMBO_WHITELIST` — 12 combinaisons valides (1X2 × BTTS/OVER, DC × BTTS, OVER × BTTS)~~ — **retiré 2026-07-18**
- [x] Sélection `qualityScore = EV × deterministicScore`, garde d'idempotence par fixture
- [x] Anti-corrélation — max 1 bet par fixture (meilleur qualityScore conservé)
- [x] `BULLMQ_QUEUES.BETTING_ENGINE` + scheduler `onApplicationBootstrap()`
- [x] `NotificationService.sendDailyPicks()` — email (≥ 1 pick)
- [x] `NotificationService.sendNoBetToday()` — email (0 opportunité EV+)
- [x] `upsertOddsSnapshot()` multi-marché (1X2 + Over/Under 2.5 + BTTS) dans `fixture.repository.ts`
- [x] `extractAdditionalMarketOdds()` dans `odds-live-sync.worker.ts`
- [x] Tests unitaires `computeJointProbability`, `COMBO_WHITELIST`, `resolveComboPickBetStatus`
- [x] 204 tests passants, lint ✓, typecheck ✓

---

### Bloc 4 — Shadow Data Collection + AdjustmentService étendu

**Shadow services (données réelles, score non activé)**

- [x] ETL worker `injuries-sync` — API-Football `/injuries` par fixture SCHEDULED proche (today+tomorrow UTC), stocké en `ModelRun.features.shadow_injuries`
- [x] `H2HService` — 5 dernières confrontations depuis fixtures DB, `shadow_h2h` dans ModelRun (DISABLED par défaut)
- [x] `CongestionService` — jours depuis dernier match + fixtures dans les 4 prochains jours, `shadow_congestion` (DISABLED)

**Boucle d'auto-activation**

- [x] `AdjustmentService` étendu — corrélation Spearman shadow\_\* vs outcomes sur 50+ bets
- [x] Auto-activation si |rho| > 0.15 : poids shadow feature activé, `AdjustmentProposal` généré et appliqué
- [x] Rollback d'une auto-activation via `POST /adjustment/:id/rollback` (existant)

---

### Bloc 5 — Settlement des paris + résultats live

- [x] Settlement des bets PENDING dès que la fixture passe `FINISHED` (WON/LOST/VOID)
- [x] Remplacement de `results-sync` par `pending-bets-settlement-sync` ciblé sur les fixtures avec bets PENDING
- [x] `NotificationService.sendBetResult()` — email récap résultat pari individuel

---

### Bloc 6 — Suite Phase 2

- [x] Marché Mi-temps/Fin de match (HT/FT combo)
  - [x] Fondations HT/FT backend: enum marché, stockage score mi-temps, settlement dédié (`resolveHalfTimeFullTimeBetStatus`)
  - [x] Probas HT/FT (9 issues) dérivées du modèle Poisson
  - [x] Ingestion odds live HT/FT + stockage `OddsSnapshot` (`HALF_TIME_FULL_TIME`)
  - [x] Sélection EV/qualityScore étendue au marché HT/FT dans `BettingEngineService`
- [x] Déploiement production (VPS OVH)
  - [x] Docker Compose (backend + web + postgres + redis) sur `/opt/evcore`
  - [x] Nginx reverse proxy + HTTPS Let's Encrypt (`c-evcore.com`, `api.c-evcore.com`)
  - [x] CI/CD GitHub Actions → GHCR → deploy SSH automatique au merge sur `main`
  - [x] `CORS_ORIGIN=https://c-evcore.com` + `NEXT_PUBLIC_API_URL=https://api.c-evcore.com`
- [x] Stabilité first prod sans TimescaleDB
  - [x] Cleanup automatique `OddsSnapshot` via worker ETL `odds-snapshot-retention` (rétention configurable)
  - [x] Indexation `OddsSnapshot` renforcée (requêtes moteur + purge par date)
  - [x] Fenêtre picks multi-jours (1-3 jours) pour combiner 2-3 journées
  - [x] Tuning rate-limit/quota API-Football (estimation appels/jour + warning seuil quota)
- [x] Fallback FRI hors pipeline Poisson principal
  - [x] Branche dédiée `competitionCode === 'FRI'` avant le guard `missing_team_stats`
  - [x] Source primaire `FRI_ELO_REAL` pour sélections nationales seniors mappées
  - [x] Fallback `ODDS_DEVIG` sur cotes 1X2 complètes si Elo indisponible
  - [x] `NO_BET` explicite si aucune source probabiliste exploitable
  - [x] V1 limitée au marché `ONE_X_TWO`
  - [x] Persistance `predictionSource`, `fallbackReason`, diagnostics Elo/odds et `eloSnapshotAt`
- [x] Référence Elo synchronisée en base
  - [x] Worker ETL `elo-sync` depuis `https://eloratings.net/World.tsv`
  - [x] Stockage DB `national_team_elo_rating`
  - [x] Consommation runtime du dernier snapshot Elo par le moteur FRI
  - [x] Conservation du dernier snapshot uniquement
- [x] Audit FRI Elo aligné sur la donnée de prod
  - [x] `fri-elo-audit.ts` lit le dernier snapshot DB au lieu d'un TSV local
  - [x] Génération d'un report texte dans `packages/db/reports/`
  - [x] Benchmark `FRI_ELO_REAL` / `FRI_ELO_INTERNAL` / `ODDS_DEVIG`
- [x] Hygiène des fixtures passées encore `SCHEDULED`
  - [x] Worker ETL `stale-scheduled-sync`
  - [x] Endpoint manuel `POST /etl/sync/stale-scheduled`
  - [x] Réconciliation des fixtures passées récentes encore `SCHEDULED`
- [x] Reporting opérationnel complémentaire
  - [x] `scheduled-fixtures-report.ts` pour volumétrie `SCHEDULED` par date et compétition
- [x] Nettoyage scripts DB obsolètes
  - [x] Suppression `reset-zero-xg.ts`
  - [x] Suppression `sa-away-audit.ts`
  - [x] Suppression `fri-xg-audit.ts`
- [-] OpenClaw integration — abandonné
- [-] Grafana dashboards — abandonné (à réévaluer si monitoring ML le requiert en Phase 3)
- [-] TimescaleDB — abandonné, rétention `OddsSnapshot` via worker suffisante ; les snapshots existants sont conservés pour analyse en Phase 3
- [x] Multi-bookmakers — périmètre stabilisé : Pinnacle + Bet365 (1X2), fallbacks Unibet/Marathonbet/Bwin pour marchés secondaires

---

---

### Bloc 7 — Canaux de prédiction (CONF / BTTS / DRAW)

> Canaux indépendants de l'EV — décision basée sur seuils probabilistes par ligue, calibrés par backtest avant activation.

**CONF (Confiance)**

- [x] `prediction.service.ts` — argmax 1X2 si P_max ≥ seuil ligue
- [x] Seuils actifs : PL (0.55), BL1 (0.50), SP2 (0.55), LL (0.50), POR (0.50), SA (0.55), L1 (0.50), I2 (0.50), UCL/UEL/UECL (0.60) et 10+ ligues supplémentaires
- [x] Endpoint `GET /predictions` avec filtres `channel`, `date`, `status`

**BTTS (BB — Both Teams To Score)**

- [x] Signal : P(BTTS) depuis modèle Poisson (`computeBttsProb`)
- [x] Seuils actifs : BL1 (0.60), PL (0.58), SA (0.62), LL (0.55), SP2 (0.58), D2 (0.60), CH (0.52), I2 (0.58), POR (0.58) et 10+ ligues supplémentaires

**DRAW (Nul)**

- [x] Signal `1/drawOdds` (probabilité implicite bookmaker) — Poisson en fallback
- [x] Verdict backtest DRAW : ROI ≥ +5% + HR ≥ 32% + volume ≥ 10 picks
- [x] Ligues actives : I2 (0.30 — ROI +11.1%), BL1 (0.28 — ROI +21.4%), POR (0.30 — ROI +12.7%), SA (0.30)
- [~] Évaluation ligues supplémentaires (feat/implementing-draw-channel)
- [x] Documentation `DRAW-DETECTION.md` — historique signal, tableau ligues actives/désactivées

**UI & Récap**

- [x] Badge canal (EV, SV, CONF, BTTS, DRAW) dans picks-du-jour
- [x] Boutons cote et panier pour canaux CONF/DRAW/BTTS
- [x] Ordre d'affichage : SV → BB → CONF → DRAW → EV
- [x] Page Récap avec filtres canal/période, stats et courbe progression

### Bloc 8 — Extension marchés Niveau 1/2/2.b + nouveaux canaux (2026-07-18)

> Suite de `docs/market-coverage-expansion.md`. Deux volets : (a) rendre les 10
> marchés ajoutés depuis Niveau 1 exploitables par EV/SAFE, (b) ajouter des
> canaux de prédiction dédiés pour les signaux vraiment indépendants (pas une
> reformulation d'un canal existant — voir arbitrage dans EVCORE.md).

- [x] `listEvaluatedPicks` évalue désormais DRAW_NO_BET, TEAM_TOTAL_HOME/AWAY,
      CLEAN_SHEET_HOME/AWAY, WIN_TO_NIL_HOME/AWAY, TO_WIN_EITHER_HALF,
      RESULT_TOTAL_GOALS, RESULT_BTTS — candidats VALUE (gate EV) au même
      titre que les marchés historiques.
- [x] Nouveaux canaux `CLEAN_SHEET`, `TEAM_TOTAL`, `WIN_EITHER_HALF` —
      DRAW*NO_BET et WIN_TO_NIL/RESULT*\* écartés du statut "canal dédié"
      (renormalisation/dérivé d'un signal déjà couvert, pas un signal neuf).
- [x] `CleanSheetStrategy`/`WinEitherHalfStrategy` : argmax entre deux
      marchés/picks au-dessus d'un seuil par ligue (pattern `BttsStrategy`).
- [x] `TeamTotalStrategy` : meilleur (équipe × ligne × side) par EV (pattern
      `GoalsStrategy`, doublé sur la dimension équipe).
- [x] Migration Prisma `StrategyChannel` +3 valeurs — écrite et **appliquée**.
- [x] **CLEAN_SHEET / WIN_EITHER_HALF passés en OBSERVATION** (2026-07-18,
      toutes les ligues actives avec n ≥ 50 fixtures settled) : aucune cote
      historique n'existe pour ces marchés (stub vide dans
      `odds-historical-import.worker.ts` ; The Odds API 422 même sur BTTS/DNB
      — pas de fallback possible), donc pas de ROI backtestable. Seuils
      dérivés directement des scores FT/HT déjà en base (taux de base par
      ligue − marge 0.05), même méthodologie que `GOALS_CONFIG`. Jamais misé
      (observation seule), accumulation forward via la sync PREMATCH
      démarrée le même jour.
- [x] **TEAM_TOTAL passé en OBSERVATION** (2026-07-19, mêmes 67 ligues) :
      même méthodologie que `GOALS_CONFIG`, doublée sur la dimension équipe —
      par (ligue × équipe × ligne), side = OVER si taux empirique ≥ 0.55,
      UNDER si ≤ 0.45, les deux dans la bande 0.45–0.55 ; seuil = taux du
      côté choisi − 0.05. Lignes au taux de base > 0.90 exclues (ex. "Away
      Under 4.5" à 99% — near-certain, aucune valeur informative, contrairement
      aux lignes GOALS/CLEAN_SHEET qui restent dans une plage incertaine).
      442 segments dérivés depuis les scores FT réels.
- [x] `backtest.repository.ts`/`tuning.metrics.ts` étendus : fetch des cotes
      CLEAN_SHEET_HOME/AWAY + TO_WIN_EITHER_HALF, sweep par seuil prêt dès
      que la sync PREMATCH aura accumulé assez de volume forward pour un
      vrai ROI (`POST /backtest/tuning`, déjà branché via `TUNING_CHANNELS`).
      TEAM_TOTAL n'a pas cette brique de sweep (comme les lignes GOALS
      1.5/3.5/4.5, qui n'en ont pas non plus faute de cotes historiques) —
      seule la config structurelle par taux de base a été faite.
- [x] Web : labels FR/EN pour les 10 marchés Niveau 1/2/2.b (`helpers/fixture.ts`)
      et `ObservationBadge` étendu à CLEAN_SHEET/TEAM_TOTAL/WIN_EITHER_HALF sur
      `/dashboard/decisions` (jusque-là réservé à CORRECT_SCORE) — les 3
      nouveaux canaux produisent de vraies décisions `SELECTED`, il fallait un
      vrai libellé et un signal "jamais misé" cohérent.
- [x] `offensiveBalance` (ratio + classification BALANCED/ASYMMETRIC/
      STRONGLY_ASYMMETRIC) — `computeOffensiveBalance()` dans
      `analysis-core/probability/match-stats.ts`, câblé dans
      `ModelRun.features` et exposé à la fiche Eva (JSON + rendu texte).
      Reprend la section 12 de `analyse-fiche-evcore-avec-gpt.md` (différencier
      Over/team total de BTTS selon l'asymétrie offensive). Informationnel
      uniquement — aucune stratégie ne le consomme, bornes de classification
      non backtestées.

### Bloc 9 — Générateur de coupon : sélection intelligente + longshot (2026-08-09)

> Diagnostic initial : sélection de jambes non pondérée par la qualité (stabilité
> temporelle, cohérence interne, déséquilibre offensif), filtre AVOID binaire
> jetant des picks valides, répétition des mêmes jambes dominantes entre les
> coupons générés le même jour, DRAW staké sans whitelist par ligue,
> `COUPON_PARAMS.minCouponEV` jamais re-backtesté depuis sa source documentée
> (fichier `backtest-selected-params.json` introuvable dans ce repo). Branche
> `feat/coupon-generator-intelligence`. Reste à faire : [TODO.md](TODO.md).

**Architecture préalable**

- [x] Signaux `offensiveBalance`/`shadow_predictions.conflict`/`dataCoverage`
      unifiés dans `apps/backend/src/utils/model-run.utils.ts` — supprime la
      duplication entre `analysis-sheet` et `coupon` qui avait laissé les deux
      pipelines diverger
- [x] `OddsSnapshotLoader.findLatestOddsSnapshotsBatch` — élimine le N+1 sur
      les cotes (une requête au lieu de ~34/fixture), condition de viabilité
      du pool multi-jours

**Sélection et composition**

- [x] Routage AVOID gradué (`classifyAvoidSignal` : CLEAN/FADE/DROP/KEEP) —
      remplace le filtre binaire qui jetait des picks validés +51% ROI
      (régime KEEP) ; FADE (pick inverse) reste shadow (`COUPON_ENFORCE_AVOID_FADE=false`, n=15-17 trop fin)
- [x] `SignalWindowService.getTodayPool` → `getPoolForRange` — pool
      multi-jours, fenêtres weekend (ven→dim) / midweek européen (mar→jeu)
      auto-détectées (`coupon.worker.ts::resolveGenerationWindow`)
- [x] `CouponComposerService.compose` — sélecteur `composeExhaustive`
      (≤5 legs) / `composeGreedy` (longshot), règles d'anti-corrélation
      partagées entre les deux + plafond de jambes par jour
- [x] Diversité inter-coupons (`selectDiverseCoupons`) — le top-N par EV ne
      renvoie plus des coupons quasi-identiques partageant la même jambe forte
- [x] Profils `LONGSHOT_WEEKEND`/`LONGSHOT_MIDWEEK` (cote cible 50-70,
      8-12 legs) — **activés en observation permanente** (aucun backtest
      dédié encore possible, pas d'historique multi-jours à rejouer), badge
      "Expérimental" côté frontend (`CouponProposalDto.experimental`)

**Backtests et recalibration (données réelles, split train/valid)**

- [x] `BTTS_STAKED_LEAGUES` re-validé : `[PL, BL1, SA]` → `[PL, BL1]` (SA
      instable — signe qui s'inverse entre train et valid)
- [x] Nouvelle whitelist `DRAW_STAKED_LEAGUES` par ligue : `[I2, POR, BL1]`
      (avant : DRAW staké globalement sur un poids bas, masquant un écart de
      ROI de +41% à -45% selon la ligue)
- [x] `COUPON_PARAMS.minCouponEV` recalibré 0.05 → 0.15 (403 vrais
      `CouponProposal` réglés depuis 2023, train ROI +28.3%→+29.2%, valid
      +19.8%→+23.2%) ; source documentée corrigée en tête de
      `coupon.constants.ts`
- [x] Calibration `k`/`decayHalfLifeDays`/`windowDays` mesurée (Brier
      walk-forward) — gain réel mais marginal, **non appliqué** : une mémoire
      plus longue sacrifierait la réactivité aux dérives de canal/ligue déjà
      observées cette session (CONSENSUS, DRAW, BTTS/SA)
- [x] Scripts ajoutés (`packages/db/scripts/`) : `backtest-coupon-quality-signals.ts`,
      `backtest-channel-league-whitelist.ts`, `backtest-coupon-params-validation.ts`,
      `backtest-signal-window-calibration.ts`

**Bugs corrigés en cours de route**

- [x] `CouponRepository.deletePendingForDate` effaçait tous les profils
      PENDING du jour, pas seulement celui régénéré — aurait supprimé le
      profil DEFAULT à chaque génération LONGSHOT sur la même date
- [x] Dashboard : égalité stricte sur `forDate` faisait disparaître un
      coupon multi-jours généré vendredi dès samedi/dimanche, même encore
      `PENDING`
- [x] Settlement bloqué indéfiniment sur fixture `POSTPONED`/`CANCELLED`
      (jamais `FINISHED`) — confirmé réel (45+96 fixtures), `CouponResult.VOID`/`PARTIAL`
      désormais atteignables (`PARTIAL` était du code mort avant ce fix)

---

### Bloc 10 — Audit calibration DB prod : coupons, canaux observation, promotion par ligue (2026-08-12)

> Première session avec accès lecture seule à la DB de prod (méthode :
> [PROD_DB_ACCESS.md](PROD_DB_ACCESS.md)). Post-mortem d'un coupon manuel
> raté (2 jambes sur 3 cassées) qui a mené à un audit plus large : calibration
> réelle de `jointProbability`, ratio gagné/perdu des legs refusées par
> canal, pourquoi 7 canaux sur 10 n'ont jamais atteint un coupon/abonnement/
> pari réel, et classement par ligue de CORRECT_SCORE + des 4 canaux jamais
> évalués (CONSENSUS/GOALS/CLEAN_SHEET/WIN_EITHER_HALF). Détail complet et
> requêtes dans la conversation source ; suites d'action dans [TODO.md](TODO.md).

**Bugs corrigés en cours de route**

- [x] `SignalWindowService`'s `canals` (signal-window.service.ts:528)
      oubliait `TEAM_TOTAL` — retombait sur le prior statique gelé
      `CANAL_BASE_WEIGHT.TEAM_TOTAL=0.15` au lieu d'un taux calibré réel,
      et le départage par probabilité brute non calibrée faisait piocher
      préférentiellement les pires legs historiques (29.4% de réussite sur
      les 17 legs choisies vs 60.3% sur les 3 009 laissées de côté)
- [x] Export JSON de la fiche (`analysis-sheet.render.ts`) : les picks
      `OVER_UNDER` sur la ligne 2.5 s'affichent en `"OVER"`/`"UNDER"` bruts
      (convention historique sans suffixe de ligne, `goals.strategy.ts`) —
      ajout d'un champ `label` (via `pickLabel()`, déjà utilisé côté `.txt`
      mais jamais côté JSON) pour lever l'ambiguïté sans toucher à l'enum

**Constats de calibration confirmés sur données réelles (suites dans TODO.md)**

- [x] `jointProbability` des coupons se dégrade avec la confiance affichée
      (bucket ~44% annoncé → 20% réel sur n=30) — pas de correction de
      corrélation entre jambes dans le calcul actuel
- [x] `LONGSHOT_WEEKEND/MIDWEEK` : premier déclenchement réel (11/08, 3 jours
      après activation) confirmé à 0 coupon généré — cause identifiée :
      `MAX_POOL_SIZE=25` + règle anti-corrélation (1 leg/canal+marché)
      starvent `composeGreedy` avant `minLegs`, pas un bug de câblage
- [x] 7 canaux sur 10 (DOMINANT, BTTS, DRAW, GOALS, CONSENSUS, CLEAN_SHEET,
      WIN_EITHER_HALF) n'ont jamais placé une seule jambe dans un coupon,
      abonnement ou pari réel sur toute l'historique — DOMINANT exclu à
      raison (ROI backtesté −2.1%), BTTS/DRAW trop récemment promus (whitelist
      par ligue du 09/08) pour juger, les 4 autres jamais évalués du tout
- [x] Seuil DOMINANT symétrique alors que le biais mesuré ne l'est pas : legs
      HOME refusées sous-estimées (49.0% réel vs ~45.5% annoncé), legs
      AWAY/DRAW refusées surestimées (37.1%/28.0% réel vs ~44-45% annoncé)
- [x] CORRECT_SCORE et WIN_EITHER_HALF (Corée) confirment le même biais que
      `jointProbability` : la calibration casse précisément quand le modèle
      affiche une confiance inhabituellement haute — motif transversal, pas
      local à un canal
- [x] Classement par ligue de CORRECT_SCORE (35 ligues n≥20) et des 4 canaux
      jamais évalués — signal net et exploitable par ligue sur plusieurs
      (CORRECT_SCORE : USA2/UCL/KOR2 ; CONSENSUS : L1/F2/SUI1/FIN1 ; GOALS :
      BRA2 ; CLEAN_SHEET : USA2/UCL) alors que l'agrégat global masquait ce
      signal ou le donnait pour mauvais

**Bug ETL corrigé le 2026-08-13 — dates de saison locales fausses sur
transition de format (J1) et trou d'intersaison (AUS1)**

> Repéré en observant les logs ETL en direct : `season: 2026` dans les logs
> se lisait comme "saison passée", ce qui a mené à vérifier le mécanisme de
> résolution de saison complet plutôt que juste corriger l'affichage.

- [x] Diagnostic confirmé en direct contre l'API-FOOTBALL (`/leagues?id=`)
      pour les 68 compétitions actives — un seul vrai décalage structurel
      (J1) + un trou d'intersaison mineur (AUS1, cf. TODO.md), tout le reste
      sain. `apiSeasonOverride=2027` pour J1 est confirmé **correct**
      (l'API elle-même déclare `current: true` sur l'année 2027) — le bug
      n'était pas le numéro de saison utilisé pour interroger l'API, mais la
      plage de dates calculée localement pour le `Season` record
      (`seasonFallbackStartDate/EndDate`), qui suppose toujours que le
      numéro de saison égale l'année de démarrage réelle — hypothèse cassée
      par la bascule de J1 d'un format annuel civil vers un format
      août→juin façon Europe (première saison à cheval sur deux années dans
      l'histoire du championnat)
- [x] `apps/backend/src/modules/etl/schemas/leagues.schema.ts` +
      `league-season-dates.ts` (nouveau) — `fetchLeagueSeasonDates()`
      récupère les vraies dates `start`/`end` de la saison en cours depuis
      `/leagues`, best-effort (ne bloque jamais un sync, retombe sur
      l'heuristique `seasonStartMonth` en cas d'échec réseau/Zod/saison non
      trouvée) — remplace le calcul local dans `fixtures-sync.worker.ts`,
      `injuries-sync.worker.ts` et `stats-sync.worker.ts` (les trois
      appellent `upsertSeason` et doivent s'accorder, sinon l'un écrase les
      bonnes dates que l'autre vient d'écrire)
- [x] Logs de sync (`fixtures-sync-worker`/`injuries-sync-worker`/
      `stats-sync-worker`) enrichis avec `seasonName` (ex. `"2026-27"`) en
      plus de l'entier brut `season`, pour éviter la confusion "ça a l'air
      de pointer sur la saison passée" qui a déclenché cette investigation
- [x] Tests : `league-season-dates.spec.ts` (nouveau) + mocks `execFile`
      des 3 workers mis à jour pour dispatcher par URL (`/leagues` vs
      l'endpoint principal) plutôt qu'une file FIFO unique — 827 tests verts
- [x] `AVOID.offenders` dans l'export JSON portait la même ambiguïté de pick
      que `selectedPicks` (pas de `label` résolu) — harmonisé avec le même
      champ `label` via `pickLabel()` ; le rendu `.txt` réutilise maintenant
      ce champ au lieu de le recalculer

**Bug confirmé le 2026-08-13 — `calibration_alert` n'a aucune couverture sur
OVER_UNDER/marchés de buts**

> Repéré en post-mortem d'une jambe cassée du coupon longshot 13-14/08
> (FC Nordsjaelland–Valur, Under 3,5 buts, terminé 5-0+). Détail dans
> [TODO.md](TODO.md).

- [x] `assessMarketCoherence()` (`market-coherence.ts`), seule source de
      `calibration_alert`, ne compare que le 1X2 (home/draw/away) contre les
      cotes bookmaker — jamais invoquée avec des probabilités OVER_UNDER.
      Un swing de calibration goals aussi grand soit-il (ici ~19pp entre
      Poisson brut et proba finale, via le shrinkage ligue de
      `ou-shrinkage.ts`) ne peut structurellement jamais déclencher d'alerte
      ni d'exclusion du staking, contrairement aux picks 1X2 (seuils
      `MAX_DIVERGENCE=0.30`/`FAVORITE_FLIP_MIN_GAP=0.15` dans `ev.constants.ts`)

**Décision du 2026-08-13 — passer d'une analyse coupon réactive à active**

> Constat post-mortem : l'analyse manuelle de coupon se limitait à lire
> `selectedPicks` (un pick par canal, filtré par les seuils propres à
> chaque canal — EV/odds/probabilité — qui n'ont pas de sens pour
> construire un combiné à la main) plutôt que balayer tous les marchés
> cotés de tous les matchs du jour. Détail et mécanique dans
> [COUPON_ANALYSIS_TEMPLATE.md](COUPON_ANALYSIS_TEMPLATE.md) (étape 0) et
> [TODO.md](TODO.md) (section Générateur de coupon).

- `[x]` Enrichir l'export "fiche EVCore"
  (`apps/backend/src/modules/analysis-sheet/analysis-sheet.render.ts`)
  avec `evaluatedPicks` complet par fixture (tous statuts) au lieu du
  seul `selectedPicks` par canal — préalable pour que l'analyse balaie
  tous les marchés sans dépendre d'un accès DB live par fixture.

**Audit systémique 2026-08-13 — recherche ciblée du même motif de bug**

> Le produit tourne en argent réel (dépassé le stade MVP) — décision de
> systématiquement chercher et noter, pas corriger à la volée en session,
> toute occurrence du motif "garde-fou/résolution de données écrit pour un
> cas précis (1X2, ligne 2,5, marché entier) qui ne généralise pas
> silencieusement aux cas voisins soumis au même risque". 9 occurrences
> supplémentaires trouvées en plus des 3 du post-mortem initial — dont la
> cause racine des doublons `odds_snapshot` (upsert qui ne se déclenche
> jamais, clé jamais réellement `@@unique`). Détail complet dans
> [TODO.md](TODO.md), section "Audit systémique 2026-08-13".

**PR "sûrs uniquement" du 2026-08-13** — 4 correctifs sans impact sur le
comportement de staking, livrés dans la foulée de l'audit plutôt que
remis à plus tard : fiche EVCore enrichie (`evaluatedPicks` complet,
ci-dessus) ; `brierScore` du rapport hebdo calculé pour de vrai au lieu
d'un `0` en dur ; `selectSafeValuePick` complété avec la contrepartie
`OVER_4_5` manquante ; upsert `odds_snapshot` réparé côté code (le
find-then-create/update remplace le try/catch qui ne se déclenchait
jamais — la contrainte `@@unique` en DB reste une migration à faire par
l'utilisateur). Le reste de l'audit (calibration_alert étendu,
under_high_lambda généralisé, seuils DRAW/longshot/htftCalibrated,
shrinkage TEAM_TOTAL) demande un backtest avant merge — laissé dans
TODO.md, pas dans cette PR. 828 tests verts, typecheck et lint propres.

---

### Bloc 13 — Refonte d'Investir : trois vues, plus de `topN` (2026-08-22, branche `fix/todo-2026-08-15`)

> Suite directe de l'audit [docs/audit-canaux-investir-2026-08-22.md](docs/audit-canaux-investir-2026-08-22.md)
> §5. Investir n'est plus une surface de revue exhaustive (18 modes, un par
> canal) mais **le point de filtre unique** du système : un filtre se juge à
> ce qu'il exclut, pas à ce qu'il expose.

**Ce qui a été supprimé, et sur quelle mesure**

- [x] **`topN` en entier, sans exception.** Les 5 plafonds testés en apparié
      (top-N contre liste entière le même jour) : VALUE t=+0.80, TEAM_TOTAL
      +0.70, DOMINANT −0.50, SAFE −1.20, DRAW −1.74. Aucun significatif, les
      deux plus proches du seuil négatifs. Garder VALUE parce qu'il « marche »
      parmi cinq essais, c'est le winner's curse appliqué aux règles.
- [x] `MODE_RANKING`, `SINGLE_CHANNEL_MODE_MAP`, `VALUE_MODE_CHANNELS`,
      `InvestmentMode` → une seule liste de canaux et un tri unique, la
      probabilité calibrée.
- [x] `NEGATIVE_ROI_CHANNELS` (liste figée de 2 canaux, datée du 2026-07-06)
      → **ROI shrinké recalculé** par Bayes empirique. La liste figée en
      nommait 2 alors que 16 canaux sur 18 sont négatifs.
- [x] `PROBABILITY_BUCKETS` et le badge EV vert/rouge du front. L'EV se calcule
      sur l'edge revendiqué, mesuré anti-prédictif ; l'afficher en vert mettait
      en avant l'ampleur de l'erreur du modèle.

**Ce qui remplace**

- [x] **Trois vues** : « Ce qu'on assume » (canaux à ROI shrinké positif — 2
      sur 18, DOUBLE_CHANCE et DRAW —, DRAW borné à `DRAW_STAKED_LEAGUES`),
      « En observation » (tout le reste, une liste filtrable par canal, ROI du
      canal affiché sur chaque pick), « Écarté » (ce que les garde-fous ont
      retiré, avec la raison). La troisième manquait et c'est celle qui rend
      le filtre auditable.
- [x] **Calibration par courbe de Platt** (`channel-reliability.ts`) au lieu du
      décalage constant `meanError` : la courbe est plus plate que la
      diagonale, pas décalée. C'est l'acquis du Bloc 12, ratio 0.819 → 1.016.
- [x] **`MAX_LEG_EDGE` et `MIN_LEG_ODDS` remontés du coupon vers Investir**,
      pour qu'ils s'appliquent à toute surface de mise. Conséquence assumée :
      les picks VALUE, que `VALUE_MIN_EDGE = 0.10` sélectionne au-dessus du
      plafond, atterrissent massivement dans « Écarté ».
- [x] **Abonnements** : `investmentMode` remplacé par le canal ; les options
      `topN` par canal (VALUE [1,5], TEAM_TOTAL 3) unifiées, leur
      justification reposant sur les mêmes backtests invalidés — le `topN`
      d'abonnement redevient un curseur d'exposition, pas une règle calibrée.
      `CHANNEL_DOUBLE_CHANCE` ajouté au catalogue (meilleur canal mesuré).
- [x] **Catalogue d'abonnement réaligné sur la mesure.** Il proposait sept
      canaux à égalité visuelle alors que cinq sont mesurés perdants — le même
      défaut qu'Investir avec ses 18 onglets. `/subscriptions/catalog` renvoie
      désormais le ROI shrinké et un `tier` **calculé** (`BACKED` / `WATCH`)
      par source ; le formulaire les groupe et affiche le ROI à côté de chaque
      canal. Rien n'est masqué : on refuse seulement de présenter comme
      équivalent ce qui ne l'est pas.
- [x] **`CHANNEL_SAFE` retiré** des sources proposables (`retired: true`) —
      pas pour son ROI mais parce que 95% de ses sélections sont des doublons
      exacts de Phase 1 : s'y abonner, c'est suivre un sous-ensemble d'un
      autre canal en croyant en suivre un nouveau. Les abonnements existants
      continuent de tourner.
- [x] **Badge « Observation » retiré de Decisions.** Il marquait 4 canaux
      (CORRECT_SCORE, CLEAN_SHEET, TEAM_TOTAL, WIN_EITHER_HALF) comme « pas
      encore de edge backtesté » — écrit avant que ces canaux produisent des
      décisions réglées. Ils sont désormais tous mesurés, et la liste figée de
      4 noms laissait entendre que les 21 autres étaient validés : le même
      défaut que `NEGATIVE_ROI_CHANNELS`.
- [x] **`SLIPPABLE` remplacé par `META_CHANNELS`** (liste positive → liste
      d'exclusion). L'ancienne liste de 6 canaux privait DOUBLE_CHANCE de
      bouton « ajouter au coupon » dans Decisions alors que c'est le canal le
      mieux mesuré et qu'Investir le propose déjà. Une liste de canaux
      « autorisés » se périme à chaque canal ajouté ; une liste de méta-canaux,
      non.
- [x] **Deux libellés faux corrigés côté web**, qui avaient dérivé parce que
      le front duplique les libellés du backend en i18n au lieu de les lire :
      « Coupon (meilleur du jour) » — le rang 1 ne fait pas mieux que les
      suivants, mesuré — et « Coupon (chaque coupon généré) » — borné à la
      classe à cote courte depuis les classes de coupon, donc l'abonné lisait
      « tous » et recevait une classe sur trois.

**Reste ouvert**

- [ ] **VALUE réduit à ses picks propres** — les 8% de sélections qui ne sont
      pas des doublons de Phase 1 font +14.1% (n=173, t≈1.4). C'est la seule
      piste du système où une couche de sélection *ajoute*. **À valider au
      niveau jambe avant de shipper** ; SAFE n'a pas cette excuse (29 picks
      propres, −19.7%).
- [ ] **Mouvement des cotes** — 16 615 matchs suivis sur ~15h en moyenne,
      jamais exploités. Seule piste de découverte que l'audit laisse ouverte,
      et la seule entrée *causale* plutôt qu'un historique découpé.

Migration Prisma : `20260822120000_add_double_chance_subscription_source`.

---

### Bloc 12 — Reconstruction du composeur de coupon (2026-08-20 → 22, branche `fix/todo-2026-08-15`)

> Point de départ : ROI négatif dans toutes les configurations testées (-9% à
> -29%), révélé une fois `deleteExpiredInRange` corrigé. Le plan de recherche
> initial (Deflated Sharpe, James-Stein, parlays corrélés, dérive) a été
> exécuté puis **largement invalidé par la mesure** — détail par piste dans
> `apps/backend/src/modules/coupon/recherche.md` §"Résultats du 2026-08-22".

**Résultat mesuré** (5 passes de régénération, 2025-01 → 2026-08) :

- [x] **Calibration par jambe : ratio réalisé/annoncé 0.819 → 1.016** (n=7076).
      Le modèle n'exagère plus ses jambes, dans aucun sens. C'est l'acquis.
- [x] ROI coupon **-3.34% ± 4.32** (n=2844, t=-0.77) — indistinguable de zéro,
      contre -9.7% au départ. Ce n'est pas un profit.

**Ce qui a été corrigé**

- [x] **Le pool était aveugle à 21 canaux sur 25.** Il lisait `run.bets`, que
      `persistChannelBet` n'écrit que pour VALUE/SAFE. `CalibrationService`
      lisait la même table : trois marchés sur six n'atteignaient jamais
      `MIN_BET_COUNT` et BTTS était corrigé **dans le mauvais sens**. Les deux
      lisent désormais `channel_selection`, tous canaux.
- [x] **Six signaux de sélection retirés**, morts ou anti-prédictifs, chacun
      avec sa mesure conservée dans le code : tri par EV du coupon,
      `signalScore` et la fenêtre glissante de 38 jours, l'edge revendiqué, la
      qualité par (canal, tranche) et par (ligue, canal, tranche), l'ajustement
      conditionné à la sélection, la pénalité de sélection uniforme.
- [x] **CONSENSUS n'émet plus de pick** — ses 765 sélections étaient des
      doublons exacts d'un pick Phase 1, et `maxProbability` (max de k
      estimations bruitées) expliquait à lui seul son ratio de 0.726 contre
      0.918 pour DOMINANT qu'il agrège.
- [x] **Profils supprimés**, remplacés par trois **classes** différenciées par
      la bande de cote de leurs jambes — bandes disjointes, donc produits
      réellement distincts : cote 1.94 / 5.39 / 12.26 et taux de réussite
      49.1% / 19.8% / 9.0%.
- [x] **DNB sur match nul bloquait le règlement** : `resolveIsCorrect` rendait
      `null` aussi bien pour un remboursement que pour « pas encore
      calculable », et l'appelant lisait `null` comme non résolu. Le coupon ne
      se réglait jamais.
- [x] **Déphasage abonnements** créé par les classes : `COUPON_BEST` lisait
      `rank = 1`, devenu ambigu (3 lignes par date) ; `COUPON_ALL` serait passé
      de 3 à 9 coupons/jour, triplant l'exposition d'un abonné existant.

**La leçon de méthode, qui vaut plus que les correctifs**

- [x] **Le ROI de coupon n'a aucune puissance statistique.** SD 1.821, 3
      coupons/jour ⇒ ~2,5 ans pour détecter 10 points, 2 points jamais. Les
      décisions de la session du 19/20 portaient sur des écarts de 10-30 points
      dont la SE valait 13-18. **La boucle d'apprentissage doit tourner au
      niveau jambe** (SD 1.247, ~7000/mois, 2 points en ~4 mois).

**Reste ouvert** — voir [TODO.md](TODO.md) §"Générateur de coupon" : mouvement
des cotes (seule piste de découverte crédible), meilleure cote étendue au
moteur, abonnements par classe, sélecteur de classe côté UX.

Aucune migration Prisma.

---

### Bloc 11 — Corrections audit systémique : résolution bookmaker par ligne, garde-fous 1X2-only (2026-08-15, branche `fix/systemic-audit-market-guards`)

> Reprise du reste de l'audit systémique du Bloc 10 (post-mortem
> Nordsjaelland–Valur, [TODO.md](TODO.md) section "Audit systémique
> 2026-08-13"), laissé de côté de la PR "sûrs uniquement" du 2026-08-13 car
> ces deux-là touchent directement à quelles cotes/picks atteignent
> `evaluatedPicks` — corrigés en premier dans ce chantier plus large.

- [x] **`under_high_lambda` généralisé à tout pick `UNDER_*`** —
      `getPickRejectionReason()` (`pick-validation.ts`) ne rejetait que le
      pick littéral `"UNDER"` (ligne 2,5) quand `lambdaTotal ≥ 2.3` ;
      `UNDER_3_5`/`UNDER_4_5`/`UNDER_1_5` n'entraient jamais dans cette
      branche (confirmé : Nordsjaelland–Valur avait `lambdaTotal≈3.74` sur
      `UNDER_3_5`, jamais rejeté). Seuil λ laissé inchangé — une
      recalibration par ligne reste une piste séparée.
- [x] **Résolution du bookmaker OVER_UNDER par ligne au lieu de par marché
      entier** — cause racine confirmée du trou Nordsjaelland–Valur : un
      seul bookmaker était choisi pour tout le marché (dernier snapshot +
      meilleur rang), et une ligne qu'il n'avait pas cotée à cet instant
      disparaissait silencieusement même si un autre bookmaker l'avait
      cotée. `resolveOverUnderOddsPerLine`/`findOverUnderOddsPerLine`
      (`odds-snapshot.loader.ts`) résolvent maintenant le meilleur
      bookmaker indépendamment par ligne (8 picks), sur les deux chemins
      (batché et single-fixture). Tests de régression reproduisant le
      scénario exact ajoutés dans `odds-snapshot.loader.spec.ts`. (Les deux
      "reste ouvert" notés ici initialement — généraliser à d'autres marchés,
      étendre `calibration_alert` à OVER_UNDER — ont été traités plus tard
      dans ce même Bloc, voir plus bas.)
- [x] **Seuil de probabilité DRAW jamais appliqué en 1X2 — branche ajoutée**
      — `getPickRejectionReason` ne testait `minDirectionProbability` que
      pour HOME/AWAY. Branche `DRAW` ajoutée (teste `probabilities.draw`),
      mais avec un défaut app-side **délibérément distinct** de HOME/AWAY :
      `MIN_DRAW_DIRECTION_PROBABILITY = 0.40` (= plancher générique déjà
      appliqué à tous les picks) plutôt que réutiliser le défaut HOME/AWAY
      (0.45), qui aurait quasiment suspendu le canal DRAW entier du jour au
      lendemain sans aucun backtest — comportement volontairement inchangé
      aujourd'hui, seul le hook de calibration par ligue est maintenant
      câblé pour `ONE_X_TWO|DRAW`.
- [x] **`htftCalibrated` étendu à `OVER_UNDER_HT`** — dérive de la même
      décomposition mi-temps que `HALF_TIME_FULL_TIME`/`FIRST_HALF_WINNER`
      (même risque de surestimation Poisson bivariée en ligue non
      calibrée) mais n'était jamais vérifié contre ce garde-fou. Extension
      dans le sens "plus prudent" uniquement (suspend davantage, n'autorise
      jamais rien de nouveau) — pas de backtest requis avant merge,
      contrairement à un changement de seuil.
- [x] **Pénalité longshot étendue au-delà du 1X2 — étude dédiée + activation
      partielle (2026-08-15)** — `getOneXTwoLongshotPenalty` renommée
      `getLongshotPenalty`. Nouveau script
      `db:backtest:longshot-penalty-odds-buckets` (~24 500 fixtures, cotes
      bookmaker réelles + proba Poisson brute rejouée, par tranche de cote)
      sur `RESULT_TOTAL_GOALS`/`RESULT_BTTS`/`HALF_TIME_FULL_TIME`/
      `FIRST_HALF_WINNER`/`OVER_UNDER` (ligne 4.5) :
  - [x] **`RESULT_TOTAL_GOALS`** : signal le plus net — EV annoncée +26% sur
        15+ vs ROI réel -21.6% (motif "fausse valeur" identique au 1X2).
        Pénalité activée (seuil 5.0, plancher 0.12).
  - [x] **`HALF_TIME_FULL_TIME`** : ROI simulé en déclin monotone (-3.5% →
        -32% de <2.0 à 15+). Pénalité activée (seuil 5.0, plancher 0.15).
  - [ ] **`RESULT_BTTS`/`FIRST_HALF_WINNER`/`OVER_UNDER` (ligne 4.5)** :
        même direction de signal mais trop bruité aux cotes longues (n<300,
        tranche 15+ parfois positive des deux côtés) — laissés sans
        pénalité, à revisiter avec plus de données.
  - Pénalité appliquée uniformément par cote (pas par pick AWAY/DRAW comme
    en 1X2) — ces marchés n'ont pas de "côté outsider" unique.
- [x] **Shrinkage O/U étendu à `TEAM_TOTAL_HOME/AWAY` — backtest exécuté,
      config activée (2026-08-15)** — `TEAM_TOTAL_AWAY UNDER_1_5` est le
      candidat confirmé en DB (Bloc 10 : ROI réel +0,75% malgré un EV affiché
      +22,4%, même motif de surconfiance que l'O/U). Mécanisme câblé
      (`teamTotalHome`/`teamTotalAway` sur `OverUnderShrinkageConfig`, sparse
      par ligne 0.5–4.5, même forme que `ouHt` ; `factor`/`baseRates` rendus
      optionnels pour permettre une ligue sans couverture O/U plein temps).
      **Backtest walk-forward exécuté contre la DB locale** (sync prod du jour,
      16h48) avec le nouveau script `db:backtest:team-total-shrinkage-calibration`
      — même protocole que l'O/U original (train = toutes saisons sauf la plus
      récente par ligue, test = la plus récente, seuil de livraison : ΔBrier
      tenu-à-l'écart ≥ 0.001). 47 258 fixtures rejouées (TeamStats point-in-time),
      **178 blocs livrés sur 49 ligues** — 27 fusionnées dans des entrées
      `OU_SHRINKAGE_CONFIG` existantes, 22 nouvelles ligues (ARG1/ARG2/AUS1/
      AUT1/BEL1/BRA2/CH/CHI1/CHI2/CHN2/D3/DEN1/FIN2/GRE1/IRL1/KOR2/KSA1/LL/
      POL2/RUS1/SCO1/USA2) sans couverture O/U plein temps. Rapport complet :
      `packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt`.
  - [x] **Garde-fou paris réels réglés — inconclusif, pas bloquant** :
        seulement 69 paris `TEAM_TOTAL_*` réglés tombent sur une ligne
        désormais couverte (152 réglés au total) — trop peu pour trancher
        dans un sens ou l'autre (le guard O/U original portait sur 910
        paris). Les deux groupes testés restent négatifs, cohérent avec le
        motif de surconfiance déjà documenté. La preuve porteuse reste le
        Brier walk-forward sur 47k fixtures rejouées, pas ce guard.
  - [x] **Activé, plus un no-op** : TEAM_TOTAL_HOME/AWAY seront réellement
        shrinkés en prod sur les 49 ligues listées une fois cette branche
        mergée.
  - [x] **`RESULT_TOTAL_GOALS` traité séparément, plus tard le même jour** —
        son complément Over/Under n'est pas `1 − under` comme O/U/TEAM_TOTAL
        (`over(side) = oneXTwo[side] − under(side)`, masse jointe du côté),
        donc le mécanisme sparse ne s'appliquait pas tel quel : nouvelle
        fonction `shrinkResultTotalGoals` dédiée (`ou-shrinkage.ts`) qui
        shrink la proba jointe `UNDER` puis recalcule `OVER` par rapport à la
        masse du côté (même logique que `rebalanceThreeWayProbabilities`).
        Nouveau script `db:backtest:result-total-goals-shrinkage-calibration`,
        même protocole walk-forward — **171 blocs livrés sur 41 ligues**,
        toutes déjà présentes dans `OU_SHRINKAGE_CONFIG` (fusion pure, aucune
        nouvelle entrée de ligue). Activé, plus un no-op.
- [x] **Bookmaker par ligne généralisé à tous les marchés à picks
      indépendants** — le jumeau non-batché de `pickBestBookmaker`
      (`findBestBookmakerForMarket`) avait le même bug "marché entier". Au
      lieu de ne réparer que son instance OVER_UNDER, généralisé
      (`resolvePerPickOddsPerLine`/`findPerPickOddsPerLine`) à
      `TEAM_TOTAL_HOME/AWAY`, `RESULT_TOTAL_GOALS`, `RESULT_BTTS`,
      `CORRECT_SCORE`, `OVER_UNDER_HT` sur les deux chemins (batché et
      single-fixture) — volontairement **pas** appliqué aux marchés à
      événement unique cohérent (ONE_X_TWO, First-Half Winner, Double
      Chance, HT/FT) où mélanger les bookmakers recréerait le risque de
      triplet fabriqué ci-dessous.
- [x] **`findLatestBestOneXTwoOddsSnapshot` ne fabrique plus de cohérence
      1X2 inexistante — impact réel confirmé** — construisait un faux
      bookmaker `'MarketBest'` en maximisant home/draw/away indépendamment
      à travers différents bookmakers, avec un overround plus bas
      qu'aucun bookmaker réel n'offre. Vérifié : `analyzeFriFixture`
      (canal FRI) utilise ce triplet directement pour calculer l'EV de
      chaque pick — un overround fabriqué gonflait donc l'EV de tout le
      canal simultanément. Corrigé pour sélectionner le vrai bookmaker au
      plus bas overround parmi ceux avec un triplet complet, au lieu de
      fabriquer un mix.
- [x] **`calibration_alert` étendu à OVER_UNDER — étude dédiée + activation
      (2026-08-15)** — le gate de cohérence modèle↔marché ne couvrait que le
      1X2 ; le post-mortem du 13-14/08 avait trouvé un écart de +19pp sur
      une jambe Under 3.5 sans aucun garde-fou pour la voir. Nouveau script
      `db:backtest:calibration-alert-over-under` (408 paris OVER_UNDER
      réels réglés, `probEstimated` vs médiane implicite bookmaker) :
      pas assez de volume pour calibrer un seuil `extreme_divergence`
      autonome (n=10 au-delà de 0.30), mais `favorite_flip` à divergence
      ≥ 0.10 est un signal net contrôlé pour le confondant "proche de
      50/50" — taux de réussite 37,0% (n=46, ROI -12,2%) contre une base
      ~65-71% ; sous ce seuil un "flip" n'est que du bruit (n=27, ROI
      +5,8%). `assessOverUnderMarketCoherence` activé (`favorite_flip`
      seul, `FAVORITE_FLIP_MIN_GAP=0.10`), vérifié indépendamment sur les 4
      lignes (1.5/2.5/3.5/4.5 — l'incident d'origine était sur 3.5, pas
      2.5), nouvel accesseur `findLatestOverUnderOddsPerBookmaker` (résolu
      par ligne, même discipline que le fix bookmaker plus haut), stocké
      dans `calibration_alert_over_under` et branché sur la même exclusion
      coupon que le gate 1X2.
- **Audit systémique 2026-08-13 : statut final** — **entièrement trié et
  clos**. Chaque motif de bug trouvé est corrigé, activé après backtest, ou
  explicitement reporté (jamais oublié) ; détail complet dans
  [TODO.md](TODO.md). Tous les items "backtest à faire" ont été mesurés (DB
  locale, sync prod 2026-08-15 16h48) et activés : shrinkage `TEAM_TOTAL`,
  shrinkage `RESULT_TOTAL_GOALS`, pénalité longshot
  (`RESULT_TOTAL_GOALS`/`HALF_TIME_FULL_TIME`), `calibration_alert` sur
  OVER_UNDER (`favorite_flip`). Restent différés par décision documentée
  (signal trop bruité ou volume insuffisant, jamais par oubli) : pénalité
  longshot sur RESULT_BTTS/FIRST_HALF_WINNER/OVER_UNDER 4.5, seuil
  `extreme_divergence` pour OVER_UNDER.
  - [ ] **Limite connue sur les deux items activés cette session (pénalité
        longshot, `calibration_alert` O/U) : seuils globaux, pas par
        ligue** — contrairement au shrinkage (per-league). Vérifié après
        coup sur RESULT_TOTAL_GOALS 15+ (n=265) : le signal est réparti sur
        ~18 ligues, pas porté par une seule (un seuil global n'est donc pas
        un artefact), mais ARG1 (n=67, ROI -20.9%) et ARG2 (n=60, ROI
        +1.7%) divergent nettement à volume comparable — indice d'une vraie
        hétérogénéité par ligue qu'on ne peut pas calibrer ici (volume par
        ligue à cote longue : 3 à 67 paris, trop faible). Cohérent avec le
        gate 1X2 existant (également global), donc pas une régression — à
        revisiter avec plus de volume, voir TODO.md.
- 855 tests backend (+27 vs Bloc 10), 104 tests `analysis-core` (+6),
  typecheck et lint (`--max-warnings 0`) propres sur backend et
  `analysis-core`.

---

### Web UI

- [x] Page 404 (`not-found.tsx`) — layout centré, animation CSS, tokens bento

---

## Phase 3 — ML & Scalabilité (après stabilisation Phase 2)

> Objectif : transformer EVCore en système circulant — les résultats réels alimentent l'entraînement,
> qui améliore les prédictions, qui génère de meilleurs picks.
> Architecture : Python worker dans le Docker Compose existant, communication via BullMQ/Redis et PostgreSQL.
> NestJS reste l'autorité — Python entraîne et calibre, NestJS décide.

Docs de cadrage Phase 3:

- [docs/phase3-ml-correction-layer.md](docs/phase3-ml-correction-layer.md) — rôle du ML comme couche de correction au-dessus du Poisson
- [docs/phase3-go-watch-no-go.md](docs/phase3-go-watch-no-go.md) — lecture décisionnelle `GO / WATCH / NO-GO` par `canal × marché`
- [packages/db/reports/edge-vs-pinnacle-2026-06-04.md](packages/db/reports/edge-vs-pinnacle-2026-06-04.md) — premier rapport `edge vs Pinnacle`

### Préconditions DB ✅ (4 juin 2026)

- [x] PgBouncer `v1.25.1-p0` dans Docker Compose dev + prod (`PGBOUNCER_URL` runtime / `DATABASE_URL` migrations)
- [-] Partitionnement `OddsSnapshot` — différé (421k lignes, indexes suffisants ; reconsidérer à 1M+)
- [x] Index `ModelRun.analyzedAt` — scans temporels dataset ML
- [x] Table `ml_model_version` — migration `20260604174057_phase3_ml_model_version`
- [x] Politique `ModelRun` jamais supprimée — documentée dans le schéma

### Bloc A — Étude OddsSnapshot ✅ (4 juin 2026)

- [x] Comparer probabilités moteur vs probabilité implicite Pinnacle — 680 picks analysés
- [x] Edge moyen par canal : `SV` GO (+5.17% / +17.16%), `EV/ONE_X_TWO` NO-GO (-54.86%), `CONF` WATCH
- [x] Matrice GO / WATCH / NO-GO par `canal × marché` — voir `docs/phase3-go-watch-no-go.md`
- [x] Rapport → `packages/db/reports/edge-vs-pinnacle-2026-06-04.md`

### Bloc B — Infrastructure ML ✅ (juin 2026 — détail dans `docs/phase3-ml-todo.md` étapes 3–7bis)

- [x] Service `ml-worker` Python dans Docker Compose (image `python:3.12-slim`, accès Redis + PostgreSQL)
- [x] Queue BullMQ `ml-training` — NestJS pousse le job, Python consomme
- [x] `MlController` NestJS : `POST /ml/train`, `GET /ml/models/active`, activate/rollback/delete
- [x] Script Python `train.py` : lit `ModelRun` + outcomes depuis PostgreSQL, entraîne, sérialise en base
- [x] Suite de tests pytest ml-worker + job CI (étape 7bis)
- [ ] Upgrade VPS OVH si besoin (≥ 4 vCPU / 8 GB RAM) avant premier entraînement prod

### Bloc C — Correction layer XGBoost + Calibration ✅ (juin 2026 — détail dans `docs/phase3-ml-todo.md` étapes 4–7)

> Architecture retenue (voir `docs/phase3-ml-correction-layer.md`) : le modèle apprend
> **où le Poisson se trompe** (cible `outcome_correct` sur les lignes avec cote Pinnacle) et
> produit une probabilité corrigée. Il ne remplace pas Poisson — il le calibre. La correction
> est servie en **shadow mode** via le serveur d'inférence (pas de chargement de poids au démarrage).

- [x] Feature extraction : form, xG, H/A, volatilité + delta_p Pinnacle (depuis `OddsSnapshot`)
- [x] Entraînement (LogReg < 200 samples, XGBoost au-delà) — `auto` par segment
- [x] Calibration scikit-learn (isotonic, `CalibratedClassifierCV`) — corriger le biais des probabilités
- [x] Modèle sérialisé + métriques écrites en `ml_model_version` (Brier, Calibration Error, ROI shadow)
- [x] `BettingEngineService` consomme la correction en **shadow mode** (étape 6 — loggée, n'agit pas encore)
- [x] Basculement automatique si Brier amélioré ≥ 5% + cooldown 7 jours
- [x] Rollback manuel via `POST /ml/models/:id/rollback`
- [x] Job BullMQ hebdomadaire — ré-entraînement si ≥ 50 nouveaux bets settled
- [ ] **Promotion hors shadow** (décision par segment, voir `docs/phase3-ml-todo.md` étape 7ter) — LA SUITE

### Bloc D — Gestion dynamique du drawdown

- [ ] Ajustement de la fraction Kelly selon la trajectoire du drawdown en cours
- [ ] Réduction progressive des mises si drawdown > 8% (paliers : 75% → 50% → 25% Kelly)
- [ ] Reprise automatique au niveau normal après retour au-dessus du seuil sur 20 bets consécutifs

### Bloc E — Monte Carlo (diagnostic, optionnel)

- [ ] Simulation 10 000 saisons fictives depuis les probabilités calibrées
- [ ] Calcul intervalles de confiance ROI — distinguer malchance structurelle vs dérive du modèle
- [ ] Utilisé uniquement comme outil de diagnostic, pas dans la décision de betting

---

## Refactor Domaine — Architecture des canaux de stratégie ✅ fait (corrigé le 2026-08-15)

> Cadrage : [docs/channel-strategy-architecture.md](docs/channel-strategy-architecture.md)
> · Suites/canaux restants : [TODO.md](TODO.md)
>
> Toute la checklist ci-dessous était encore marquée `[ ]` alors que le
> refactor est en production depuis des semaines (`channel-decision.service.ts`
> est le chemin live utilisé par le betting engine, le settlement, les
> abonnements et l'investissement) — jamais mis à jour après coup. Vérifié
> le 2026-08-15 :

- [x] Cadrage & gel du design — `StrategyChannel` v1 figé (19 valeurs,
      `packages/db/prisma/schema.prisma`), `ChannelDecision` 1-ModelRun-à-N
- [x] Contrat & registre de stratégies — une stratégie par canal
      (`packages/analysis-core/src/strategies/*.strategy.ts`) + orchestrateur
- [x] Migration schéma — `channel_decision`/`channel_selection` +
      `Bet.channelSelectionId` en place
- [x] Backfill idempotent — `@@unique([channelDecisionId, rank])` +
      `backfill-selection-odds.ts`
- [x] Bascule des consommateurs — engine, settlement, abonnements,
      investissement et frontend (`apps/web/domains/channel-decision`)
      consomment tous les nouvelles tables
- [x] Suppression du legacy — `Prediction`/`PredictionChannel`/
      `CouponLegCanal`/`Bet.isSafeValue`/`ModelRun.decision` supprimés
      (migrations `20260618005222_remove_legacy`,
      `20260618010535_remove_is_safe_value`), zéro référence restante
- [~] Gate de vérification (parité ancien/nouveau) — probablement fait avant
  le DROP legacy (cohérent avec la règle "jamais avant gate vert") mais
  aucun artefact de réconciliation formel retrouvé dans le code
- [~] Nouveaux canaux phasés — la plupart existent déjà et ont une stratégie
  (`GOALS`, `CONSENSUS`, `AVOID`, `UNDERDOG`, `FAVORITE`, `MARKET_MOVE`,
  `FIRST_HALF`, `LIVE_VALUE`) ; seul `BB` côté `NO` (BTTS NO) reste en
  observation avant activation — voir TODO.md
- [x] **Coquilles de ré-export nettoyées (2026-08-18)** — 23 fichiers dans
      `apps/backend/.../betting-engine/strategies/` ne faisaient que
      ré-exporter `@evcore/analysis-core` (reliquat de l'extraction jamais
      nettoyé) ; audit : zéro consommateur de prod dans ce dossier, seuls leurs
      propres `.spec.ts` colocalisés les importaient — violant "tests
      colocalisés avec la source" (CLAUDE.md), puisque la vraie source vit dans
      `analysis-core`. Les 22 `.spec.ts` déménagés vers
      `packages/analysis-core/src/strategies/` (+ `selection-odds.spec.ts` →
      `packages/analysis-core/src/selection/odds.spec.ts`), les 23 coquilles
      supprimées. 8 vrais consommateurs de prod trouvés hors de ce dossier
      (`apps/backend/src/modules/backtest/*`, `coupon/signal-window.service.ts`,
      `betting-engine/channel-decision.service.ts`,
      `scripts/backfill-selection-odds.ts`) — repointés directement vers
      `@evcore/analysis-core`. `strategy-context.builder.ts` (vraie logique
      app-side, pas une coquille) reste en place. Suite analysis-core
      356/357 verte (même échec préexistant sans rapport), backend 736/736
      verte, monorepo entier vert.

---

## Refactor Domaine — Familles de moteurs prédictifs (cadrage 2026-08-17, VALUE/SAFE fait le 08-18)

> Cadrage : [docs/prediction-engine-families.md](docs/prediction-engine-families.md)
> (§0, portée football actuelle) · orchestration mise à jour en conséquence
> dans [docs/channel-strategy-architecture.md](docs/channel-strategy-architecture.md)
> (§5, §6.1, §11).
>
> Constat qui a déclenché ce refactor : `EV`/`SAFE` ne filtraient pas les
> meilleures prédictions déjà validées par les 18 autres canaux — ils
> re-scannaient tout `evaluatedMarkets` en parallèle, indépendamment des
> canaux de marché. **Corrigé le 08-18** (voir item ci-dessous).
>
> **Famille A' — reportée, pas abandonnée par manque d'intérêt mais parce
> que l'évidence ne la justifie pas encore** (2026-08-17) : le backtest
> walk-forward déjà existant sur OVER_UNDER_HT
> (`backtest-over-under-ht-shrinkage-calibration-2026-08-16.txt`) montre que
> le Poisson brut basé sur `FIRST_HALF_GOAL_FRACTION = 0.44` est **déjà bien
> calibré** sur 6 des 7 ligues où le canal a le droit de tourner (ΔBrier
> ≈ 0.0000). L'hypothèse initiale ("0.44 cause probable du HT Over
> désactivé") ne tient pas pour les ligues domestiques — le vrai contexte du
> HT Over désactivé est la Coupe du Monde/sélections nationales, où le
> volume est structurellement insuffisant pour calibrer par cette méthode
> (WC : train=4, test=8). Pas de chantier de calibration lancé sans
> évidence — voir TODO.md.

- [-] **Famille A'** — reportée (voir constat ci-dessus), pas de biais
  démontré à corriger sur les ligues où ça compte
- [x] **VALUE/SAFE en Phase 2** (2026-08-18) — orchestrateur à 3 phases
      (`FILTER_STRATEGY_CHANNELS` nouveau, décisions accumulées sur les 3
      phases au lieu d'un snapshot figé pour la Phase 2 méta) :
      Phase 1 = 16 canaux de marché → Phase 2 = VALUE/SAFE (filtrent les
      décisions Phase 1 via `viablePicksFromPreviousDecisions`, plus de
      scan de `evaluatedMarkets`) → Phase 3 = CONSENSUS/AVOID (inchangé,
      voit maintenant VALUE/SAFE via la map accumulée). `context.
evaluatedMarkets` n'est plus lu par aucun canal — candidat à
      suppression (TODO.md). Simplification assumée : l'exception SAFE
      "comparaison OVER/UNDER symétrique à haut lambda" (avait besoin de
      plusieurs lignes O/U simultanées, incompatible avec "un pick par
      canal de marché") a été retirée plutôt que bricolée — à revoir
      pendant l'audit de calibration si son absence coûte du ROI. Suite
      backend 957/957 verte, monorepo entier vert.
- [ ] **Audit de calibration par (marché × ligue)** — une fois les deux
      chantiers ci-dessus faits, établir lesquels des 16 canaux de marché
      méritent réellement d'alimenter VALUE/SAFE

---

## Harnais de backtest partagé (cadrage + démarré 2026-08-17, non fini)

> Cadrage : [docs/backtest-harness-architecture.md](docs/backtest-harness-architecture.md).
> Déclenché par le même chantier que les familles ci-dessus : 27 scripts
> `packages/db/scripts/backtest-*.ts` (11 338 lignes), aucun harnais
> partagé — 17 rejouent le pipeline chacun à sa façon, 10 lisent Prisma
> directement (même risque que `project_channel_whitelist_replay_gap`,
> jamais audité sur les 9 autres).

- [x] Bug trouvé et corrigé : `OddsSnapshotLoader.findLatestOddsSnapshot`
      n'appliquait `cutoff` qu'au marché `ONE_X_TWO` — 16 marchés sur 17
      retournaient toujours la cote la plus récente en base, cutoff ignoré
      (impactait déjà le filtre de mouvement de cote en prod). Fix +
      régression test, suite backend 956/956 verte (voir TODO.md "Bugs &
      dette technique")
- [x] Extraction `assembleFullOddsSnapshot` et dépendances pures
      (`apps/backend/.../odds-snapshot.loader.ts` →
      `packages/analysis-core/src/pricing/odds-assembly.ts`) — une seule
      implémentation partagée par la prod et le futur harnais, plus de
      copie qui pouvait diverger silencieusement
- [x] `packages/backtest-core` — scaffold + garde-fou d'architecture testé
      (seul `point-in-time-loader.ts` a le droit d'importer `@evcore/db`)
- [x] `point-in-time-loader.ts` — cotes (`loadOdds`/`loadOddsBatch`, via
      `assembleFullOddsSnapshot`) + énumération fixtures (`listFixtures`,
      chronologique, `FINISHED` uniquement, respecte
      `Competition.includeInBacktest`)
- [x] `replay-engine.ts` — boucle chronologique (générateur async, un
      `PointInTimeContext` propre par fixture)
- [x] `PointInTimeLoader.loadTeamStats` — politique de repli
      cross-compétition (Europe/sélections nationales/rollover domestique)
      extraite en fonction pure `resolveEffectiveTeamStats`
      (`packages/analysis-core/src/probability/team-stats-resolution.ts`) ;
      `ev.constants.ts` ré-exporte au lieu de dupliquer
- [x] `PointInTimeLoader.loadH2HLegs`/`loadH2HScore`/`loadH2HMarketSignals`/
      `loadH2HScorelineSignal` — calcul pur extrait
      (`packages/analysis-core/src/probability/h2h.ts`), `H2HService`
      devient un pur appelant Prisma
- [x] `PointInTimeLoader.loadCongestionScore` — calcul pur extrait
      (`packages/analysis-core/src/probability/congestion.ts`),
      `CongestionService` devient un pur appelant Prisma
- [ ] Elo FRI (`fri-model.service.ts`/`fri-model.utils.ts`, canal FRI) — pas
      encore extrait, même patron déjà applicable (utils déjà purs avec
      leurs propres tests) ; reporté, canal de niche (V1 `ONE_X_TWO`
      uniquement), voir TODO.md
- [x] `backtest-runner.ts` — façade CLI (`BacktestRunner`, assemble cotes +
      team stats + H2H + congestion par fixture)
- [x] Premier script réel — `packages/backtest-core/scripts/coverage-check.ts`
      (contrôle de couverture des données point-in-time). **Correction** :
      les scripts consommant `backtest-core` vivent dans
      `packages/backtest-core/scripts/`, pas `packages/db/scripts/` —
      `@evcore/backtest-core` dépend déjà de `@evcore/db`, donc l'inverse
      créerait un cycle de dépendance de package (trouvé en écrivant ce
      script). Voir docs/backtest-harness-architecture.md §6.
- [ ] Migration des 27 scripts existants vers le harnais, en commençant par
      les 10 identifiés à risque
- [ ] Composition finale : `deriveLambdas` + détermination du côté favori
      (aujourd'hui inline dans `BettingEngineService.analyzeFixture`, pas
      extraite) pour transformer les inputs assemblés par `BacktestRunner`
      (cotes, team stats, H2H, congestion) en la probabilité/λ que le
      moteur live aurait réellement produite — `BacktestRunner` fournit les
      inputs point-in-time, pas encore la prédiction finale

---

## Phase 4

> **EVA** (Expected Value Analyst) — d'abord construite (2026-06) comme assistant
> conversationnel (function calling Groq, 18 tools, SSE, conversations persistées en DB,
> `/dashboard/chat`), puis **entièrement remplacée** le 2026-07-02 par un flow plus simple :
> module `analysis-sheet` — fiche d'analyse compacte sur une plage de dates (SQL raw, `json_agg`,
> une ligne par pick retenu + rejets en résumé, historique de ligne de mouvement sur les
> réanalyses rolling-horizon), exportable `.txt`/`.json`, et un bouton **"Analyser avec Eva"**
> qui envoie la fiche à Groq en un seul appel (pas de tool-calling, pas de streaming SSE) et
> retourne une analyse de cohérence + picks proposés. UI : `/dashboard/analysis-sheet`.
> Le module `chat` (contrôleur, tools, boucle d'orchestration, `chat.pick-engine`/ladder — redondant
> avec le module coupon autonome) a été supprimé ; seuls le client Groq et le modèle `ChatUsage`
> (rate-limit quotidien) ont survécu, réutilisés tels quels. Tables `chat_conversation`/`chat_message`
> laissées en place (non écrites, suppression explicite à décider plus tard).

- [x] EVA — Fiche d'analyse + appel Groq single-shot (`apps/backend/src/modules/analysis-sheet/`,
      `apps/web/app/dashboard/analysis-sheet/`)
  - [x] Requête SQL raw (CTE + `json_agg`) par plage de dates, filtres compétition/canal
  - [x] Export `.txt`/`.json`, bouton "Analyser avec Eva" (Groq, sans tool-calling)
  - [x] Dédup + historique des passes rolling-horizon (ADVANCE/PRE_KICKOFF/LIVE) pour repérer
        le line movement
  - [ ] Durcissement sécurité + golden set (adversarial, injection par données) — pas encore fait
        pour le nouveau flow single-shot
- [ ] SaaS / multi-tenant
- [ ] API interne
- [ ] Groupe premium

---

## Au-delà — Extension multi-sport (différé, non planifié)

> Cadrage : [docs/multi-sport-extension.md](docs/multi-sport-extension.md),
> nuancé par [docs/prediction-engine-families.md](docs/prediction-engine-families.md)
> §1 : pas « un socle par sport » mais **un moteur par famille de processus
> générateur**, réutilisé par tous les sports qui la partagent (ex. basket et
> foot US partageraient une famille marge/total, tennis et volleyball une
> famille hiérarchique point→jeu→set).
>
> Le cœur probabiliste (Poisson) est spécifique au football ; « ajouter un sport »
> = écrire un **second socle** derrière la même colonne stratégie/décision, pas une
> config. Préconditions strictes avant tout code : (1) edge football prouvé — ML
> promu hors shadow + biais top-picks corrigé ; (2) abstraction `sport` dans le
> schéma (Market, ChannelSelection, socle pluggable). Tennis = 1ᵉʳ candidat. Tant
> que les préconditions ne sont pas remplies : **recherche uniquement, pas de code.**

- [-] Tennis (2ᵉ socle) — différé jusqu'aux préconditions ci-dessus
- [-] Basketball / Esports — réévalués seulement après validation du pattern multi-sport

---

## GitHub Milestones

| Milestone         | Contenu                                   | Due date     |
| ----------------- | ----------------------------------------- | ------------ |
| `mvp-foundations` | Setup monorepo, DB, Docker, CI            | 28 fév 2026  |
| `mvp-month-1`     | ETL, stats rolling, modèle, backtest      | 14 mars 2026 |
| `mvp-month-2`     | Odds, EV, simulation, tracking            | 31 mars 2026 |
| `mvp-month-3`     | Automatisation, apprentissage, validation | 8 avr 2026   |
| `phase-2`         | Live, canaux prédiction, déploiement prod | 4 juin 2026  |
| `phase-3`         | ML circulant, XGBoost, scalabilité DB     | TBD          |
