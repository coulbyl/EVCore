# EVCore — Reste à faire : Architecture des canaux de stratégie

> Référence : [docs/channel-strategy-architecture.md](docs/channel-strategy-architecture.md) · [ROADMAP.md](ROADMAP.md)
> Plan ML archivé : [docs/phase3-ml-todo.md](docs/phase3-ml-todo.md)
>
> **Principe directeur** : un canal = une **stratégie de sélection**, pas un marché.
> Aucun nouveau canal n'est activé sans backtest séparé par ligue/marché/saison.
>
> ⚠️ Ce fichier couvre le chantier **canaux de stratégie / calibration
> modèle** ET, depuis le 2026-08-09, le **générateur de coupon**. Le travail
> EVA (chat, persona pro, filter bar) n'y est pas suivi.
>
> Révisé le 2026-08-15 : purge des items terminés (historique complet dans
> [ROADMAP.md](ROADMAP.md), notamment Bloc 9-11) + correction de plusieurs
> items marqués ouverts alors qu'ils étaient déjà résolus (H2H v2, ml-worker
> désync).

## Statut

- `[ ]` À faire
- `[~]` En cours / observation
- `[-]` Abandonné / hors périmètre v1

---

## Générateur de coupon

- `[~]` **LONGSHOT_WEEKEND/MIDWEEK** — généré en vrai chaque weekend/mardi-jeudi,
  badge "Expérimental", jamais staké. Cause du 0 coupon confirmée (audit
  2026-08-12) : `MAX_POOL_SIZE=25` + règle anti-corrélation (1 leg/canal+marché)
  starvent `composeGreedy` avant `minLegs` — non structurel, pas un bug de câblage.
  - `[ ]` Desserrer `MAX_POOL_SIZE`/anti-corrélation spécifiquement pour le
    profil LONGSHOT (pool dédié plus large), sinon le profil reste
    structurellement à 0 coupon.
  - `[ ]` Laisser accumuler des règlements réels avant d'envisager un backtest
    (`composeGreedy` n'a jamais tourné en prod avant le 2026-08-09).
  - `[ ]` Écrire `db:backtest:coupon-longshot` une fois assez de coupons réglés
    — mesurer le hit-rate du coupon complet vs cote, pas juste par jambe.
  - `[ ]` Ne retirer le badge "Expérimental" qu'après un backtest vert
    (split train/valid).

- `[ ]` **`jointProbability` surconfiant** (audit 2026-08-12, 409 `CouponProposal`
  réglés) — bucket ~44% annoncé → 20% réel sur n=30. Le calcul multiplie des
  probabilités par jambe sans corriger la corrélation entre elles (même match,
  même round, même scénario incertain) — cause du coupon manuel perdu du 11/08.
  Corriger le calcul (facteur de corrélation) ou au minimum appliquer le même
  shrinkage bayésien que `calibrate()`.

- `[ ]` **Pondération des signaux leg-level dans `signalScore`** —
  `priorAnalysisCount`, `offensiveBalance`, `shadowConflict` sont exposés mais
  n'influencent rien (`coupon-composer.service.ts:310` : formule limitée à
  `windowRate`/`dowRate`/`leagueRate`). `db:backtest:coupon-quality-signals`
  (2026-08-09) a montré `train n=0` — trop récemment enrichis pour un vrai split.
  Relancer le script périodiquement ; ne pondérer que si train ET valid confirment.

- `[ ]` **FADE (pick inverse sur divergence extrême)** —
  `COUPON_ENFORCE_AVOID_FADE=false`, signal le mieux corroboré du backtest qualité
  (train +18%/valid +20%) mais n=15-17 à peine au-dessus du seuil minimal.
  Revalider avec plus de données avant d'activer.

