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

- `[x]` **LONGSHOT_WEEKEND/MIDWEEK — pool dédié desserré** (résolu 2026-08-15) —
  `MAX_POOL_SIZE` était un module-level constant figé à 25, partagé par tous
  les profils ; nouveau champ optionnel `CouponProfileBounds.maxPoolSize`
  (`coupon.constants.ts`), utilisé dans `compose()` en override
  (`profile.maxPoolSize ?? MAX_POOL_SIZE`). `LONGSHOT_WEEKEND`/`MIDWEEK` passent
  à `maxPoolSize: 80` — cohérent avec leur fenêtre multi-jours (3 jours de
  matchs vs 1 pour les profils courts). Ne règle pas encore la starvation
  structurelle par anti-corrélation elle-même (hors scope, non signalée comme
  buggée) ; laisse toujours ouverts :
  - `[ ]` Laisser accumuler des règlements réels avant d'envisager un backtest
    (`composeGreedy` n'a jamais tourné en prod avant le 2026-08-09).
  - `[ ]` Écrire `db:backtest:coupon-longshot` une fois assez de coupons réglés
    — mesurer le hit-rate du coupon complet vs cote, pas juste par jambe.
  - `[ ]` Ne retirer le badge "Expérimental" qu'après un backtest vert
    (split train/valid).

- `[~]` **`jointProbability` surconfiant — mécanique posée, facteur neutralisé
  après backtest** (2026-08-15) — audit 2026-08-12 (409 `CouponProposal`
  réglés) : bucket ~44% annoncé → 20% réel sur **un seul bucket**, n=30. Le
  produit brut des probas par jambe (`buildCoupon`) ne corrige pas la
  corrélation entre jambes. `calibrateJointProbability()`
  (`coupon-composer.service.ts`) applique un facteur multiplicatif
  (`JOINT_PROBABILITY_CORRELATION_FACTOR`, `coupon.constants.ts`) PARTOUT
  (filtre de viabilité + EV + Kelly + persistance) — un shrinkage bayésien
  façon `calibrate()` a été écarté (traiter un coupon comme "1 observation"
  face à un `k` calibré sur de vrais échantillons pondérés l'aurait écrasé
  vers le prior, recréant le bug dégénéré déjà corrigé par
  `LEG_PROBABILITY_MODEL_WEIGHT`).
  **Recalibré le jour même** : nouveau script
  `db:backtest:joint-probability-calibration` (410 `CouponProposal` réglés,
  train/valid 60/40 par jour) — verdict net : `factor=1.0` (système
  historique, sans correction) est le SEUL testé qui reste positif des deux
  côtés (train +30.0%, valid +22.9%, n≥20) ; `0.8`/`0.7` inversent de signe
  entre train et valid (non actionnable) ; le facteur initialement choisi
  (0.4545, ratio direct de l'audit) élimine **tout** l'historique des seuils
  actuels (n=0 des deux côtés) — confirmé indépendamment par un replay complet
  08-13→08-16 avec le moteur actuel (reanalyze-scope.ts + regénération), qui
  donnait déjà 0 coupon viable sur les 4 jours avec ce facteur. **Conclusion :
  le biais du bucket ~44% ne généralise pas** — appliquer un facteur global
  sur-corrige et élimine un historique par ailleurs rentable. `factor` remis à
  `1.0` (no-op) le temps qu'une calibration par bucket existe ; le mécanisme
  (fonction, branchement filtre/EV/Kelly/persistance, champ
  `rawJointProbability` tracé séparément) reste en place pour la recevoir.
  - `[ ]` Construire une vraie calibration **par bucket de probabilité** (pas
    un facteur global) — le bucket ~44% peut rester spécifiquement biaisé sans
    que ça généralise à tout le reste.
  - `[ ]` Étendre `db:backtest:joint-probability-calibration` à un vrai rejeu
    (limite documentée en tête du script : `calibratedProbability` par jambe
    reflète le modèle en vigueur à la génération de CHAQUE coupon historique,
    pas le modèle actuel).

- `[x]` **Jambe partagée entre coupons classés (rank 1/2/3+) — zéro tolérance**
  (résolu 2026-08-15, trouvé en creusant le fix PARTIAL/VOID ci-dessous) — la
  règle de diversité inter-coupons (`selectDiverseCoupons`) tolérait jusqu'à
  50% de jambes partagées, ce qui laissait passer une jambe partagée dès
  qu'un coupon avait ≥3 jambes (1/3≈0.33<0.5) — cause directe de l'incident
  du 08-15 (jambe TEAM_TOTAL_HOME dans rank 1 ET rank 2, tous deux LOST).
  Fix : `sharesAnyLeg()` remplace le ratio par une tolérance zéro (tout
  partage rejette), et le backfill qui réintroduisait une jambe partagée pour
  toujours publier `maxCoupons` a été supprimé — décision utilisateur : ne
  plus garantir un compte fixe, publier autant de coupons disjoints que le
  pool le permet réellement, plafonné par un `maxCoupons` relevé de 3 à 10
  (garde-fou haut, pas un objectif).

- `[ ]` **Pondération des signaux leg-level dans `signalScore`** —
  `priorAnalysisCount`, `offensiveBalance`, `shadowConflict` sont exposés mais
  n'influencent rien (`coupon-composer.service.ts:310` : formule limitée à
  `windowRate`/`dowRate`/`leagueRate`). Re-vérifié 2026-08-15
  (`db:backtest:coupon-quality-signals`) : toujours `train n=0` sur les 3
  signaux (seul le valid period a du volume, 45-406 selon le signal) — pas
  assez de recul depuis leur ajout, inchangé depuis le 08-09. Relancer le
  script périodiquement ; ne pondérer que si train ET valid confirment.

- `[ ]` **FADE (pick inverse sur divergence extrême)** —
  `COUPON_ENFORCE_AVOID_FADE=false`, signal le mieux corroboré du backtest qualité
  (train +18%/valid +20%) mais n=15-17 à peine au-dessus du seuil minimal.
  Revalider avec plus de données avant d'activer.

- `[ ]` **VALUE — hit-rate en dégradation dans les coupons, à instruire par
  backtest dédié** (trouvé 2026-08-15, suite à un replay 08-13→08-16 montrant
  beaucoup de LOST) — sur 483 jambes VALUE réglées en coupon (split temporel
  60/40 par jour) : train n=288 hit=50.3%/ROI jambe seule +16.5%, valid n=195
  hit=**39.0%**/ROI +6.7%. Dégradation nette du hit-rate dans le temps, ROI
  jambe-seule toujours positif mais en baisse. Pas un signal "VALUE est
  mauvais" — VALUE reste rentable pris isolément (l'edge compense un
  hit-rate plus bas par construction) — mais un hit-rate qui se dégrade pèse
  disproportionnellement sur la probabilité JOINTE d'un coupon (toutes les
  jambes doivent gagner). `CANAL_BASE_WEIGHT.VALUE=0.36` est déjà le plus bas
  des canaux coupon, mais aucun backtest dédié n'a testé si c'est encore
  assez bas vu cette dérive. Comparaison : SAFE stable en hit-rate (61.8%
  train et valid) mais ROI jambe seule devenu négatif en valid (+2.6%→-9.8%,
  cotes trop courtes pour compenser le vig même à haute probabilité).
  - `[ ]` Backtest dédié : `CANAL_BASE_WEIGHT.VALUE` réduit et/ou un plancher
    d'edge plus strict spécifiquement pour VALUE-en-coupon (distinct du
    `VALUE_MIN_EDGE` standalone déjà appliqué via `clearsValueEdgeFloor`) —
    mesurer l'effet sur le ROI de coupon complet, pas juste par jambe.
  - `[ ]` Vérifier si la dégradation du hit-rate VALUE coïncide avec une
    période/changement identifiable (nouveau marché, config, ligue) plutôt
    que de la traiter comme une dérive générique.

