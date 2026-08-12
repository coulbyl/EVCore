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
