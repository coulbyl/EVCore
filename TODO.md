# EVCore — Reste à faire : Architecture des canaux de stratégie

> Référence : [docs/channel-strategy-architecture.md](docs/channel-strategy-architecture.md) · [ROADMAP.md](ROADMAP.md)
> Plan ML archivé : [docs/phase3-ml-todo.md](docs/phase3-ml-todo.md)
>
> **Principe directeur** : un canal = une **stratégie de sélection**, pas un marché.
> Aucun nouveau canal n'est activé sans backtest séparé par ligue/marché/saison.
>
> ⚠️ Ce fichier couvre le chantier **canaux de stratégie / calibration
> modèle** ET, depuis le 2026-08-09, le **générateur de coupon** (section
> dédiée ci-dessous). Le travail EVA (chat, persona pro, filter bar) n'y est
> pas suivi.

## Statut

- `[ ]` À faire
- `[~]` En cours / observation
- `[-]` Abandonné / hors périmètre v1

---

## Générateur de coupon (chantier 2026-08-09, branche `feat/coupon-generator-intelligence`)

> Historique complet : Bloc 9 de [ROADMAP.md](ROADMAP.md). Rien ici n'est
> bloquant pour merger la branche — ce sont des suites, pas des prérequis.

- `[x]` **Enrichir l'export "fiche EVCore" avec `evaluatedPicks` complet
  (décidé et livré le 2026-08-13, PR en cours)** — post-mortem du coupon 13-14/08 :
  [COUPON_ANALYSIS_TEMPLATE.md](COUPON_ANALYSIS_TEMPLATE.md) ne doit plus se
  limiter à lire `selectedPicks` (un seul pick par canal, filtré par les
  seuils EV/odds/probabilité propres à chaque canal — hors-sujet pour
  construire un coupon à la main, cf. discussion sur PAOK `TEAM_TOTAL_AWAY
  OVER_0_5` rejeté `ev_below_threshold` mais parfaitement valable comme
  jambe de combo). Aujourd'hui, obtenir cette vue complète nécessite une
  requête DB par fixture (`model_run.features.evaluatedPicks` +
  `odds_snapshot` en repli quand un marché est absent d'`evaluatedPicks`,
  cf. bug bookmaker-par-marché ci-dessous) — pas praticable à 39 fixtures/
  jour avec un tunnel SSH instable. Décision : étendre
  `apps/backend/src/modules/analysis-sheet/analysis-sheet.render.ts`
  (type `AnalysisSheetJsonFixture`, ligne ~116 ; construction de
  `selectedPicks`, ligne ~206) pour inclure `evaluatedPicks` en entier
  (tous statuts, viable et rejected) par fixture dans l'export JSON, plus
  `rawPoissonProbability`/`lambda` déjà dans `model_run.features` pour
  permettre la comparaison brut/calibré sans requête DB séparée. Objectif :
  un process d'analyse **actif** (balayer tous les marchés de tous les
  matchs du jour, filtrer par fiabilité — probabilité + accord brut/calibré
  + `lambdaTotal` sur les picks `UNDER_*` — puis construire le coupon sur ce
  pool réduit) plutôt que **réactif** (ne réagir qu'aux `selectedPicks` déjà
  filtrés par le système).
  - `[x]` **Livré** — nouveau champ `evaluatedPicks:
    AnalysisSheetJsonEvaluatedPick[]` par fixture (market, pick, label,
    probability, odds, ev, status, rejectionReason, adjustmentDelta vs
    raw Poisson), réutilisant l'extraction déjà faite par
    `extractEvaContextFromFeatures` (`model-run.utils.ts`) — pas de nouvelle
    logique de parsing. Testé (`analysis-sheet.render.spec.ts`).

- `[~]` **LONGSHOT_WEEKEND/MIDWEEK en observation** — généré en vrai chaque
  weekend/mardi-jeudi, badge "Expérimental" côté UI, jamais staké comme une
  recommandation validée.
  - `[x]` **Cause du 0 coupon confirmée (audit 2026-08-12)** — premier
    déclenchement réel le 11/08 (LONGSHOT_MIDWEEK, 3 jours après activation) :
    0 ligne générée, pas un bug de câblage. `MAX_POOL_SIZE=25` (tronqué sur
    toute la fenêtre multi-jours) + règle anti-corrélation (1 leg par
    canal+marché) starvent `composeGreedy` avant d'atteindre `minLegs`
    (6-12) — le pool n'a simplement pas assez de combinaisons canal+marché
    distinctes un jour donné.
  - `[ ]` Desserrer `MAX_POOL_SIZE`/la règle anti-corrélation spécifiquement
    pour le profil LONGSHOT (pool dédié plus large, ou anti-corrélation
    assouplie pour `composeGreedy` seul), sinon le profil restera
    structurellement à 0 coupon même après plusieurs semaines d'observation.
  - `[ ]` Laisser accumuler quelques semaines de règlements réels avant
    d'envisager un backtest (`composeGreedy` n'avait jamais tourné en prod
    avant cette session — pas d'historique multi-jours à rejouer).
  - `[ ]` Écrire `db:backtest:coupon-longshot` une fois assez de coupons
    LONGSHOT réglés (WON/LOST/VOID/PARTIAL) — mesurer hit-rate réel du
    coupon complet vs cote, pas juste par jambe.
  - `[ ]` Ne retirer le badge "Expérimental" / n'activer au même niveau que
    le profil par défaut qu'après un backtest vert avec split train/valid.

- `[ ]` **`jointProbability` surconfiant, et de plus en plus avec la
  confiance affichée** (audit 2026-08-12, 409 `CouponProposal` réglés) —
  bucket ~27.5% annoncé → 30.2% réel (bien calibré) ; bucket ~43.9% annoncé
  (n=30) → **20.0% réel** (-23.9 pts). Le calcul actuel multiplie des
  probabilités par jambe sans corriger la corrélation entre elles (même
  match, même round de qualif, même type de scénario incertain) — c'est ce
  qui a fait perdre le coupon manuel du 11/08 (48% de proba jointe réelle,
  présenté comme "sécurisé"). Corriger le calcul (facteur de corrélation)
  ou au minimum appliquer le même shrinkage bayésien que `calibrate()` à
  `jointProbability` avant affichage, pour ne pas survendre la confiance
  des combinés à haute probabilité annoncée.