- `[x]` **Jambe coin-flip glissée dans un coupon via un EV gonflé — plancher de
  probabilité ajouté** (résolu 2026-08-15, trouvé en creusant le point
  VALUE ci-dessus sur le replay 08-13→08-16) — rank 3 du 08-15 associait
  `Kashima OVER_0_5 HT` (SAFE, 77.2%, GAGNÉ) à `Ljungskile-Osters RESULT_BTTS
  HOME_NO` (VALUE, **43.4%** — sous 50%, PERDU). La jambe VALUE passait déjà
  `clearsValueEdgeFloor` (edge=0.167≥0.10) grâce à un EV apparent énorme
  (+62.7%, cote 3.75) — rien ne vérifiait que la jambe elle-même était plus
  probable que défavorable. Fix : nouveau `clearsMinLegProbability()`
  (`coupon-composer.service.ts`), plancher `MIN_LEG_PROBABILITY=0.55`
  (`coupon.constants.ts`) sur TOUTES les jambes (pas seulement VALUE) —
  valeur reprise du seuil déjà utilisé par le processus d'analyse manuel
  (`COUPON_ANALYSIS_TEMPLATE.md`, Étape 0 : "probability ≥ ~55-60%"), pas
  backtestée pour le composeur automatique. Effet vérifié en replay : plus
  aucune jambe sous 50% dans les coupons régénérés, volume réduit (7 coupons
  sur la plage contre 18 avant ce fix précis). **Le taux de réussite global
  sur cette fenêtre reste dominé par du LOST** — normal sur un échantillon de
  5 coupons réglés (variance), pas un signal que le fix ne marche pas ; ce
  fix corrige un mécanisme précis (jambe coin-flip masquée par un EV gonflé),
  pas une garantie de coupon gagnant.
  - `[ ]` Backtester la valeur exacte de `MIN_LEG_PROBABILITY` (55% choisi par
    précédent documentaire, pas par backtest composer) une fois assez de
    coupons réglés sous ce nouveau plancher.