- `[x]` **DRAW — CSL confirmée, ajoutée à `DRAW_STAKED_LEAGUES`** (résolu
  2026-08-15) — re-lancé `db:backtest:channel-league-whitelist` : CSL a
  désormais un échantillon train (n=82, ROI +26.5%) et valid (n=21, ROI
  +0.1%), les deux positifs, n≥20 — critère d'activation rempli.
  `DRAW_STAKED_LEAGUES` passe de `['I2','POR','BL1']` à `[..., 'CSL']`.
  `FRI`, `KOR1`, `KOR2`, `BRA2`, `WC`, `CHN2` restent à `train n=0` — toujours
  pas assez d'historique, à revisiter plus tard.
  **Réserve méthodologique découverte après coup** (voir
  `feedback_backtest_definition` en mémoire) : ce backtest lit des
  `channel_selection` déjà enregistrées, pas un rejeu du modèle actuel — I2
  0/1035, BL1 0/213, CSL 5/98, POR 5/543 matchs seulement datent d'après le
  changement homeAdvFactor du 07-19. Pas annulé (homeAdvFactor est
  re-confirmé stable sur tout l'historique ET sur une tranche récente tenue
  à l'écart — risque limité), mais à re-vérifier une fois assez de données
  post-07-19 accumulées.

- `[ ]` **Agrégats ROI/summary ignorent silencieusement `PARTIAL`/`VOID`**
  (vérifié 2026-08-15) — `coupon-summary.service.ts`, `coupon-indices.service.ts`
  et `coupon.repository.ts` filtrent uniquement `WON`/`LOST`. Confirmé en DB :
  **0 ligne `PARTIAL`/`VOID` à ce jour** (uniquement 120 WON / 296 LOST / 8
  en attente) — le code de settlement gère bien les deux cas
  (`coupon-settlement.service.ts:206-226`, PARTIAL = tous les legs gradés
  gagnés mais ≥1 leg voidée en route) mais ça n'a encore jamais été déclenché
  en prod. **Piège trouvé en creusant** : `combinedOdds` n'est jamais
  recalculé au settlement — il reste la cote pleine (N legs d'origine) même
  quand des legs sont voidées. Inclure PARTIAL dans le ROI en l'état
  surestimerait le gain réel (le vrai payout se fait sur les legs
  survivantes, à une cote plus basse). Fix complet = recalculer la cote
  réalisée sur les legs non-voidées au moment du settlement, PUIS inclure
  PARTIAL dans les 3 vues avec cette cote corrigée — pas juste élargir les
  filtres `IN (WON, LOST)`. VOID reste correctement exclu (aucun gain,
  aucune perte).

- `[ ]` **Calibration `k`/`decayHalfLifeDays`/`windowDays`** — mesurée
  (`db:backtest:signal-window-calibration`), gain réel mais marginal et pas
  appliqué (compromis réactivité vs stabilité). À reconsidérer seulement si ces
  valeurs semblent un jour concrètement mauvaises en usage.

- `[ ]` **Une même jambe réutilisée entre les coupons classés du même jour fait
  perdre plusieurs coupons d'un coup** (2e occurrence, 2026-08-15) — les rank
  1/2/3 d'un même profil (`forDate`/`signalWindowDays`/`targetOddsMin/Max`)
  peuvent partager une jambe identique ; si elle perd, tous les coupons qui la
  contiennent perdent ensemble. Vu le 2026-08-15 : Chrobry Głogów–Podbeskidzie
  TEAM_TOTAL_HOME OVER_1_5 (VALUE, prob. 76.96% déjà shrinkée POL2, 1-1 réel)
  présente dans rank 1 ET rank 2 (tous deux LOST) ; rank 3 (sans cette jambe)
  WON. Pas un bug de calibration — le shrinkage POL2 HOME 1_5 est validé en
  forward le jour même (`backtest-team-total-shrinkage-calibration-2026-08-15.txt`,
  ΔBrier test=-0.0014, n=261) ; une proba à 77% qui perd une fois sur un essai
  est de la variance normale. Précédent identique documenté dans le code
  (`coupon-composer.service.ts:73-76`, 2026-07-29 : un pick HT à 0.76 perdu
  sur les 3 coupons classés) — corrigé à l'époque par une calibration
  (meanError), pas par une règle empêchant le partage de jambe entre rangs.
  À étudier : faut-il une règle anti-corrélation "pas de jambe partagée entre
  rank 1/2/3 du même profil" dans `composeExhaustive`/`composeGreedy` ?

---

## Canaux en observation (pas encore staking-grade)

- `[~]` **Nouveaux marchés (DNB/TEAM_TOTAL/CLEAN_SHEET/WIN_TO_NIL/
  WIN_EITHER_HALF/RESULT_TOTAL_GOALS/RESULT_BTTS)** — wired dans VALUE/SAFE,
  3 canaux observation-only (`CLEAN_SHEET`, `TEAM_TOTAL`, `WIN_EITHER_HALF`)
  activés. Extension SAFE/VALUE reste bloquée tant que les cotes forward ne
  sont pas accumulées (`CouponChannel` toujours limité à
  `VALUE/SAFE/BTTS/DRAW/DOMINANT/TEAM_TOTAL`) — ne pas activer de pick `AWAY_*`
  sur ces marchés avant, le biais AWAY reste net-négatif même après
  recalibration homeAdvFactor.

- `[x]` **homeAdvFactor/awayDisadvFactor — recalibration re-testée, confirmée
  optimale** (2026-08-15) — `db:backtest:home-advantage` relancé (le script
  avait une valeur "actuelle" périmée en dur, 1.05/0.95 au lieu de 1.00/0.75 ;
  corrigée avant de lancer). Résultat : `1.00/0.75` reste le meilleur candidat
  sur grid-search (Brier=0.6206, HOME 44.0% annoncé/44.4% réel, AWAY 29.5%/
  30.0%), confirmé par validation chronologique anti-overfit (train 70%/test
  30%, aucun candidat ne bat la config actuelle hors-échantillon). Rien à
  changer. `backtest-home-advantage-roi-impact.ts` (édge VALUE) pas relancé
  vu ce résultat — sans biais de calibration, peu de raison d'attendre un
  delta ROI.

- `[ ]` **H2H v2.1 (pondération domicile/extérieur ×3) et v2.3a (continuité
  entraîneur)** — v2.0 (`computeH2HScore`, seuil n≥3, decay=0.8, nul=0.5) et
  v2.2 (signaux H2H par marché) sont **déjà en production** (`FEATURE_FLAGS.
SCORING.H2H`/`H2H_MARKET_SIGNALS = true`, actifs depuis fin juillet — pas du
  shadow). Reste :
  - `[ ]` v2.1 — backtest de comparaison avant tout code définitif
    (`backtest-h2h-venue-weighting.ts` existe déjà, pas encore concluant).
  - `[ ]` v2.3a — faisabilité API-Football vérifiée (`/coachs`), mais aucun
    modèle Prisma `Coach`/`CoachTenure` n'existe encore. Worker ETL + backtest
    avant activation.
  - `[-]` v2.3b (turnover effectif complet) — reporté, pas de point-in-time
    squad snapshot exploitable.

- `[~]` **BTTS NO** — activé en observation par ligue (`SA·BRA1·FRI @0.58`,
  `EL1·CH·EL2·LL @0.55`), jamais staké. Aucun edge cross-saison confirmé.
  Re-run `/backtest/tuning` chaque saison.

- `[~]` **GOALS** (`OVER_UNDER` ligne 2.5) — activé en observation, jamais
  staké. Re-vérifié 2026-08-15 : **BRA2 (n=245 cité) était un artefact de
  comptage** — 263 lignes `channel_selection` brutes mais seulement 49 vrais
  matchs après dédup par fixture (chaque match ré-analysé ~5× avant le coup
  d'envoi comptait comme 5 observations), aucun échantillon train. Le seul
  candidat qui passe le split train/valid est **PL** (train n=202 ROI+4.8%,
  valid n=113 ROI+12.3%) — mais **0 des 315 matchs PL utilisés ne datent
  d'après le changement homeAdvFactor du 2026-07-19** (voir
  `feedback_backtest_definition`/`project_channel_whitelist_replay_gap` en
  mémoire) : ce signal ne prouve rien sur le modèle actuel. Pas assez de
  volume post-07-19 pour retrancher. `GOALS` n'est de toute façon pas encore
  un `CouponChannel` éligible (limité à VALUE/SAFE/BTTS/DRAW/DOMINANT/
  TEAM_TOTAL) — ne rien câbler tant que ce point n'est pas réglé.

- `[~]` **CORRECT_SCORE** — collecte forward suffisante (4 250 legs réglées,
  35 ligues n≥20). Calibration globale surconfiante, s'aggrave avec la
  confiance affichée (motif transversal, pas local).
  - `[ ]` **Aucun mécanisme de promotion** — créer `CORRECT_SCORE_STAKED_LEAGUES`
    amorcé sur les candidats les plus solides : **USA2 (n=271, +19.2%)**,
    **UCL (n=220, +9.3%)**, **KOR2 (n=206, +4.6%)**.
  - `[ ]` **Cluster à risque à ne pas promouvoir** — Argentine (ARG1/ARG2,
    -60.5%/-64.9%), Chili, Brésil Série A, Russie, Suède — cotes moyennes
    basses (5.4-8.5), le modèle sous-estime probablement la variance des
    scores dans ces ligues.
  - `[ ]` Ligues à n<30 avec 0% de réussite (SUI1, POL1, POL2, CZE1, MX1,
    SVN1) — laisser accumuler avant de classer.

- `[x]` **CONSENSUS, CLEAN_SHEET, WIN_EITHER_HALF — cause racine trouvée et
  corrigée** (2026-08-15, corrige le cadrage trop optimiste de l'audit
  2026-08-12) — re-vérifié avec `db:backtest:channel-league-whitelist`
  (train/valid, même méthode que DRAW/BTTS) : **0 ligue confirmée pour les
  3 canaux**, contrairement au cadrage précédent ("candidat prioritaire")
  qui citait des splits par ligue cueillis dans un agrégat déjà négatif
  (CONSENSUS ROI global +1.0% mais -40.8% sur les 14 derniers jours ;
  CLEAN_SHEET -17.7% all-time ; WIN_EITHER_HALF -16.9% all-time). Cause
  racine : contrairement à O/U, BTTS, TEAM_TOTAL et RESULT_TOTAL_GOALS,
  `CLEAN_SHEET_HOME/AWAY` et `TO_WIN_EITHER_HALF` n'avaient **jamais reçu de
  shrinkage** — probabilité Poisson brute jamais recalibrée. Walk-forward
  lancé (`db:backtest:clean-sheet-win-either-half-shrinkage-calibration`,
  nouveau script) : **104 blocs livrés sur 264** (compétition×côté), pentes
  0.2–0.9 (surconfiance nette), câblés dans `OU_SHRINKAGE_CONFIG` via
  `ou-shrinkage.ts` (nouveaux champs `cleanSheetHome/Away`,
  `winEitherHalfHome/Away`, mêmes garanties que les blocs existants —
  shrink indépendant par côté, pas de complément 1-x). Reste : laisser
  tourner avec la proba recalibrée, puis relancer
  `channel-league-whitelist` dans quelques semaines pour voir si des ligues
  se confirment enfin avant d'envisager une whitelist de staking (même
  mécanisme que `DRAW_STAKED_LEAGUES`/`BTTS_STAKED_LEAGUES`). CONSENSUS
  reste en plus limité par le volume (n=316 total sur 2+ ans) — pas assez
  de données par ligue pour trancher indépendamment du fix de calibration.

- `[ ]` **Seuil DOMINANT symétrique — biais confirmé mais cause plus subtile
  que prévu** (re-vérifié 2026-08-15) — l'écart HOME sous-estimé / AWAY-DRAW
  surestimé sur les rejets `below_threshold` était en grande partie un
  artefact : 17 250 des ~21 000 rejets viennent d'un seul lot de backfill
  historique (`analyzedAt`='2026-06-30'). Après exclusion de ce jour, le
  biais persiste mais réduit (n=3 905) : HOME 50.1% réel/47.5% annoncé,
  AWAY 34.4%/44.4%, DRAW 20.6%/41.9%. **Mais homeAdvFactor/awayDisadvFactor
  viennent d'être re-confirmés bien calibrés globalement** (voir item
  ci-dessus) — donc ce n'est pas un biais 1X2 général qui fuit dans
  DOMINANT. Hypothèse la plus probable : effet de sélection sur l'argmax de
  3 probabilités bruitées et corrélées (dans les matchs serrés/incertains,
  le camp choisi comme favori est plus susceptible d'être une surestimation
  ponctuelle — "winner's curse" sur la sélection, pas un biais structurel
  par côté). Un seuil différencié par côté ne réglerait pas forcément ça
  proprement — nécessite une analyse dédiée à l'effet de sélection avant
  d'implémenter quoi que ce soit.

