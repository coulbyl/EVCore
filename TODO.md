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

- `[ ]` **DRAW — ligues supplémentaires non confirmées** — `FRI`, `KOR1`,
  `KOR2`, `CSL`, `BRA2`, `WC`, `CHN2` montrent un ROI agrégé positif (jusqu'à
  +41%) mais `train n=0` sur `db:backtest:channel-league-whitelist` — pas assez
  d'historique pour un split. Ne pas ajouter à `DRAW_STAKED_LEAGUES` sur le
  seul agrégat ; relancer le script périodiquement.

- `[ ]` **Agrégats ROI/summary ignorent silencieusement `PARTIAL`/`VOID`** —
  `coupon-summary.service.ts`, `coupon-indices.service.ts` et `coupon.repository.ts`
  filtrent uniquement `WON`/`LOST`. `PARTIAL` est atteignable depuis le 2026-08-09
  (legs voidées sur fixture `POSTPONED`/`CANCELLED`) — ces vues l'excluent
  silencieusement au lieu de le compter explicitement (VOID : correct de
  l'exclure ; PARTIAL : probablement à inclure comme gain partiel).

- `[ ]` **Calibration `k`/`decayHalfLifeDays`/`windowDays`** — mesurée
  (`db:backtest:signal-window-calibration`), gain réel mais marginal et pas
  appliqué (compromis réactivité vs stabilité). À reconsidérer seulement si ces
  valeurs semblent un jour concrètement mauvaises en usage.

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

- `[ ]` **homeAdvFactor/awayDisadvFactor — ROI impact non re-testé** —
  recalibrés le 2026-07-19 (1.05/0.95 → 1.00/0.75). Reste à faire : relancer
  `backtest-home-advantage-roi-impact.ts` en y ajoutant le plancher d'edge
  VALUE existant (`getValueMinEdge`, edge≥0.10, toujours pas dans ce script)
  pour voir si les deux garde-fous sont redondants ou complémentaires.

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
  staké. **Jamais évalué pour promotion staking** (audit 2026-08-12) — signal
  net sur **BRA2 (n=245, ROI +30.5%)** et cluster nordique/balte (IRL1/DEN1/
  ISL1/LAT1). Négatif à surveiller : CHN2 (-37.6%), NOR2 (-21.3%). Pas de
  `GOALS_STAKED_LEAGUES` (ou équivalent) — à créer sur le modèle
  `DRAW_STAKED_LEAGUES`/`BTTS_STAKED_LEAGUES`, amorcé sur BRA2.

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

- `[ ]` **CONSENSUS, CLEAN_SHEET, WIN_EITHER_HALF — jamais évalués pour
  promotion** (audit 2026-08-12) — aucune mention dans `signal-window.service.ts`
  ni `coupon.constants.ts`. Différent de DOMINANT (jugé et exclu, ROI -2.1%) :
  ces trois n'ont jamais été jugés du tout.
  - **CONSENSUS** : signal le plus net — 5 ligues positives sur 7 (n≥20),
    Ligue 1 (+31.1%), Ligue 2 (+32.7%), Suisse (+20.4%), Veikkausliiga (+11.1%,
    n=47), UCL (+7.4%). Volume global faible (375 legs) — candidat prioritaire.
  - **CLEAN_SHEET** : spread par ligue le plus large — Ykkösliiga +75%,
    USL Championship +38% (n=175), UCL +23.7% (n=97) ; à l'inverse Serbie
    -52.8%, Argentine -37.2% (n=265). L'agrégat (35.1%) masquait tout ça.
  - **WIN_EITHER_HALF** : mitigé partout sauf un vrai trou en Corée (K League 1
    -70.3% ROI n=35, K League 2 -40.9% n=37) — à isoler/recalibrer.
  - Une fois un premier pilote validé : whitelist par ligue +
    `calibratedCanalLeagueHitRates`, même mécanisme que DRAW/BTTS/TEAM_TOTAL.

- `[ ]` **Seuil DOMINANT symétrique alors que le biais mesuré ne l'est pas**
  (audit 2026-08-12, 18 041 legs `below_threshold`) — legs **HOME** refusées
  sous-estimées (49.0% réel vs ~45.5% annoncé) ; **AWAY**/**DRAW** surestimées
  (37.1%/28.0% réel vs ~44-45%). Biais favori-longshot déjà traité côté EV mais
  absent du seuil `below_threshold` (`dominant.strategy.ts`, seuil unique quel
  que soit le côté). Appliquer un seuil différencié par côté.

- `[ ]` **`reasonDetails` de SAFE/VALUE trop pauvre pour l'audit** — leurs
  rejets (`score_below_threshold`/`no_safe_candidate`/`no_viable_pick`) ne
  stockent qu'un score agrégé fixture, pas le marché/pick précis qui aurait
  été choisi. Contrairement à DOMINANT/BTTS/WIN_EITHER_HALF/CLEAN_SHEET,
  impossible à auditer de cette façon aujourd'hui.

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

- `[ ]` **ML — garde-fou manquant : `isActive` sans fichier chargé** —
  `registry.py` détecte maintenant un fichier de modèle manquant au chargement
  (log warning, skip) mais **aucune alerte** n'existe si un modèle `isActive=true`
  en DB n'est jamais réellement chargé (le `/health` ml-worker ne liste que les
  segments actifs, pas les manquants). Ajouter un health-check qui compare les
  deux et alerte.

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