- `[x]` **Pool candidat construit sur un tri à plat (signalScore canal×jour×ligue)
  — mix ancre/valeur ajouté** (2026-08-16, suite directe du point ci-dessus)
  — `signalScore` est une moyenne canal×jour-de-semaine×ligue : deux jambes
  du même (canal, ligue, jour) ont EXACTEMENT le même score, aucune ne
  regarde le match précis. `priorAnalysisCount`/`offensiveBalance`/
  `shadowConflict` existent sur `ScoredPick` mais n'influençaient ni le tri ni
  la sélection. Confirmé structurel : aucun plafond par canal n'existait avant
  `MAX_POOL_SIZE=25` — un canal à fort `CANAL_BASE_WEIGHT` (SAFE) peut noyer
  tous les autres avant même la recherche combinatoire.
  `COUPON_ANALYSIS_TEMPLATE.md` (Étape 0) documente la méthode manuelle qui
  marche : ne jamais trier par un seul critère, mélanger des jambes-**ancres**
  (70-90%+, portent la proba jointe) et des jambes-**valeur** (60-75%,
  meilleure cote, portent la cote combinée), diversifiées par championnat
  avant de merger. Le composeur automatique n'implémentait que le mode valeur
  seul.
  Fix (`coupon-composer.service.ts`, `coupon.constants.ts`) : `buildCandidatePool()`
  remplace le tri à plat — partition ancre (`legProbability≥ANCHOR_MIN_PROBABILITY=0.70`)
  / valeur, EV plafonné à `EV_MAX_SOFT_ALERT` (réutilisé de `betting-engine/
  ev.constants.ts`, pas un nouveau chiffre) pour le tri du mode valeur
  uniquement (pas un rejet), diversification par compétition
  (`MAX_POOL_PER_COMPETITION=2`, même chiffre que le plafond anti-corrélation
  intra-coupon existant), allocation ~50/50 ancre/valeur avec backfill
  (jamais de slot de pool gâché). `depthRank()` (nouveau) sert de tie-break
  sur les 3 signaux de profondeur — PAS un poids/seuil (toujours bloqué par
  `train n=0`), juste un ordre de préférence, même catégorie "no backtest
  needed" que `comparePicksBySignalThenProbability`/la règle zéro-partage.
  Ne touche à aucun seuil de viabilité (EV/cote/proba jointe) déjà backtestés.
  **Vérifié en replay** sur les 2 seuls jours 100% réglés de la fenêtre
  08-13→08-16 (les autres ont des résultats incomplets dans cette base
  locale) : 2 coupons GAGNÉS sur 3 (mix SAFE+TEAM_TOTAL, SAFE+VALUE,
  SAFE+TEAM_TOTAL sur des ligues distinctes) — première fois de la session
  qu'un replay produit un coupon gagnant avec le nouveau code. n=3, encore
  trop petit pour conclure statistiquement, mais un vrai changement de motif
  vs le tout-LOST observé avant ce fix.
  - `[ ]` Backtester les poids exacts de `depthRank` et `ANCHOR_MIN_PROBABILITY=0.70`
    une fois assez de coupons réglés sous ce nouveau mécanisme.
  - `[ ]` Élargir la fenêtre de replay (au-delà de 08-13/08-14, seuls jours
    100% réglés dans cette base locale) pour un vrai signal statistique sur
    le taux de réussite.

- `[x]` **Pool de coupon élargi à `evaluatedPicks` — cause racine du "surface
  pas profondeur"** (2026-08-16, en creusant le biais suspecté dans
  `SignalWindowService`) — `getPoolForRange()` (le VRAI pool du générateur de
  coupon) ne lisait que les `Bet`/`channelDecision` déjà matérialisés : une
  seule jambe par canal par match, celle que l'algorithme de sélection
  standalone du canal a déjà choisie. Jamais les autres marchés évalués sur
  le même match. Or `model_run.features.evaluatedPicks` (tous les marchés
  évalués, viables ET rejetés) existe déjà et est même déjà utilisé — mais
  seulement par la fonction sœur `getTodayVirtualPool` (pool jamais staké),
  jamais par le vrai pool. Exactement le trou documenté par
  `COUPON_ANALYSIS_TEMPLATE.md` (Étape 0).
  Confirmé : `status: 'viable'` a déjà passé les gates du système (proba
  plancher, cote dans la fourchette, marché non suspendu, EV correct, pas de
  pénalité longshot) — ne pas avoir gagné l'arbitrage de son canal contre un
  autre marché du même match n'est pas un rejet de fiabilité. Pas besoin de
  re-dériver la logique de sélection des 6 canaux (certains inter-dépendants,
  ex. SAFE exclut le pick de VALUE) contre le snapshot persisté.
  Fix : `resolveEvaluatedMarketLeg()` (`signal-window.service.ts`, fonction
  pure testée isolément) + `EVALUATED_MARKET_CANAL` (`coupon.constants.ts` —
  ONE_X_TWO→DOMINANT, TEAM_TOTAL_HOME/AWAY→TEAM_TOTAL, BTTS→BTTS, le reste→
  VALUE, CORRECT_SCORE exclu car signal immature). Dédupliqué contre les
  jambes déjà stakées, AVOID appliqué (FADE traité comme DROP ici, pas de
  construction de jambe opposée pour un marché arbitraire). Nouveau champ
  `ScoredPick.pickSource: 'STAKED'|'EVALUATED'` (traçabilité, **pas encore
  persisté en DB** — à faire si un futur backtest STAKED vs EVALUATED en a
  besoin).
  Effet de bord : **DOMINANT** (canal réel, jamais lu dans le vrai pool
  jusqu'ici — confirmé 0 jambe DOMINANT dans tout l'historique
  `coupon_proposal_leg`) peut désormais y contribuer via ONE_X_TWO.
  **Décision produit (2026-08-16)** : pas de flag caché — contrairement au
  plan initial (`COUPON_INCLUDE_EVALUATED_MARKETS`, défaut off), le
  mécanisme est activé directement dans `CouponService` sans variable
  d'environnement. Philosophie explicite de l'utilisateur : ne pas gater
  les fonctionnalités derrière des flags qu'il n'a pas le temps de suivre
  activement — les laisser vivre et améliorer selon le résultat observé.
  Même décision appliquée rétroactivement à `stakeDraw`/`stakeTeamTotal`/
  `stakeBtts`/`enforceAvoid`/`enableAvoidFade` (retirés des flags
  `ConfigService`, hardcodés actifs) — seul `KELLY_ENABLED` reste un vrai
  flag (frontière de phase produit explicite, `CLAUDE.md`).
  Vérifié en replay 08-13/08-14 avec un diagnostic temporaire (fichier de log,
  retiré après coup) : le mécanisme s'exécute bien — **88 nouvelles jambes**
  entrées dans le pool, dont **23 avec probabilité brute ≥55%** sur des
  marchés jusqu'ici jamais candidats (RESULT_TOTAL_GOALS, DOUBLE_CHANCE,
  WIN_TO_NIL, DRAW_NO_BET, BTTS NO, CLEAN_SHEET...). Mais **0 jambe
  `EVALUATED` n'a fini dans un coupon publié** sur ces 2 jours — creusé plus
  loin, cause identifiée et **pas anecdotique** :
  **Cause racine trouvée** : la plupart des marchés empruntés sont mappés
  vers le canal VALUE (`EVALUATED_MARKET_CANAL`), qui applique la même
  formule de mélange 50/50 (`calibratedLegProbability`) que les jambes
  VALUE stakées normalement — `probability×0.5 + windowRate_VALUE×0.5`. Or
  `windowRate_VALUE` est actuellement bas (~0.365-0.369, mesuré directement
  sur les jambes VALUE stakées de cette période) à cause de la dégradation
  VALUE déjà trouvée plus haut (50.3%→39.0%). Résultat concret : `Omonia
  Nicosia–Lincoln CLEAN_SHEET_HOME NO` (68.7% de proba brute, EV=0.80,
  `viable`, jamais stakée) se retrouve calibrée à **0.527 — sous le plancher
  `MIN_LEG_PROBABILITY=0.55`** malgré un signal brut fort. Ce n'est pas un
  bug isolé du nouveau mécanisme : c'est la dégradation VALUE (item
  ci-dessus) qui se propage à toutes les jambes "empruntées" routées vers ce
  canal, qu'elles aient ou non un bon signal sur leur match précis.
  - `[ ]` **Reconsidérer le mapping/la formule pour les marchés empruntés** —
    router tout vers VALUE leur fait hériter du blend dégradé de VALUE même
    quand leur propre fiabilité (calibration marché, pas canal) serait
    meilleure. Piste : un blend spécifique aux marchés evaluated (pas la
    moyenne canal VALUE), ou un mapping plus fin que "tout le reste → VALUE".
  - `[ ]` Persister `pickSource` en DB si un futur backtest STAKED vs
    EVALUATED en a besoin.
  - `[ ]` Mesurer le ROI réel des jambes `EVALUATED` une fois assez de
    coupons réglés avec ce mécanisme actif — mais résoudre d'abord le point
    ci-dessus, sinon la mesure restera artificiellement à ~0 (jambes toujours
    filtrées avant même d'entrer en compétition).

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

- `[x]` **Agrégats ROI/summary ignorent silencieusement `PARTIAL`/`VOID` —
  corrigé** (résolu 2026-08-15) — `coupon-summary.service.ts`,
  `coupon-indices.service.ts` et `coupon.repository.ts` ne filtraient que
  `WON`/`LOST`. Fix en 2 parties :
  1. Nouveau champ `CouponProposal.realizedOdds` (Decimal nullable, migration
     `20260815150000_add_coupon_proposal_realized_odds` — **écrite, pas
     lancée, à exécuter côté utilisateur** comme les migrations précédentes) —
     recalculé par `CouponSettlementService.settleProposal` comme le produit
     des cotes des seules jambes NON voidées (`productDecimal`, nouveau
     helper decimal.js dans `decimal.utils.ts`) ; égal à `combinedOdds` sur un
     WON sans void, strictement inférieur sur un PARTIAL. `combinedOdds`
     lui-même n'est jamais modifié (reste la cote proposée à l'origine).
  2. Les 3 vues incluent désormais `PARTIAL` (`IN (WON, LOST, PARTIAL)`,
     `VOID` reste exclu) et calculent le gain sur `realizedOdds ?? combinedOdds`
     — jamais la cote pleine d'origine pour un coupon partiellement voidé.
  **Reste à faire** : lancer la migration côté utilisateur (`prisma migrate` +
  `db generate`, cf. règle mémoire) — en attendant, `realizedOdds` cause 2
  erreurs de typecheck attendues sur le type Prisma généré (pas encore
  régénéré).