- `[x]` **`reasonDetails` de SAFE/VALUE trop pauvre pour l'audit** (résolu
  2026-08-15) — `score_below_threshold` reste fixture-level à raison (gate
  en amont de l'évaluation par marché, rien de plus précis à logger à ce
  stade). `no_viable_pick` (VALUE) et `no_safe_candidate` (SAFE) exposent
  désormais le meilleur candidat du pool par `qualityScore` (viable ou non)
  via le nouveau `bestQualityPickDetails()` (`selection/pick-evaluation.ts`) :
  market/pick/probability/odds/ev/edge/rejectionReason — même niveau de
  détail que DOMINANT/BTTS/WIN_EITHER_HALF/CLEAN_SHEET.

- `[~]` **Lambda scale (λScale)** — correction appliquée sur 11 ligues
  (dernière modif 2026-07-28, FIN1/BL1). Reste : re-mesurer
  `/backtest/calibration` après le prochain rebuild, étendre si d'autres biais
  stables apparaissent.

---

## Bugs & dette technique

- `[x]` **Étiquetage de compétition erroné — collision de nom** (résolu
  2026-08-15) — vérifié : aucun calibrage/seuil ne lit le nom brut (tout est
  `groupBy competitionCode` — `model-calibration.service.ts`,
  `channel-tuning.service.ts`, `dashboard.service.ts` — le risque de
  contamination croisée entre ligues homonymes n'existait donc que dans le
  rapport `analysis-sheet`, pas dans le moteur. Fix : `competitionCountry`
  ajouté à `AnalysisSheetFixture`/la requête SQL
  (`analysis-sheet.repository.ts`), `formatCompetitionLabel()` dans
  `analysis-sheet.render.ts` affiche désormais `"League One (China)"` /
  `"League One (England)"` au lieu du nom brut ambigu — utilisé à la fois
  dans le JSON par-fixture et l'agrégat `byCompetition` (qui fusionnait
  silencieusement les deux ligues avant ce fix).