- `[ ]` **Pondération des signaux leg-level dans `signalScore`** (A4, pas
  fait volontairement) — `priorAnalysisCount`, `offensiveBalance`,
  `shadowConflict` sont exposés dans `ScoredPick`/`featureSnapshot` mais
  n'influencent encore rien. `db:backtest:coupon-quality-signals` (2026-08-09)
  a montré `train n=0` sur ces champs — trop récemment enrichis dans
  `ModelRun.features` pour un vrai split. Relancer ce script dans 2-3
  semaines ; ne pondérer que si train ET valid confirment (même règle que
  partout ailleurs dans ce fichier).

- `[ ]` **FADE (pick inverse sur divergence extrême seule)** —
  `COUPON_ENFORCE_AVOID_FADE=false`, signal le mieux corroboré du backtest
  qualité (train +18%/valid +20%) mais n=15-17 à peine au-dessus du seuil
  minimal. Revalider avec plus de données avant d'activer.

- `[ ]` **DRAW — ligues supplémentaires non confirmées** — `FRI`, `KOR1`,
  `KOR2`, `CSL`, `BRA2`, `WC`, `CHN2` montrent un ROI agrégé positif (jusqu'à
  +41%) mais `train n=0` sur `db:backtest:channel-league-whitelist`
  (2026-08-09) — pas assez d'historique pour un split. Ne pas les ajouter à
  `DRAW_STAKED_LEAGUES` sur la base du seul agrégat ; relancer le script
  périodiquement.