- `[ ]` **Calibration `k`/`decayHalfLifeDays`/`windowDays`** — mesurée
  (`db:backtest:signal-window-calibration`), gain réel mais marginal et pas
  appliqué (compromis réactivité vs stabilité). À reconsidérer seulement si ces
  valeurs semblent un jour concrètement mauvaises en usage.

---

## Couverture stratégie par marché (nouveau chantier, 2026-08-15)

> Objectif produit : EVCore doit avoir une **bonne stratégie sur chaque
> marché**, pas seulement sur ceux qui ont un canal dédié — être la
> meilleure plateforme d'analyse de stratégie, pas juste sur une poignée de
> marchés porteurs.

- `[ ]` **Marchés dormants — jamais vus sur les interfaces, aucun canal
  dédié** — audit rapide du `Market` enum (17 valeurs) vs les fichiers
  `*.strategy.ts` existants (`packages/analysis-core/src/strategies/`) :
  seuls ONE_X_TWO (DOMINANT/DRAW), OVER_UNDER (GOALS), BTTS (BTTS/NO),
  TEAM_TOTAL_HOME/AWAY (TEAM_TOTAL), CLEAN_SHEET_HOME/AWAY (CLEAN_SHEET),
  TO_WIN_EITHER_HALF (WIN_EITHER_HALF) et CORRECT_SCORE ont un canal dédié.
  Les autres ne sont atteignables que si VALUE les choisit opportunément
  (meilleur EV du pool, `ALL_MARKETS` dans `value.strategy.ts`) — jamais de
  stratégie propre, jamais de canal observation dédié, jamais visibles sur
  les interfaces :
  - **DOUBLE_CHANCE**
  - **HALF_TIME_FULL_TIME**
  - **OVER_UNDER_HT**
  - **FIRST_HALF_WINNER**
  - **DRAW_NO_BET**
  - **WIN_TO_NIL_HOME/AWAY**
  - **RESULT_TOTAL_GOALS**
  - **RESULT_BTTS**
  À faire : revue complète de chaque `*.strategy.ts` existant (cohérence,
  dette), puis évaluer marché par marché s'il mérite un canal dédié
  (hypothèse → backtest séparé → observation → whitelist par ligue →
  staking, même méthode que le "Checklist par nouveau canal" en bas de ce
  fichier) plutôt que de rester une sélection opportuniste sans stratégie
  propre.
  **Connexion trouvée 2026-08-16** (élargissement du pool de coupon à
  `evaluatedPicks`, section Générateur de coupon) : router tous ces marchés
  "orphelins" vers le canal VALUE pour le pool de coupon leur fait hériter
  du blend de calibration dégradé de VALUE (`windowRate≈0.37` actuellement)
  — écrasant des jambes à signal individuellement fort (ex.
  `CLEAN_SHEET_HOME NO` à 68.7% de proba brute calibré à 0.527, sous le
  plancher). Direction proposée par l'utilisateur : ériger chaque marché
  orphelin en canal/stratégie propre (sa propre calibration, pas celle de
  VALUE) plutôt que de continuer à les faire dépendre du blend d'un canal
  qui ne leur correspond pas — réglerait ce point ET le chantier ci-dessus
  en même temps.