- `[x]` **Doublons `odds_snapshot` — contrainte `@@unique` manquante en DB** —
  résolu en 2 migrations (2026-08-15, lancées par l'utilisateur).
  `20260815120000_dedupe_and_add_unique_odds_snapshot` : 797 844 lignes
  dupliquées supprimées (3 202 638 → 2 404 794), `@@unique([fixtureId,
  bookmaker, market, pick, snapshotAt])` posé, ancien `@@index` redondant
  supprimé. Gap trouvé le jour même : `pick` est `NULL` pour ONE_X_TWO, et un
  `@@unique` standard traite chaque `NULL` comme distinct — deux lignes
  ONE_X_TWO strictement identiques s'inséraient sans erreur (vérifié
  empiriquement). `20260815130000_odds_snapshot_unique_nulls_not_distinct` a
  basculé la contrainte en `UNIQUE NULLS NOT DISTINCT` ; re-testé en
  transaction annulée, le second insert échoue désormais bien avec `P2002`.
  Aucun risque de crash : les deux `create()` (`upsertOneXTwoOddsSnapshot`,
  `upsertNonOneXTwo` dans `fixture.repository.ts`) catchent déjà `P2002` via
  `isUniqueConstraintError` et retombent sur un `update()`.

- `[ ]` **`backtest-channel-league-whitelist.ts` n'est pas un vrai backtest —
  lit l'historique au lieu de rejouer le modèle actuel** (découvert
  2026-08-15, voir mémoire `feedback_backtest_definition`/
  `project_channel_whitelist_replay_gap`) — contrairement à
  `backtest-team-total-shrinkage-calibration.ts` et
  `backtest-clean-sheet-win-either-half-shrinkage-calibration.ts` (qui
  recalculent `deriveLambdas`/`computePoissonMarkets` d'aujourd'hui sur les
  TeamStats point-in-time), ce script lit les `channel_selection` déjà
  enregistrées — donc la config qui était en vigueur au moment de chaque
  décision historique, pas la config actuelle. Impact concret : la quasi
  totalité du volume utilisé pour confirmer DRAW/CSL et GOALS/PL date
  d'avant le changement homeAdvFactor du 07-19 (I2 0/1035, BL1 0/213, CSL
  5/98, POR 5/543, PL 0/315 après cette date). À corriger : soit réécrire ce
  script en vrai rejeu du pipeline complet (deriveLambdas →
  rebalanceThreeWayProbabilities → shrinkOverUnderProbabilities → H2H →
  logique de sélection par canal), soit accepter de restreindre les futures
  confirmations à la fenêtre post-dernière-correction majeure une fois le
  volume suffisant. Ne pas utiliser ce script seul pour justifier une
  nouvelle activation de staking tant que ce n'est pas réglé.