- `[ ]` **Agrégats ROI/summary ignorent silencieusement `PARTIAL`/`VOID`** —
  `coupon-summary.service.ts`, `coupon-indices.service.ts` et deux requêtes
  de `coupon.repository.ts` filtrent uniquement `WON`/`LOST`. C'était sans
  conséquence tant que `PARTIAL` était du code mort (corrigé le 2026-08-09,
  cf. Bloc 9) — maintenant qu'il est atteignable (legs voidées sur fixture
  `POSTPONED`/`CANCELLED`), ces vues excluent silencieusement les coupons
  `PARTIAL`/`VOID` des stats au lieu de les compter explicitement (VOID :
  correct de l'exclure, mise remboursée ; PARTIAL : à trancher — probablement
  à inclure comme un gain partiel plutôt qu'à ignorer).

- `[ ]` **Calibration `k`/`decayHalfLifeDays`/`windowDays`** — mesurée
  (`db:backtest:signal-window-calibration`), gain réel mais marginal et pas
  appliqué (compromis réactivité vs stabilité, cf. Bloc 9). À reconsidérer
  seulement si ces valeurs semblent un jour concrètement mauvaises en usage,
  pas par optimisation pure du score de calibration.

---

## En cours (observation, pas encore staking-grade)

- **`[~]` Nouveaux marchés (DNB/TEAM_TOTAL/CLEAN_SHEET/WIN_TO_NIL/
  WIN_EITHER_HALF/RESULT_TOTAL_GOALS/RESULT_BTTS)** — wired dans VALUE/SAFE,
  3 canaux observation-only (`CLEAN_SHEET`, `TEAM_TOTAL`, `WIN_EITHER_HALF`)
  activés avec seuils dérivés structurellement. Backtest de calibration
  historique fait (`docs/new-markets-calibration-backtest.md`, script
  `packages/db/scripts/backtest-new-markets-calibration.ts`) — a révélé un
  biais HOME sous-estimé/AWAY sur-estimé, corrigé le 2026-07-19 (voir item
  homeAdvFactor ci-dessous). Reste : extension SAFE/VALUE bloquée tant que
  les cotes forward ne sont pas accumulées sur ces marchés
  (`docs/new-markets-safe-value-backtest.md`) — ne pas activer de pick
  `AWAY_*` sur ces marchés avant, le biais AWAY reste net-négatif même après
  recalibration (voir ci-dessous).

- **`[~]` homeAdvFactor/awayDisadvFactor recalibrés (2026-07-19)** —
  `ev.constants.ts` : 1.05/0.95 → 1.00/0.75, validé par grid-search Brier/ECE
  (46 679 fixtures) + split chronologique 70/30 anti-overfit + simulation ROI
  VALUE/ONE_X_TWO (+0.78pp). Reste à faire : les picks `AWAY` qui passent
  encore le seuil EV restent net-négatifs post-recalibration — relancer
  `backtest-home-advantage-roi-impact.ts` en y ajoutant le plancher d'edge
  VALUE existant (`getValueMinEdge`, edge≥0.10) pour voir si les deux gardes-
  fous sont redondants ou complémentaires, avant de considérer toucher au
  plancher d'edge.

- **`[ ]` H2HService v2** (doc [docs/h2h-service-v2-plan.md](docs/h2h-service-v2-plan.md)) —
  actuellement 100% shadow (jamais lu par la décision), limites identifiées
  (pas de seuil d'échantillon, pas de pondération récence). Valeur
  incrémentale confirmée empiriquement (`backtest-h2h-signal-value.ts` :
  r=0.05 brut → r=0.08 une fois corrigé, gradient monotone sur 5 buckets —
  vrai signal, pas du bruit). Prochaines étapes dans l'ordre :
  - `[ ]` v2.0 — réécrire `computeH2HScore` (seuil n≥3, decay=0.8, nul=0.5) +
    tests. Rester en shadow.
  - `[ ]` Backtest de gain de Brier sur le score composite complet avec H2H
    v2.0 intégré à un poids candidat, avant toute activation.
  - `[ ]` v2.1 (pondération domicile/extérieur ×3) — backtest de comparaison
    avant tout code définitif.
  - `[ ]` v2.2 (signaux H2H par marché : BTTS/Over 2.5/clean sheet/win-to-nil)
    — un backtest de valeur incrémentale par signal, activation marché par
    marché.
  - `[ ]` v2.3a (continuité entraîneur) — faisabilité API-Football vérifiée
    (`/coachs`, 1725 équipes ≈ 4 min à ingérer). Nouveau modèle Prisma
    `Coach`/`CoachTenure` + worker ETL + backtest avant activation.
  - `[-]` v2.3b (turnover effectif complet) — reporté, pas de point-in-time
    squad snapshot exploitable sans reconstruction lourde via `/transfers`.

- **`[~]` BTTS NO** — activé en observation par ligue (`SA·BRA1·FRI @0.58`,
  `EL1·CH·EL2·LL @0.55`), jamais staké. Aucun edge cross-saison confirmé
  (P(NO) du modèle sans lift sur le taux de base). Re-run `/backtest/tuning`
  chaque saison ; promotion staking seulement si le signal se confirme sur
  données futures. Le vrai blocage = recalibration modèle par ligue.

- **`[~]` GOALS** (`OVER_UNDER`) — ligne **2.5** activée en observation
  (segments candidats, jamais staké). Verdict : pas d'edge cross-saison
  confirmé (ROI 2025-26 = artefact de saison, pas un vrai décalage de buts).
  - `[x]` **[ETL]** Densifier les cotes `OVER_UNDER` 1.5/3.5/4.5 — résolu.
    Vérifié le 2026-08-12 : le trou (20 683 legs sans cote, concentré sur la
    semaine du 29/06) s'est résorbé progressivement et **0 cas sans cote
    depuis le 27/07** sur toutes les lignes. Plus un prérequis bloquant.
  - `[ ]` **Jamais évalué pour promotion staking** (audit 2026-08-12,
    classement par ligue n≥20) — signal positif net et volumineux sur
    **Série B Brésil (BRA2, n=245, ROI +30.5%)**, cluster nordique/balte
    cohérent (IRL1 +45.3% n=76, DEN1 +32% n=43, ISL1 +28.3% n=74, LAT1
    +26.3% n=37, à corréler avec les corrections `LAMBDA_SCALE` déjà
    appliquées). Négatif à surveiller : CHN2 (-37.6%, n=85), NOR2 (-21.3%,
    n=104). Sur les grosses ligues européennes établies (EL1/EL2/CH/SP2/I2/
    SA/F2), ROI proche de l'équilibre (-13% à +0.6%) — marché déjà efficient,
    pas de promotion à chercher là. Étendre `calibratedCanalLeagueHitRates`
    (signal-window.service.ts) à GOALS une fois le pilote BRA2 validé.

- **`[~]` CORRECT_SCORE** — collecte forward démarrée (worker + canal + front
  livrés, observation-only). Collecte désormais suffisante (audit
  2026-08-12 : 4 250 legs réglées avec cote, 35 ligues avec n≥20).
  - `[x]` Calibration globale mesurée : 10.3% de réussite réelle vs 14.2%
    de probabilité annoncée en moyenne — surconfiant, et l'écart **s'aggrave
    avec la confiance affichée** (bucket ~12.5%, le cas modal : bien
    calibré ; bucket ~21.5% : -16 pts ; bucket ~42.2% : -33.9 pts). Motif
    identique à `jointProbability` ci-dessus — biais transversal, pas local
    à ce canal.
  - `[ ]` **Aucun mécanisme de promotion n'existe pour ce canal**
    (contrairement à `DRAW_STAKED_LEAGUES`/`BTTS_STAKED_LEAGUES`) alors que
    le classement par ligue montre un signal net et exploitable : **USA2
    (n=271, ROI +19.2%), Champions League UCL (n=220, +9.3%), K League 2
    KOR2 (n=206, +4.6%)** sont les candidats les plus solides (grand n,
    ROI positif net). Créer `CORRECT_SCORE_STAKED_LEAGUES` sur le même
    modèle, amorcé sur ces 3 ligues.
  - `[ ]` **Cluster à risque identifié, à ne pas promouvoir** — Argentine
    (ARG1 n=315 ROI -60.5%, ARG2 n=451 ROI -64.9% — les deux plus gros
    échantillons du classement), Chili (CHI1 n=134 -68.7%), Brésil Série A
    (BRA1 n=101 -48.0%), Russie (RUS1 n=101 -70.2%), Suède (SWE1 n=106
    -63.7%). Cotes moyennes basses (5.4-8.5) sur ce cluster — le modèle
    sous-estime probablement la variance des scores dans ces ligues
    (distribution de buts plus chaotique que ce que capture le λ Poisson).
    À creuser avant toute promotion, séparément du reste.
  - `[ ]` Ligues à n<30 avec 0% de réussite (SUI1, POL1, POL2, CZE1, MX1,
    SVN1) — pas encore une preuve de biais (un 0/25 reste plausible par
    hasard sur un marché à ~12% de proba attendue), laisser accumuler avant
    de classer.
  - `[ ]` Une fois le pilote validé, étendre `calibratedCanalLeagueHitRates`
    à CORRECT_SCORE comme les autres canaux promus.

- **`[ ]` CONSENSUS, CLEAN_SHEET, WIN_EITHER_HALF — jamais évalués pour
  promotion, aucune mention nulle part dans `signal-window.service.ts` ni
  `coupon.constants.ts`** (audit 2026-08-12). Différent de DOMINANT (jugé et
  exclu après backtest, ROI -2.1%) : ces trois n'ont jamais été jugés du
  tout, pas de décision documentée.
  - `[ ]` **CONSENSUS** — signal le plus net des trois : 5 ligues positives
    sur 7 testées (n≥20), Ligue 1 (+31.1%, n=23), Ligue 2 (+32.7%, n=21),
    Super League Suisse (+20.4%, n=25), Veikkausliiga (+11.1%, n=47, le plus
    gros échantillon), Champions League (+7.4%, n=37). Volume global encore
    faible (375 legs avec cote au total) — candidat prioritaire pour un
    pilote de promotion dès que le volume aura grossi.
  - `[ ]` **CLEAN_SHEET** — le spread par ligue le plus large de tout
    l'audit : Ykkösliiga +75.0% (n=60), Virsliga +68.6% (n=22), USL
    Championship **+38.0% (n=175, volume solide)**, Champions League
    **+23.7% (n=97, volume solide)** ; à l'inverse Super Liga Serbie -52.8%
    (n=29), Primera Nacional Argentine **-37.2% (n=265, plus gros
    échantillon du classement)**. Le taux agrégé (35.1%) masquait
    complètement cet écart — ne rien activer sans découpage par ligue.
  - `[ ]` **WIN_EITHER_HALF** — mitigé partout (ARG1/UECL/UCL/USA2/CHI1
    tous légèrement négatifs sur gros n), **sauf un vrai trou identifié en
    Corée** : K League 1 à 17.1% de réussite réelle contre 61.3% annoncé
    (ROI -70.3%, n=35), K League 2 à -40.9% (n=37) — surconfiance massive et
    spécifique à ce pays sur ce marché. À isoler/recalibrer avant toute
    promotion plus large du canal.
  - `[ ]` Une fois un premier pilote validé sur l'un des trois, même
    mécanisme que DRAW/BTTS/TEAM_TOTAL : whitelist par ligue +
    `calibratedCanalLeagueHitRates`.

- **`[ ]` Seuil DOMINANT symétrique alors que le biais mesuré ne l'est pas**
  (audit 2026-08-12, 18 041 legs `below_threshold` reconstruites via
  `model_run.features.probabilities`) — legs **HOME** refusées : 49.0% de
  réussite réelle contre ~45.5% annoncé (sous-estimées) ; legs
  **AWAY**/**DRAW** refusées : 37.1%/28.0% réel contre ~44-45% annoncé
  (surestimées). Biais favori-longshot classique du foot, déjà traité côté
  EV (`ONE_X_TWO_AWAY_LONGSHOT_PENALTY_FLOOR`/`ONE_X_TWO_DRAW_LONGSHOT_PENALTY_FLOOR`)
  mais absent du seuil de sélection DOMINANT lui-même (`below_threshold`,
  seuil unique quel que soit le côté). Appliquer un seuil différencié par
  côté sur le même principe.

- **`[ ]` Observabilité : `reasonDetails` de SAFE/VALUE trop pauvre pour
  l'audit "qu'a-t-on raté"** (audit 2026-08-12) — leur rejet
  `score_below_threshold`/`no_safe_candidate`/`no_viable_pick` ne stocke
  qu'un score agrégé au niveau fixture (identique pour SAFE et VALUE,
  17 141 fois), pas le marché/pick précis qui aurait été choisi.
  Contrairement à DOMINANT/BTTS/WIN_EITHER_HALF/CLEAN_SHEET (dont
  `reasonDetails` porte les probabilités par côté, permettant de reconstruire
  et vérifier le pick refusé contre le score réel), SAFE/VALUE sont
  impossibles à auditer de cette façon aujourd'hui. Enrichir `reasonDetails`
  pour ces deux canaux avec le candidat presque-sélectionné.
- **`[~]` Lambda scale (λScale)** — correction appliquée sur 11 ligues
  (biais structurel de niveau de buts). Reste : re-mesurer
  `/backtest/calibration` après le prochain rebuild, étendre si d'autres
  biais stables apparaissent.

---

## À faire

- `[ ]` **Étiquetage de compétition erroné — collision de nom** (trouvé en
  revue qualitative du 2026-08-15, coupon multi-continents) — dans la fiche
  EVCore du 15/08, 3 matchs chinois (Yanbian Longding–Dalian Huayi, Guangxi
  Hengchen–Meizhou Kejia, Wuxi Wugou–Guangzhou E-Power) apparaissent avec
  `competition: "League One"` — le même nom affiché que la vraie League One
  anglaise, ce qui les a fait atterrir dans le mauvais lot lors d'un tri par
  zone géographique. Collision similaire repérée entre la Bundesliga
  allemande et la Bundesliga autrichienne (Sturm Graz, Austria Lustenau),
  toutes deux affichées sous `competition: "Bundesliga"`. Risque réel au-delà
  de la confusion d'analyse manuelle : si un calibrage ou seuil par ligue lit
  ce nom affiché plutôt qu'un code de compétition unique, les deux ligues
  homonymes pourraient se faire écraser mutuellement leurs stats. À vérifier :
  d'où vient `competition` dans l'export fiche (`analysis-sheet.render.ts`)
  — nom API-Football brut vs code interne — et si un identifiant unique
  (competitionCode) est disponible pour désambiguïser à l'affichage.
- `[ ]` **`MARKET_MOVE`** — nouveau canal, à démarrer quand l'historique de
  cotes est assez dense.
- `[ ]` **`LIVE_VALUE`** — nouveau canal, pipeline live isolé des analyses J-/JT.
- `[ ]` **Ligues pauvres en données** (diagnostic 2026-07-01, doc
  [docs/data-poor-leagues-calibration.md](docs/data-poor-leagues-calibration.md)) :
  le modèle 1X2 est miscalibré uniquement sur les ligues pauvres en données
  (WCQ\*, UNL, ISL1, POL, LAT1, FRI, WC, NOR2, FIN1). Étape 1 : voir si on peut
  récupérer plus de données (xG international/petites ligues, historique plus
  long). Étape 2 : shrinkage proba→marché pondéré par la fiabilité des
  données (étendre `rebalanceThreeWayProbabilities` au-delà du 1X2).
- `[ ]` **ml-worker désynchronisé** (doc
  [docs/ml-worker-sync.md](docs/ml-worker-sync.md)) : la couche de correction
  ML Phase 3 (`apps/ml-worker` + `apps/backend/src/modules/ml`) est cassée
  depuis le refactor canaux — extract SQL en échec (`cs.channel` déplacé vers
  `channel_decision`), noms de canaux périmés (`EV`→VALUE, `CONF`→DOMINANT),
  codes ligue divergents (TS vs Python), modèle entraîné sur features
  pré-recalibration. Mode shadow → aucun impact money live, mais cron
  d'entraînement en échec depuis ~2 semaines. Chantier à traiter dans une
  nouvelle conversation, plan ordonné dans la doc.
- `[ ]` **[optionnel]** Exposer un backfill par fenêtre de dates, seulement si
  le rebuild par saisons via `ml-backfill` s'avère insuffisant.
- `[x]` **[ML] `ALL`/`BTTS:BTTS` actifs mais sans fichier `.pkl` exploitable —
  corrigé manuellement (2026-08-12)** — le reset "repartir de zéro" du 01/07
  (`docs/ml-worker-sync.md`) a recréé le volume `evcore_ml_models` sans
  désactiver ces 2 `ml_model_version` : ils sont restés `isActive=true` avec
  le meilleur Brier historique (donc jamais remplacés par le gate d'auto-
  switch à 5%, cf `ML_MIN_BRIER_IMPROVEMENT`), mais leur fichier avait
  disparu avec l'ancien volume — correction shadow silencieusement absente
  pour ces 2 segments depuis ~6 semaines, sans impact argent (shadow only)
  mais sans alerte non plus. Réactivés manuellement sur le meilleur candidat
  avec fichier présent (`ALL`→08/08, `BTTS:BTTS`→03/08) via la même
  transaction que `MlRepository.activate()`, puis `/reload` déclenché —
  confirmé en direct : 15/15 segments chargés sans warning.
  - `[ ]` **Garde-fou manquant** : rien ne vérifie qu'un modèle `isActive` a
    un fichier réellement présent sur le volume — un modèle "meilleur sur le
    papier" mais mort peut bloquer indéfiniment la promotion d'un modèle
    moins bon mais fonctionnel. Ajouter un health-check (ml-worker au
    démarrage/reload, ou cron backend) qui alerte si `isActive=true` sans
    fichier chargé.
  - `[ ]` **Anomalie non résolue** : 4 cycles d'entraînement `BTTS:BTTS`
    consécutifs (11/06→29/06) ont un `brierScore`/`sampleSize` strictement
    identiques (0.24129788209047515, n=1185) — l'extract n'a probablement pas
    vu de nouvelles données pendant 3 semaines, cohérent avec le bug
    d'extract SQL corrigé le 01/07 mais pas vérifié formellement. À creuser
    si le motif se reproduit.

- `[ ]` **[ML] Backtest de validation shadow vs baseline — potentiel très
  localisé, pas généralisable (2026-08-12)** — script
  `db:backtest:ml-shadow-correction` (nouveau, comparaison Brier walk-forward
  sur 9820 sélections rang 1 réglées, 06/07→11/08, sans re-fit). Sur 7
  segments avec n≥100 : **ML dégrade le Brier sur 5** (GOALS:OVER_UNDER,
  WIN_EITHER_HALF, TEAM_TOTAL_HOME, CLEAN_SHEET_HOME, TEAM_TOTAL_AWAY — ce
  dernier trio nettement, +0.03 à +0.055), **améliore sur 1 seul**
  (`DOMINANT:ONE_X_TWO`, n=825, Brier 0.277→0.232, confirmé stable sur les 30
  derniers jours). `CLEAN_SHEET:CLEAN_SHEET_AWAY` améliore mais gain
  négligeable (quasi bruit). `VALUE:ONE_X_TWO`/`VALUE:BTTS` prometteurs sur
  le papier mais n=67/n=8, non concluant. **`BTTS:BTTS` et `DRAW:ONE_X_TWO`
  absents du rapport** — zéro sélection réglée avec correction valide sur
  toute la période, confirmation directe de l'incident fichier manquant
  ci-dessus (pas juste suspect, réellement mort en pratique tout du long).
  - Conclusion : ne pas généraliser une promotion ML. Seul
    `DOMINANT:ONE_X_TWO` est un candidat sérieux, et encore : le ROI simulé
    n'a pas été vérifié (le script ne fait que Brier/calibration) — à faire
    avant toute activation réelle, plus définir un mécanisme de gouvernance
    (cap de poids façon OpenClaw ≤30%, pas un remplacement total) avant de
    brancher quoi que ce soit sur une vraie décision.
  - `[ ]` **Re-vérifier dans 2 semaines (~2026-08-26)** — surtout
    `BTTS:BTTS`/`DRAW:ONE_X_TWO` maintenant que leurs modèles sont réactivés
    (voir item ci-dessus) : voir si un historique de correction valide
    recommence à s'accumuler, et si `DOMINANT:ONE_X_TWO` reste stable une
    fois plus de données post-fix incluses.

- `[ ]` **`calibration_alert` : angle mort total sur OVER_UNDER/marchés de
  buts** (trouvé en post-mortem de coupon, 2026-08-13) — sur FC
  Nordsjaelland–Valur (Under 3,5 buts, coupon longshot 13-14/08, cassé 5-0+),
  `model_run.features` montrait `rawPoissonProbability.under35=0.486` vs
  `probabilities.under35=0.676` (calibré) : un écart de +19pp, du même ordre
  que les écarts de 0.25/0.225 qui ont fait exclure deux autres jambes du
  même coupon via `calibration_alert` (`favorite_flip`). Mais
  `assessMarketCoherence()` (`apps/backend/src/modules/betting-engine/
  market-coherence.ts`), seule source de `calibration_alert` (appelée une
  fois dans `betting-engine.service.ts:850-875`), ne prend en entrée que les
  probabilités 1X2 (home/draw/away) contre les cotes bookmaker — jamais les
  probabilités OVER_UNDER. Le shrinkage lui-même (`ou-shrinkage.ts`,
  `shrinkOverUnderProbabilities()`, config `OU_SHRINKAGE_CONFIG` par
  compétition) est volontaire et backtesté (shrinkage vers un taux de base
  ligue quand `factor` est bas, cf. `docs/data-poor-leagues-calibration.md`)
  — le bug n'est pas dans le calcul, il est dans l'absence totale de garde-
  fou : un swing de calibration goals, même énorme, ne peut jamais produire
  d'alerte ni d'exclusion du staking. Étendre `assessMarketCoherence`
  (ou un équivalent dédié) aux marchés OVER_UNDER avant de considérer ces
  picks aussi fiables que les picks 1X2 dans un coupon combiné.
- `[x]` **`under_high_lambda` ne couvrait que la ligne 2,5, pas 1,5/3,5/4,5 —
  corrigé le 2026-08-15** (post-mortem 2026-08-13) — `getPickRejectionReason()`
  (`packages/analysis-core/src/selection/pick-validation.ts`) ne rejetait que
  le pick littéral `"UNDER"` (convention = ligne 2,5) quand `lambdaTotal >=
  UNDER_HIGH_LAMBDA_THRESHOLD` (2.3). Sur Nordsjaelland–Valur, `lambdaTotal≈
  3.74` (largement au-dessus du seuil) mais le pick joué était `UNDER_3_5`,
  qui n'entrait jamais dans cette branche. Condition généralisée à tout pick
  `UNDER_*` du marché `OVER_UNDER` (`pick.pick.startsWith("UNDER")`). Seuil λ
  (2.3) laissé inchangé — une recalibration par ligne reste une piste séparée,
  pas un prérequis pour fermer ce trou de garde-fou.
- `[x]` **Résolution du bookmaker OVER_UNDER par marché entier, pas par
  ligne — perte silencieuse de candidats — corrigé le 2026-08-15** (post-mortem
  2026-08-13) — sur Nordsjaelland–Valur, la ligne 2,5 (`OVER`/`UNDER`)
  n'apparaissait **dans aucun** `evaluatedPicks` (ni `viable` ni `rejected`),
  alors que `odds_snapshot` contenait bien des cotes fraîches pour cette ligne
  (`OVER` 1.25 Unibet/1.28 Bet365, `UNDER` 3.40/3.42). Cause : `pickBestBookmaker`
  choisissait **un seul bookmaker pour tout le marché OVER_UNDER** (dernier
  timestamp toutes lignes confondues + meilleur rang bookmaker), puis
  `assembleFullOddsSnapshot` ne retenait que les lignes que CE bookmaker avait
  effectivement soumises — si le bookmaker choisi n'avait coté que 3,5/4,5 à
  ce moment précis (mais pas 2,5, coté par un autre bookmaker),
  `overUnderOdds["OVER"]`/`["UNDER"]` valaient `undefined` et le candidat
  était skippé silencieusement, **avant** d'atteindre `getPickRejectionReason`
  et le garde-fou `under_high_lambda` ci-dessus. Corrigé en résolvant le
  meilleur bookmaker **par ligne** (`resolveOverUnderOddsPerLine` /
  `findOverUnderOddsPerLine` dans `odds-snapshot.loader.ts`, appliqué aux deux
  chemins batché et single-fixture), avec tests de régression couvrant les
  deux. Les doublons observés dans `odds_snapshot` pour ce fixture sont un
  problème d'ingestion ETL séparé (cause racine trouvée et documentée
  ci-dessous), sans lien direct avec ce bug de résolution.
  - `[ ]` **Reste ouvert** : `findBestBookmakerForMarket` reproduit toujours
    la même granularité "marché entier" pour les autres marchés à lignes
    éparses (`TEAM_TOTAL_HOME/AWAY`, `RESULT_TOTAL_GOALS`, `RESULT_BTTS`,
    `CORRECT_SCORE`, `OVER_UNDER_HT`) — non corrigé dans cette passe, scope
    limité à `OVER_UNDER` (seul marché avec un incident confirmé en prod).
    À étendre si un incident similaire est confirmé sur l'un de ces marchés.
  - `[ ]` **`calibration_alert` reste sans garde-fou sur OVER_UNDER** —
    `assessMarketCoherence()` ne prend toujours en entrée que les probabilités
    1X2 ; non traité dans cette passe (extension de `assessMarketCoherence`
    à un nouveau marché, portée plus large qu'un fix de résolution de données).

## Audit systémique 2026-08-13 — même motif de bug, cherché et confirmé ailleurs

> Suite au post-mortem ci-dessus, on a explicitement cherché la même
> classe de bug (garde-fou/résolution de données écrit pour un cas précis,
> qui ne généralise pas silencieusement aux cas voisins soumis au même
> risque) dans tout `packages/analysis-core/src/selection`+`probability`
> et `apps/backend/src/modules/betting-engine`. Nous sommes en production
> réelle (pas au stade MVP) — ces éléments sont notés ici pour être
> traités proprement plutôt que corrigés à la volée dans cette session.

- `[~]` **Cause racine des doublons `odds_snapshot` trouvée — l'upsert ne
  fonctionne jamais** — `fixture.repository.ts` (`upsertNonOneXTwo:684-716`,
  `upsertOneXTwoOddsSnapshot:1095-1140`) font `prisma.oddsSnapshot.create()`
  et ne se rabattent sur find+update que si `isUniqueConstraintError`
  se déclenche. Mais la clé `[fixtureId, bookmaker, market, pick,
  snapshotAt]` (`packages/db/prisma/schema.prisma:816-817`) n'est définie
  qu'en `@@index`, jamais en `@@unique` — Postgres n'a donc jamais de
  raison de rejeter l'insert, l'erreur ne se déclenche jamais, et chaque
  resync ETL insère une ligne en double au lieu de mettre à jour l'existante.
  - `[x]` **Côté code, livré le 2026-08-13 (PR en cours)** — les deux
    fonctions font maintenant un vrai find-then-create/update explicite
    avant de tenter `create()` (le try/catch reste en repli pour la
    course critique). Corrige le flux applicatif immédiatement, sans
    attendre la migration.
  - `[ ]` **Reste à faire, côté toi** : ajouter la contrainte `@@unique`
    réelle sur cette clé en DB (migration Prisma — **jamais lancée
    directement dans cette session**, cf. mémoire migrations) pour fermer
    la fenêtre de course et empêcher tout futur doublon même en écriture
    concurrente.
- `[ ]` **Le bug "bookmaker par marché entier" existe en double, dans un
  chemin séparé** — `findBestBookmakerForMarket`
  (`odds-snapshot.loader.ts:346-369`) reproduit exactement la même
  granularité "marché entier, pas par ligne" que `pickBestBookmaker`
  (item ci-dessus), mais dans le chemin non-batché
  (`findLatestOddsSnapshot:371-491`) plutôt que le chemin batché
  (`assembleFullOddsSnapshot`). Corriger `pickBestBookmaker` sans corriger
  ce jumeau laisse le bug vivant sur toute la voie d'appel single-fixture.
- `[ ]` **`findLatestBestOneXTwoOddsSnapshot` fabrique une cohérence 1X2
  qui n'existe pas** (`odds-snapshot.loader.ts:938-1053`) — construit un
  faux bookmaker `'MarketBest'` en piochant `bestHome`/`bestDraw`/`bestAway`
  chez des bookmakers potentiellement différents (donc à des instants
  différents dans la fenêtre de requête), puis renvoie ça comme un seul
  snapshot cohérent. Risque inverse du bug de résolution ci-dessus :
  au lieu de perdre une donnée silencieusement, on fabrique une donnée qui
  n'a jamais existé telle quelle chez aucun bookmaker. À vérifier : est-ce
  qu'un appelant (calcul EV, overround) traite ce triplet comme une cote
  réelle d'un bookmaker unique ?
- `[~]` **Rapport hebdomadaire de risque limité au 1X2, `brierScore`
  hardcodé à 0** — `risk.service.ts:164-191` (`generateWeeklyReport`,
  le rapport humain envoyé par `sendWeeklyReport`) : `market:
  Market.ONE_X_TWO` en dur (ligne 170), `brierScore: 0` en dur (ligne 184).
  `checkMarketRoi`/`isMarketSuspended` (lignes 38-113) sont eux
  correctement génériques sur `Market` — seul le rapport de synthèse ne
  l'est pas. Tous les marchés non-1X2 (OVER_UNDER, BTTS, TEAM_TOTAL...)
  sont donc invisibles dans le seul rapport de risque humain, alors qu'on
  parie réellement dessus. Même angle mort "1X2-only" que
  `calibration_alert`, mais côté reporting cette fois.
  - `[x]` **`brierScore` corrigé le 2026-08-13 (PR en cours)** — calculé
    réellement sur les paris 1X2 réglés de la période (`computeBrierScore`,
    nouvelle fonction), au lieu du `0` en dur qui faisait croire à une
    calibration parfaite chaque semaine.
  - `[ ]` **Reste ouvert** : le rapport reste 1X2-only (`roiOneXTwo`,
    filtre `market: Market.ONE_X_TWO`) — étendre à tous les marchés
    demande de changer la forme de `WeeklyReportPayload` (impacte
    `notification.service.ts`, `mail.service.ts` et le template
    `@evcore/transactional`), volontairement laissé hors du fix "sûr"
    du 2026-08-13 vu l'ampleur du changement de contrat.
- `[x]` **Seuil de probabilité DRAW jamais appliqué en 1X2 — corrigé le
  2026-08-15** — `getPickRejectionReason` ne testait `minDirectionProbability`
  que pour `pick === "HOME"`/`"AWAY"` ; branche `DRAW` ajoutée (teste
  `probabilities.draw`, même pattern que HOME/AWAY). Défaut app-side
  volontairement séparé du défaut HOME/AWAY (0.45) : `MIN_DRAW_DIRECTION_
  PROBABILITY = 0.40` dans `ev.constants.ts`, identique au plancher générique
  `EV_MIN_PROBABILITY_THRESHOLD` déjà appliqué à tous les picks — **behavior
  no-op aujourd'hui** (840 tests inchangés), le seul changement réel est que
  le hook par ligue (`PICK_DIRECTION_PROBABILITY_THRESHOLD_MAP`) peut
  désormais cibler `ONE_X_TWO|DRAW` comme les autres entrées. Réutiliser le
  défaut HOME/AWAY (0.45) aurait quasiment suspendu le canal DRAW entier sans
  backtest (P(draw) dépasse rarement 35-40%) — délibérément évité.
- `[ ]` **Pénalité longshot limitée au 1X2** — `getOneXTwoLongshotPenalty`
  (`pick-validation.ts:127-153`) renvoie `1` (aucune pénalité) pour tout
  marché autre que `ONE_X_TWO` (ligne 132). Le raisonnement (la
  surestimation de probabilité gonfle l'EV à cote longue) n'est pourtant
  pas spécifique au 1X2 — `OVER_4_5`, les combos `RESULT_TOTAL_GOALS`
  (ex. `AWAY_UNDER_1_5`), `RESULT_BTTS`, `HALF_TIME_FULL_TIME` peuvent
  atteindre des cotes tout aussi longues sans aucun amortissement
  équivalent.
- `[x]` **`htftCalibrated` ne couvrait pas `OVER_UNDER_HT` — corrigé le
  2026-08-15** — le garde-fou suspendait `HALF_TIME_FULL_TIME`/
  `FIRST_HALF_WINNER` dans les ligues sans historique de décomposition
  mi-temps (risque de surestimation Poisson bivariée) ; `OVER_UNDER_HT`,
  construit à partir de la même décomposition (`probability/markets.ts`),
  n'était jamais vérifié contre `config.htftCalibrated`. Ajouté à la même
  branche — extension dans le sens "plus prudent" uniquement (suspend
  davantage, n'autorise jamais rien de nouveau), donc pas de backtest requis
  avant merge contrairement aux changements de seuil.
- `[ ]` **Le shrinkage O/U ne s'étend jamais à `TEAM_TOTAL_HOME/AWAY` ni
  `RESULT_TOTAL_GOALS`** — `OU_SHRINKAGE_CONFIG` (`ou-shrinkage.ts:28-49,
  59-309`) couvre O/U pleine durée, BTTS, O/U mi-temps par ligue (HT/FT et
  First-Half-Winner sont explicitement exclus par commentaire, volontaire).
  Mais `TEAM_TOTAL_HOME`/`TEAM_TOTAL_AWAY` (`pick-evaluation.ts:582-620`)
  et `RESULT_TOTAL_GOALS` (`pick-evaluation.ts:722-744`) dérivent des
  mêmes distributions Poisson par équipe que l'O/U — même surdispersion
  attendue en ligue pauvre en données — sans qu'aucun bloc de config, type
  de shrinkage ou commentaire ne les mentionne : ils ne sont pas exclus
  volontairement, juste absents. Ces marchés sortent donc en Poisson brut
  non-shrinké sur exactement les ligues où l'O/U reçoit un shrinkage
  agressif.
  - `[x]` **Impact confirmé en DB (2026-08-13)** sur `TEAM_TOTAL` pick
    `UNDER_1_5`, tout l'historique réglé : `TEAM_TOTAL_HOME` (n=1282) —
    taux de réussite réel 59,9% vs 70,2% de probabilité affichée
    (**-10,3pp**), EV moyen affiché +27,1%, **ROI réel mesuré +6,46%** ;
    `TEAM_TOTAL_AWAY` (n=880) — taux réel 65,6% vs 77,6% affiché
    (**-12,0pp**), EV moyen affiché +22,4%, **ROI réel mesuré +0,75%**
    (quasi nul malgré un EV affiché à +22%). Même motif que VALUE
    (probabilités surconfiantes) mais sans aucun garde-fou de shrinkage
    pour l'atténuer — cohérent avec l'absence totale de correction
    documentée ci-dessus. `TEAM_TOTAL_AWAY UNDER_1_5` est le candidat le
    plus urgent à corriger : c'est le marché qui casse le plus de coupons
    combinés récemment tout en semblant le plus fiable sur le papier.
- `[x]` **`selectSafeValuePick` : comparaison Over incomplète — corrigé le
  2026-08-13 (PR en cours)** — quand le pick SV gagnant est `UNDER_4_5` à
  λ élevé, les contreparties Over comparées (`pick-evaluation.ts:94-98`)
  ne couvraient que `"OVER"`/`"OVER_3_5"` (lignes plus basses) —
  `OVER_4_5`, la contrepartie la plus directement comparable à
  `UNDER_4_5`, n'était jamais incluse dans `overCounterparts` et
  disparaissait silencieusement de la comparaison. `OVER_4_5` ajouté à la
  liste des contreparties.

**Décision de scope à revisiter, pas un bug** — `adjustment.service.ts:19`
définit `CALIBRATION_MARKET = Market.ONE_X_TWO`, commenté explicitement
dans le code comme un choix de scope MVP intentionnel. Maintenant que le
produit tourne en argent réel (pas au stade MVP), cette limitation
volontaire mérite d'être réévaluée au même titre que les autres éléments
`ONE_X_TWO`-only trouvés ci-dessus — à traiter comme une décision produit,
pas comme une correction de bug.

- `[ ]` **[ETL] `model_run.features.injuries` semble non alimenté** (trouvé en
  analyse manuelle de coupon, 2026-08-14) — sur Heart of Midlothian–Benfica
  (Europa League, 3e tour qualif retour), `features.injuries` vaut
  `{"home": 0, "away": 0, "total": 0}` alors que Hearts jouait sans un seul
  défenseur central ni latéral valide (Halkett, Fagan-Walcott, Borchgrevink,
  Kingsley tous blessés — confirmé par la presse). Le modèle 1X2 (29,4% /
  20,4% / 50,2%) est calculé sans ce signal, ce qui a produit un pick VALUE
  (Double Chance 1X) qui semblait solide sur le papier (EV 0.30, cohérent
  avec DOMINANT à EV négatif) mais reposait sur une lecture incomplète.
  Vérifier si l'ETL blessures tourne encore (worker en échec silencieux ?),
  si la source de données blessures est vide pour cette compétition/ce
  niveau (Écosse, coupes européennes), ou si le champ n'a simplement jamais
  été câblé sur ce pipeline d'analyse. À creuser avant de refaire confiance
  aux picks sur des matchs avec un contexte de blessures significatif.
- `[ ]` **[ETL] AUS1 — trou d'intersaison, heuristique locale en retard d'un
  cran vs API-FOOTBALL** (mesuré en direct 2026-08-13 via `/leagues?id=188`) —
  API-FOOTBALL a déjà basculé son flag `current` sur la saison 2026-27
  (démarre 2026-10-16) alors que l'heuristique locale (mois courant <
  `seasonStartMonth`) reste sur 2025 jusqu'en octobre. Impact faible (se
  corrige seul en octobre, aucun match A-League d'ici là), mais même famille
  que le bug J1 résolu ci-dessus (Bloc 10 ROADMAP) — `fetchLeagueSeasonDates`
  corrige déjà les _dates_ de la saison correcte une fois `apiSeasonOverride`
  ou l'heuristique alignés sur le bon numéro, mais ne corrige pas le _choix_
  du numéro de saison lui-même pendant ce trou. Décider si ça vaut un
  `apiSeasonOverride` temporaire ou si on laisse courir (gain marginal).

---

## Checklist par nouveau canal (rappel méthode, doc §11)

hypothèse → `allowedMarkets` → critères `SELECTED` / codes de rejet → seuils
par ligue → implémentation → tests → **backtest séparé** → shadow/observation
→ activation par segment validé → settlement + métriques → API/front.