- `[~]` **RESULT_TOTAL_GOALS — premier marché orphelin sorti de VALUE, canal
  dédié en OBSERVATION** (2026-08-16) — premier candidat traité parmi les 8
  ci-dessus : le seul qui avait déjà une calibration walk-forward Brier-validée
  en prod (`backtest-result-total-goals-shrinkage-calibration.ts`,
  `OU_SHRINKAGE_CONFIG[code].resultTotalGoals`), donc aucun nouveau modèle de
  probabilité à construire — seulement un canal autour d'une donnée déjà
  fiable. Ne couvre que le pick UNDER (seule probabilité jointe directement
  régressée ; OVER = `oneXTwo[side] − shrunkUnder`, dérivé, pas validé
  indépendamment). `getResultTotalGoalsLineConfigs()`
  (`packages/analysis-core/src/strategies/config.ts`) dérive mécaniquement sa
  table par ligue depuis `OU_SHRINKAGE_CONFIG` (pas d'audit manuel séparé comme
  TEAM_TOTAL à son lancement) : `threshold = base × 0.85` (marge relative
  15%, la soustraction plate de TEAM_TOTAL `base − 0.05` ne transpose pas ici —
  bases joint ~0.03–0.44 vs marginales ~0.5). `ResultTotalGoalsStrategy`
  (`result-total-goals.strategy.ts`) mirrors exactement `TeamTotalStrategy` :
  1 sélection max, tri par EV décroissant, `REJECTED reasonCode:
  below_threshold` sinon. **OBSERVATION mode strict, comme TEAM_TOTAL à son
  lancement** : aucun wiring `CouponChannel`/`CANAL_BASE_WEIGHT`/invest/
  frontend — seulement stratégie + config + enregistrement channel + tests.
  `StrategyChannel` (Prisma `schema.prisma`) gagne une valeur `RESULT_TOTAL_GOALS` ;
  migration écrite (`20260816120000_add_result_total_goals_channel`), **pas
  lancée** (règle projet : CLI utilisateur). Tant qu'elle n'est pas appliquée +
  `prisma generate` relancé, `domain-enums.conformance.spec.ts` échoue de
  façon attendue (garde anti-drift compile-time/runtime entre l'enum domaine
  et l'enum Prisma généré) — le reste de la suite est vert (892/893).
  - `[x]` Migration lancée + `db generate` régénéré côté utilisateur
    (2026-08-16) — `domain-enums.conformance.spec.ts` repasse au vert, suite
    complète 922/922.
  - `[ ]` Laisser accumuler des décisions RESULT_TOTAL_GOALS réglées avant tout
    backtest ROI dédié ou wiring coupon/invest — même séquence que TEAM_TOTAL
    (observation d'abord, ROI ensuite).
  - `[ ]` Une fois ce marché validé/observé, traiter les marchés orphelins
    restants un par un avec la même méthode (celui qui a déjà le plus de
    plomberie calibrée en premier).

- `[~]` **OVER_UNDER_HT — deuxième marché orphelin sorti de VALUE, canal
  dédié en OBSERVATION** (2026-08-16) — deuxième candidat traité : déjà
  partiellement exposé via `SafeStrategy.allowedMarkets` (filtre secondaire),
  jamais de canal propre jusqu'ici. Comme RESULT_TOTAL_GOALS, aucun nouveau
  modèle de probabilité : `OU_SHRINKAGE_CONFIG[code].ouHt` est déjà
  walk-forward Brier-validé et en prod. Contrairement à RESULT_TOTAL_GOALS
  (probabilité jointe), les bases `ouHt` sont des probabilités marginales
  (OVER/UNDER complémentaires, même grandeur que GOALS/TEAM_TOTAL) — donc
  `getOverUnderHtLineConfigs()` réutilise exactement la règle de curation de
  TEAM_TOTAL (pas celle de RESULT_TOTAL_GOALS) : side=OVER si base≥0.55,
  UNDER si base≤0.45, bande 0.45–0.55 ignorée (non informative), threshold =
  (base du côté choisi) − 0.05. `OverUnderHtStrategy` mirrors `GoalsStrategy`/
  `TeamTotalStrategy` (1 sélection max, tri EV décroissant, `REJECTED
  reasonCode: below_threshold`). OBSERVATION stricte, même périmètre que
  RESULT_TOTAL_GOALS (aucun wiring coupon/invest/frontend). `StrategyChannel`
  (Prisma) gagne `OVER_UNDER_HT` ; migration écrite
  (`20260816130000_add_over_under_ht_channel`), **pas lancée**. Suite verte
  hors `domain-enums.conformance.spec.ts` (attendu, même garde anti-drift
  — 902/903).
  - `[x]` Migration lancée + `db generate` régénéré côté utilisateur
    (2026-08-16) — suite complète 922/922.
  - `[ ]` Même séquence que TEAM_TOTAL/RESULT_TOTAL_GOALS : observer avant
    tout backtest ROI ou wiring coupon/invest.

- `[~]` **RESULT_BTTS — troisième marché orphelin sorti de VALUE, canal
  dédié en OBSERVATION** (2026-08-16) — cité explicitement plus haut
  (section Générateur de coupon) comme preuve concrète de dommage (jambe
  Ljungskile-Osters RESULT_BTTS HOME_NO à 43.4%, PERDU). Contrairement à
  RESULT_TOTAL_GOALS/OVER_UNDER_HT, **aucune calibration walk-forward
  n'existe pour ce marché** — même situation que TEAM_TOTAL à son lancement
  du 2026-07-18, donc même méthode : taux de base dérivés directement des
  scores réglés (`docker exec evcore-postgres psql`, règle CLAUDE.md), pas de
  `OU_SHRINKAGE_CONFIG` à réutiliser. Requête : pour chaque fixture
  `FINISHED`, taux joint = compte(résultat×BTTS) / compte(total fixtures
  réglées de la ligue). 67 ligues avec n≥50 fixtures ; 381 combos
  (side×outcome) retenus sur 402 possibles après un plancher **par pick**
  n≥30 (une combinaison précise comme DRAW+YES peut être bien plus rare que
  le total de la ligue). `threshold = base × 0.85` — réutilise la règle
  RESULT_TOTAL_GOALS (marge relative), pas celle de TEAM_TOTAL, car ce sont
  des probabilités jointes (~0.03–0.37) comme RESULT_TOTAL_GOALS, pas des
  marginales. Contrairement à TEAM_TOTAL (split OVER/UNDER, un seul retenu),
  les 6 combos (side×YES/NO) sont tous inclus par ligue : chaque combo est un
  marché bookmaker distinct et indépendamment pricé, pas de bande
  "non-informative" à exclure comme le 0.45–0.55 de TEAM_TOTAL.
  `ResultBttsStrategy` mirrors `ResultTotalGoalsStrategy` (1 sélection max,
  tri EV décroissant). OBSERVATION stricte, même périmètre que les deux
  précédents (aucun wiring coupon/invest/frontend). `StrategyChannel` (Prisma)
  gagne `RESULT_BTTS` ; migration écrite
  (`20260816140000_add_result_btts_channel`), **pas lancée**. En creusant les
  tests existants : deux fixtures partagées (`channel-decision.service.spec.ts`,
  `channel-strategy.orchestrator.spec.ts`) construisaient un objet
  `MatchProbabilities` synthétique incomplet (sans `resultBtts`/`ouHT`/
  `resultTotalGoals`, alors que ces champs sont non-optionnels en prod,
  toujours peuplés par `computeResultBttsProba`/Poisson) — RESULT_BTTS est le
  premier des 3 nouveaux canaux à réellement lire ces champs sur la ligue
  `BL1` de ces fixtures (les deux précédents y étaient `DISABLED` faute de
  config BL1, donc le trou ne s'était jamais révélé) ; fixtures corrigées,
  pas de garde défensive ajoutée dans le code prod (le type garantit déjà le
  contrat). Suite verte hors `domain-enums.conformance.spec.ts` (attendu —
  911/912 à l'écriture, 922/922 après migration).
  - `[x]` Migration lancée + `db generate` régénéré côté utilisateur
    (2026-08-16) — les 3 migrations (RESULT_TOTAL_GOALS + OVER_UNDER_HT +
    RESULT_BTTS) passent ensemble, suite complète verte.
  - `[ ]` Même séquence que les canaux précédents : observer avant tout
    backtest ROI ou wiring coupon/invest. Vu l'absence de calibration
    walk-forward ici, envisager un script `backtest-result-btts-shrinkage-
    calibration.ts` (même modèle que TEAM_TOTAL) une fois assez de volume
    RESULT_BTTS réglé pour un vrai split train/test.

- `[~]` **DRAW_NO_BET — quatrième marché orphelin sorti de VALUE, canal
  dédié en OBSERVATION** (2026-08-16) — marché dérivé à deux issues (nul
  remboursé), sans dimension de ligne, purement dérivé du 1X2 déjà calibré
  (`dnbHome`/`dnbAway`, complémentaires). Comme RESULT_BTTS, aucune
  calibration walk-forward n'existe — taux de base dérivés directement des
  scores réglés (`docker exec evcore-postgres psql`) : parmi les fixtures
  `FINISHED` décisives (hors nul), taux de victoire domicile = compte(victoire
  domicile) / compte(décisives) par ligue. **Avantage domicile universel** —
  67 ligues avec n≥50 fixtures décisives, taux minimum observé 0.51, jamais
  en dessous : l'issue AWAY ne dépasse jamais une marge informative dans ce
  jeu de données (constat réel, pas un choix arbitraire). Seuil retenu : 64
  ligues avec taux≥0.55 (0.45–0.55 ignoré comme non informatif — AUS1, EST1,
  KOR2 exclues), `threshold = taux − 0.05` (marge plate façon TEAM_TOTAL, pas
  la marge relative de RESULT_TOTAL_GOALS/RESULT_BTTS : `dnbHome`/`dnbAway`
  sont de vraies marginales ~0.5-0.7, pas des probabilités jointes).
  Architecture différente des 3 canaux précédents : pas de config par
  (side, line) façon TEAM_TOTAL — `decideDrawNoBet` réutilise directement le
  schéma `decideCleanSheet` (évalue les deux côtés contre un seuil unique
  partagé, argmax) puisque `dnbHome`+`dnbAway`=1 rend la pré-sélection de
  côté par ligue inutile : quel que soit le côté qui dépasse un seuil >0.5,
  c'est sans ambiguïté le bon. Table de config gardée séparée de
  `CHANNEL_STRATEGY_CONFIG` (réutilisé par DOMINANT/DRAW/BTTS/CLEAN_SHEET/
  WIN_EITHER_HALF) plutôt que fusionnée dedans : ces entrées sont de vrais
  seuils **backtestés ROI**, alors que DRAW_NO_BET est un lancement
  OBSERVATION sur taux de base brut — mélanger les deux aurait dilué le
  niveau de confiance de la table existante. OBSERVATION stricte, même
  périmètre que les 3 canaux précédents. `StrategyChannel` (Prisma) gagne
  `DRAW_NO_BET` ; migration écrite
  (`20260816150000_add_draw_no_bet_channel`), **lancée + `db generate`
  régénéré le jour même** — suite complète verte (922/922), aucune migration
  en attente à ce stade.
  - `[x]` Migration lancée + `db generate` régénéré côté utilisateur
    (2026-08-16) — suite complète verte.
  - `[ ]` Même séquence que les canaux précédents : observer avant tout
    backtest ROI ou wiring coupon/invest.

- `[~]` **WIN_TO_NIL_HOME/AWAY — cinquième marché orphelin sorti de VALUE,
  canal dédié en OBSERVATION** (2026-08-16) — side gagne ET l'adversaire ne
  marque pas ; indépendant par côté (pas complémentaire comme dnbHome/dnbAway
  — les deux peuvent être faux à la fois, ex. match nul ou les deux équipes
  marquent), exactement la même forme que CLEAN_SHEET déjà en canal. Aucune
  calibration walk-forward — lancement OBSERVATION dérivé des scores réglés
  (`docker exec evcore-postgres psql`) : taux = compte(side gagne ET
  adversaire à 0) / compte(fixtures réglées) par ligue, 67 ligues n≥50,
  `threshold = taux domicile − 0.05` (marge plate, même règle que
  `CLEAN_SHEET_CONFIG` — domicile structurellement le signal le plus fiable,
  observé sur chaque ligue du jeu de données). `decideWinToNil` = copie
  quasi-exacte de `decideCleanSheet` (deux marchés indépendants HOME/AWAY,
  argmax au-dessus d'un seuil partagé). Contrairement aux 4 canaux
  précédents : réutilise le mécanisme existant `getChannelStrategyConfig`
  (dispatcher partagé avec CLEAN_SHEET/WIN_EITHER_HALF) en ajoutant
  `"WIN_TO_NIL"` à l'union `ChannelStrategyConfigChannel` plutôt que de créer
  un nouveau getter dédié comme RESULT_BTTS/DRAW_NO_BET — la table
  `WIN_TO_NIL_CONFIG` reste séparée de `CHANNEL_STRATEGY_CONFIG`
  (DOMINANT/DRAW/BTTS, eux réellement backtestés ROI), même distinction que
  CLEAN_SHEET/WIN_EITHER_HALF. **Effet de bord trouvé en creusant le
  typecheck** : `apps/backend/src/modules/backtest/tuning.constants.ts`
  indexe `Record<ChannelStrategyConfigChannel, ...>` de façon exhaustive
  (`TUNING_THRESHOLD_GRID`, `CHANNEL_PROMOTION_RULE`, `TUNING_CHANNELS`) —
  étendre l'union sans mettre à jour ce fichier cassait le build (pas un
  problème de migration Prisma, une vraie erreur de compilation) ; complété
  avec une grille placeholder (même méthodologie que CLEAN_SHEET/
  WIN_EITHER_HALF à leur lancement, pas encore backtestée). OBSERVATION
  stricte, même périmètre que les 4 canaux précédents. `StrategyChannel`
  (Prisma) gagne `WIN_TO_NIL` ; migration écrite
  (`20260816160000_add_win_to_nil_channel`), **pas lancée**. Suite verte hors
  `domain-enums.conformance.spec.ts` (attendu — 931/932).
  - `[ ]` Après migration + `db generate` côté utilisateur : relancer
    `pnpm --filter backend test`.
  - `[ ]` Même séquence que les canaux précédents : observer avant tout
    backtest ROI ou wiring coupon/invest.
  - `[ ]` Marchés orphelins restants : DOUBLE_CHANCE, HALF_TIME_FULL_TIME,
    FIRST_HALF_WINNER — aucun n'a de calibration prête ; tous trois sont des
    marchés composés (pas de signal à isoler aussi simplement qu'un
    side×issue), plus proches en complexité d'un vrai chantier de conception
    que d'une répétition mécanique de la méthode base-rate-DB.

---

## Canaux en observation (pas encore staking-grade)

- `[~]` **Nouveaux marchés (DNB/TEAM_TOTAL/CLEAN_SHEET/WIN_TO_NIL/
  WIN_EITHER_HALF/RESULT_TOTAL_GOALS/RESULT_BTTS)** — wired dans VALUE/SAFE.
  **Correction 2026-08-15** : TEAM_TOTAL n'est plus observation-only comme
  écrit ici — il est **staké en coupon** depuis le 07-28 (`coupon.constants.ts` :
  `CANAL_BASE_WEIGHT.TEAM_TOTAL=0.15`, `MAX_COUPON_SELECTIONS.TEAM_TOTAL=3`,
  backtesté +3.40% ROI n=845). Seuls `CLEAN_SHEET`/`WIN_EITHER_HALF` restent
  observation-only à raison (confirmé plus haut : 0 ligue confirmée en
  whitelist). Extension SAFE/VALUE reste bloquée tant que les cotes forward
  ne sont pas accumulées (`CouponChannel` toujours limité à
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

- **H2H v2.1 (pondération domicile/extérieur ×3) et v2.3a (continuité
  entraîneur)** — v2.0 (`computeH2HScore`, seuil n≥3, decay=0.8, nul=0.5) et
  v2.2 (signaux H2H par marché) sont **déjà en production** (`FEATURE_FLAGS.
SCORING.H2H`/`H2H_MARKET_SIGNALS = true`, actifs depuis fin juillet — pas du
  shadow).
  - `[ ]` v2.1 — re-vérifié 2026-08-15 (`db:backtest:h2h-venue-weighting`,
    vrai rejeu TeamStats point-in-time) : gain de corrélation hors
    échantillon toujours négligeable (0.0713→0.0715, +0.0002) — pas un signal
    réel malgré le verdict brut du script, complexité non justifiée. Rester
    sur v2.0 (IMPROVED).
  - `[x]` v2.3a — **TODO périmé, déjà fait** (vérifié 2026-08-15) : le
    modèle `CoachTenure` existe (17 309 lignes), l'ETL tourne
    (`coachs-sync.worker.ts`), et la continuité entraîneur est backtestée
    (`db:coach-bounce-backtest`, 2026-07-25 : +0.08 pt/match sur les 5
    premiers matchs sous un nouveau coach, positif dans tous les strata
    domicile/extérieur × force adverse) et **active en prod** — implémentée
    différemment de ce que ce TODO envisageait : pas un nouveau facteur H2H,
    mais une correction du décalage de `recentForm` (reset de fenêtre à
    chaque changement d'entraîneur, `rolling-stats.service.ts`). Le "new
    coach window" (`coach-continuity.constants.ts`) reste aussi affiché en
    UI (cartes Décisions/Investir), informationnel seulement.
  - `[-]` v2.3b (turnover effectif complet) — reporté, pas de point-in-time
    squad snapshot exploitable.

- `[~]` **BTTS NO** — activé en observation par ligue (`SA·BRA1·FRI @0.58`,
  `EL1·CH·EL2·LL @0.55`, vérifié 2026-08-15 : config toujours exacte). Jamais
  staké, aucun edge cross-saison confirmé. **Re-run `/backtest/tuning`
  chaque saison** — vérifié : `ChannelTuningService` lit `model_run.features`
  déjà enregistrés ("value-driven replacement... reads from the DB instead
  of re-running the engine"), même limite méthodologique que
  `backtest-channel-league-whitelist.ts` (mémoire
  `feedback_backtest_definition`) — un run maintenant mesurerait
  surtout l'ancien modèle (avant homeAdvFactor 07-19/H2H v2.2). Par
  ailleurs la nouvelle saison 2026-27 vient tout juste de démarrer (mi-août)
  — pas encore assez de matchs pour un vrai re-tuning saisonnier de toute
  façon. Reporter à plus tard dans la saison.

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

- `[~]` **CORRECT_SCORE** — reste en observation, jamais staké. Re-cadré
  2026-08-15 : la piste "whitelist par ligue" (USA2/UCL/KOR2, chiffres
  cités de l'audit 2026-08-12) a été écartée après discussion — l'objectif
  n'est pas de trouver des ligues où le biais de surconfiance échappe par
  chance sur un petit échantillon (n=28-48 même restreint à la fenêtre
  post-07-19), mais de comprendre la cause du biais (mémoire
  `project_correct_score_immature`). Diagnostic déjà fait avant cette
  session : le produit Poisson indépendant n'a **aucun signal prédictif
  démontrable** (AUC=0.51, quasi hasard) — 4 pistes de correction directe
  testées et invalidées (recalibration, features, pénalité anti-nul,
  rééquilibrage empirique 1X2). **Résolu ce jour** : la 5e piste (signal H2H
  scoreline) re-vérifiée avec un vrai backtest par rejeu — stable (n=2158,
  p=0.0021) et confirmé **sans double-comptage** avec la correction lambda
  H2H déjà active (l'écart se renforce même une fois le lambda déjà
  ajusté : 2.46pp, p=0.0003). Activé dans `correct-score.strategy.ts`
  (`ContextSignals.h2hScoreline`, `reasonDetails.h2hScorelineAgreement`) —
  signal de confiance uniquement, ne change jamais le pick sélectionné,
  aucun risque vu que le canal reste jamais misé.

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

- `[~]` **Lambda scale (λScale)** — correction appliquée sur 13 ligues
  (vérifié 2026-08-15 : `LAMBDA_SCALE_MAP` — MLS/TUR1/NOR1/NOR2/SUI2/CSL/
  ISL1/SWE2/SP2/MX1/J1 + FIN1/BL1 ajoutées le 07-28). Reste : re-mesurer
  `/backtest/calibration` après le prochain rebuild, étendre si d'autres
  biais stables apparaissent. **Attention en le relançant** :
  `ModelCalibrationService` lit `model_run.features` déjà enregistrés
  ("never re-runs the engine") — même limite que
  `backtest-channel-league-whitelist.ts` (mémoire
  `feedback_backtest_definition`), le résultat reflétera surtout l'ancien
  modèle tant que pas assez de volume post-correction (homeAdvFactor 07-19,
  H2H v2.2) n'est accumulé. `backtest-lambda-scale-calibration.ts` en
  revanche est un vrai rejeu (TeamStats point-in-time) — fiable à relancer
  n'importe quand.

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