- `[ ]` **Rapport hebdomadaire de risque reste 1X2-only** — `risk.service.ts`
  (`generateWeeklyReport`) hardcode toujours `market: Market.ONE_X_TWO`
  (le `brierScore` en dur est corrigé). Étendre à tous les marchés change la
  forme de `WeeklyReportPayload` (impacte `notification.service.ts`,
  `mail.service.ts`, le template `@evcore/transactional`) — volontairement
  laissé de côté vu l'ampleur du changement de contrat.

- `[ ]` **`CALIBRATION_MARKET = Market.ONE_X_TWO` — décision de scope à
  revisiter, pas un bug** — `adjustment.service.ts:19`, commenté comme un
  choix MVP intentionnel. Le produit tourne en argent réel maintenant — mérite
  d'être réévalué comme décision produit, pas comme correction de bug.

- `[ ]` **`calibration_alert`/pénalité longshot — seuils globaux, pas par
  ligue** (limite connue, 2026-08-15) — les deux gates activés ce jour-là
  (`OVER_UNDER_CALIBRATION_GATE.FAVORITE_FLIP_MIN_GAP=0.10`, seuil longshot 5.0
  - planchers 0.12/0.15) sont uniques pour toutes les ligues, cohérent avec le
    gate 1X2 existant (également global). Vérifié : le signal n'est pas porté
    par une seule ligue (RESULT_TOTAL_GOALS 15+, n=265, réparti sur ~18 ligues),
    mais **ARG1 (n=67, ROI -20.9%) vs ARG2 (n=60, ROI +1.7%)** divergent
    nettement à volume comparable — indice d'une vraie hétérogénéité par ligue
    qu'on ne peut pas calibrer ici (volume trop faible par ligue à cote longue/
    divergence élevée). À revisiter quand le volume de paris réglés aura grossi.

- `[ ]` **Pénalité longshot non couverte sur 3 marchés** — `RESULT_BTTS`,
  `FIRST_HALF_WINNER`, `OVER_UNDER` (ligne 4.5) montrent la même direction de
  signal que `RESULT_TOTAL_GOALS`/`HALF_TIME_FULL_TIME` (déjà activés) mais
  trop bruité aux cotes longues (n<300, tranche 15+ parfois positive des deux
  côtés) — à revisiter avec plus de données.

- `[ ]` **`MARKET_MOVE`** — nouveau canal, à démarrer quand l'historique de
  cotes est assez dense.

- `[ ]` **`LIVE_VALUE`** — nouveau canal, pipeline live isolé des analyses J-/JT.

- `[~]` **Ligues pauvres en données** (diagnostic 2026-07-01, doc
  [docs/data-poor-leagues-calibration.md](docs/data-poor-leagues-calibration.md)) —
  le 1X2 lui-même reste miscalibré sur les ligues pauvres en données (WCQ\*,
  UNL, ISL1, POL, LAT1, FRI, WC, NOR2, FIN1). **Étape 2 (shrinkage proba→marché
  au-delà du 1X2) largement faite depuis** (corrigé 2026-08-15, TODO périmé
  sur ce point) : `ou-shrinkage.ts` shrink désormais O/U plein temps, BTTS,
  O/U mi-temps, TEAM_TOTAL_HOME/AWAY et RESULT_TOTAL_GOALS vers le taux de
  base ligue, sur 49 ligues. Reste :
  - `[ ]` **Étape 1 (récupérer plus de données xG)** — toujours pas fait,
    aucune source xG supplémentaire ajoutée pour les compétitions
    internationales/petites ligues.
  - `[ ]` **Le 1X2 lui-même** (`rebalanceThreeWayProbabilities`) n'a pas
    reçu le même traitement que les marchés dérivés — reste sur son blend
    empirique existant, pas le shrinkage par ligue mesuré pour l'O/U/
    TEAM_TOTAL/RESULT_TOTAL_GOALS.

- `[x]` **ML — garde-fou manquant : `isActive` sans fichier chargé** (résolu
  2026-08-15) — `MlService.checkModelHealthAlignment()` compare
  `MlRepository.findActiveSegments()` (DB) vs `MlInferenceService.getHealth()`
  (`/health` ml-worker) et alerte via `NotificationService.sendMlModelMissingAlert`
  (nouveau `NotificationType.ML_MODEL_MISSING`, template email dédié) sur tout
  écart. Câblé en cron toutes les 15 min (`ml-scheduler-worker`, job
  `ml-health-check`). Ml-worker injoignable → skip silencieux, jamais de faux
  positif. Migration `20260815140000_add_ml_model_missing_notification_type`
  (nouvelle valeur d'enum) rédigée, **reste à lancer côté utilisateur**.
  Découverte annexe (non corrigée, hors scope) : le type `NotificationType`
  front (`apps/web/domains/notification/types/notification.ts`) était déjà
  désynchronisé avant ce fix — `ML_MODEL_ACTIVATED` n'y figure pas.

- `[ ]` **ML — re-vérifier le backtest shadow vs baseline (~2026-08-26)** —
  seul `DOMINANT:ONE_X_TWO` est un candidat sérieux à la promotion (Brier
  0.277→0.232, stable), le reste dégrade ou n'a pas assez de volume.
  `BTTS:BTTS`/`DRAW:ONE_X_TWO` avaient un historique de correction mort
  (fichier manquant, corrigé le 2026-08-12) — revérifier si un historique
  valide recommence à s'accumuler. Avant toute activation réelle : vérifier le
  ROI simulé (pas juste Brier) + définir un mécanisme de gouvernance
  (cap de poids ≤30%, pas un remplacement total).

- `[ ]` **[ETL] `model_run.features.injuries` semble non alimenté** (2026-08-14,
  Heart of Midlothian–Benfica) — le worker `injuries-sync` est actif et
  correctement câblé (pas un bug de pipeline cassé) ; l'hypothèse la plus
  probable est une source de données vide pour cette compétition/ce niveau
  (Écosse, coupes européennes qualif) plutôt qu'un échec silencieux. Reste une
  question de disponibilité de données à trancher avant de refaire confiance
  aux picks sur des matchs à contexte blessures significatif.

- `[ ]` **[ETL] AUS1 — trou d'intersaison, heuristique locale en retard d'un
  cran vs API-FOOTBALL** (2026-08-13) — API-FOOTBALL a déjà basculé `current`
  sur 2026-27 alors que l'heuristique locale reste sur 2025 jusqu'en octobre.
  Impact faible (se corrige seul en octobre, aucun match A-League d'ici là).
  Décider si ça vaut un `apiSeasonOverride` temporaire ou si on laisse courir.

---

## Checklist par nouveau canal (rappel méthode, doc §11)

hypothèse → `allowedMarkets` → critères `SELECTED` / codes de rejet → seuils
par ligue → implémentation → tests → **backtest séparé** → shadow/observation
→ activation par segment validé → settlement + métriques → API/front.
