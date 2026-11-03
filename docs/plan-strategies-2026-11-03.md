# Plan — Stratégies : améliorer, ajouter (5 phases, 7 PR)

_03/11/2026. L'utilisateur valide l'étude [ETUDE-STRATEGIES.md](audits/2026-11-03/ETUDE-STRATEGIES.md) en entier. Implémentation par Opus 5.5 (effort moyen), une PR par phase, dans l'ordre ; les phases 4 et 5 attendent les données des phases 2 et 3. Règles du dépôt inchangées : branche depuis `main`, petits commits, `/code-review high` avant chaque PR, migrations lancées en prod par l'utilisateur, jamais de marge 1xBet côté joueur, chance affichée = fréquence mesurée, jamais la cote convertie, validation par jambe et jamais par ROI de coupon._

## 0. Avant tout (utilisateur)

- [ ] **Renouveler l'abonnement API-Football Pro avant le 05/11 à 11:55 UTC.** Le plan Pro (7 500 requêtes par jour) couvre toutes les phases, avec moins d'appels qu'aujourd'hui.
- [ ] Fusionner #294 (archive des cotes) **avant** la phase 3 : elle ajoute ~40 % de lignes de cotes, que l'archive compacte chaque mois.

## Les phases

| Phase | Contenu                                                                                                                                                                                | Dépend de                | Visible quand                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------ |
| 1     | Chasseur Nul à la mi-temps                                                                                                                                                             | rien                     | à la fusion                          |
| 2     | Événements, compositions, stats par joueur via `/fixtures?ids=` ; buteurs sur la fiche d'un match fini                                                                                 | rien                     | à la fusion                          |
| 3     | Collecte des nouvelles cotes : corners d'équipe et 1X2, buteurs et tirs par joueur (Bet365), 1X2 à la minute ; effectifs ; règlement de chacun                                         | 2 (règlement), #294      | rien de visible : la mesure commence |
| 4     | Les produits mesurés : 4a corners d'équipe et 1X2 (J+14 de la phase 3), 4b Buteur du jour et Tir cadré du jour (J+28), 4c « Rien avant la 15e » (J+28, facultatif), 4d cartons (17/11) | 3                        | après mesure                         |
| 5     | Moteur : TEAM_TOTAL recalibré sur 1,45–1,80 ; Combiné à la jambe la moins chère à chance égale ; plafond de jeu de l'IA                                                                | rien (pendant l'attente) | à la fusion                          |

Sept PR : 1, 2, 3, 4a, 4b, 4c+4d, 5. La phase 5 se fait pendant les deux à quatre semaines d'attente de la phase 4.

---

## Phase 1 — Chasseur Nul à la mi-temps (une PR, `minor`)

### Context

- Le nul à la mi-temps est l'issue la plus fréquente de son marché : Pinnacle annonce 39,7 %, réalisé 40,0 % sur 14 291 matchs, marge 4,7 %, cote moyenne 2,44 (étude § 3.1). Le canal FIRST_HALF du moteur tient au-dessus de 1,80 (ratio 0,94–0,96) ; le moteur n'intervient pas ici : c'est un produit au prix du marché, comme le Chasseur Nul.
- 1xBet cote `FIRST_HALF_WINNER` sur 1 143 des 1 144 matchs relevés depuis le 20/10 : **tout est déjà en base**, avec la marge payée. Le score à la mi-temps (`homeHtScore`, `awayHtScore`) est rempli par le règlement ; `resolveHalfTime…` existe dans `bet-settlement.ts` ; `odds_closing_line` connaît le marché.
- Il n'y a ni ingestion, ni migration.

### Étape 1 — La classe et la règle (`analysis-core`)

- `HUNTER_HT_DRAW_CLASS` dans `coupon-classes.ts` : `name: "HUNTER_HT_DRAW"`, `minLegOdds: 2.1`, `maxLegOdds: 2.8`, `maxLegs: 1`, `targetOddsMin: 2.1` (identité de la proposition : vérifier qu'aucune classe ne l'a), `targetOddsMax: 2.8`. Ajouter au type `CouponClassName` et à `classForTargetOddsMin`.
- `HT_DRAW_HUNTER: HunterSpec = { coupon: HUNTER_HT_DRAW_CLASS, market: "FIRST_HALF_WINNER", pick: "DRAW" }` dans `hunter-composer.ts`. `composeHunterByMarket` sert tel quel (groupe à trois issues, marge 1xBet la plus basse puis fréquence du marché).
- Spec : bande, coût, AVOID, abstention `no_candidate_in_band`.

### Étape 2 — Le vivier et la composition (backend)

- `CouponPricedPoolService.load` / `CouponRepository.findDoubleCandidates` : vérifier que `FIRST_HALF_WINNER` entre dans le vivier (lignes `evaluatedPicks` du marché, `POOL_EXCLUDED_MARKETS`) et que `findPlayableQuotes` lui sert la fréquence de Shin sur le groupe 1X2 mi-temps (même traitement que `ONE_X_TWO`). Sinon, l'ajouter au même endroit, sans toucher aux autres marchés.
- `CouponHunterGenerationService.generateForDate` : un `persist` de plus, `spec: HT_DRAW_HUNTER`, `source: PRICE_COMPOSER`, après le Chasseur Nul.
- `coupon.constants.ts` : `ABSTENTION_PASSES['hunter-hunter_ht_draw']`.
- Règlement : la jambe se règle sur `homeHtScore`/`awayHtScore` par le résolveur existant ; un match fini sans score à la mi-temps reste en attente puis VOID après le délai de grâce déjà en place pour les stats (14 j), jamais perdu.

### Étape 3 — Écrans

- Backend : `TODAY_PRODUCTS` et `TODAY_HERO_RELAY` (après `HUNTER_DRAW`), `TODAY_PRODUCT_TARGETS`, `RESULTS_PRODUCTS` (`launchedOn` = jour de déploiement), `slip-digest.compose.ts` (libellés), `console-rules` si la liste des produits y est.
- Web : `TodayProductKey`, `RESULTS_PRODUCT_KEYS`, `PRODUCT_ORDER`, messages fr/en (`products`, `shortNames`, `codes` → « MT », `results.names`, `titles`, `definitions` : « un match nul à la mi-temps, cote 2,10 à 2,80 »), libellé de pari « Nul à la mi-temps » (vérifier `market-labels-fr.ts` pour `FIRST_HALF_WINNER/DRAW`), mock e2e, un test Playwright sur Aujourd'hui.
- Jamais « 1xBet prend X % » côté joueur.

### Étape 4 — Rejeu et rapport

- `docs/audits/<date>/CHASSEUR-NUL-MT.md` : rejeu de la règle sur les clôtures Pinnacle `FIRST_HALF_WINNER` (14 291 matchs) par jour : jours composés, réalisé contre marché avec IC, mise fixe au prix Pinnacle puis moins l'écart de marge 1xBet, pire série. Attendu : ~40 % de jours gagnants à cote ~2,4, pire série ~6.

### Vérification

- Specs analysis-core (composition), backend (`generateForDate` écrit cinq chasseurs + le Combiné IA ; `recordPriceComposerAttempt` compté), `console-rules.spec`, `results.service.spec`, `coupon.service.spec` (passes d'abstention).
- Copie locale : une génération du jour compose (1xBet cote le marché), règlement d'un jour passé par `settle-range`.
- `pnpm lint`, `typecheck`, tests, Playwright. `/code-review high`. Mémoire.

---

## Phase 2 — Événements, compositions, stats par joueur (une PR, `minor`)

### Context

- `/fixtures?ids=a-b-c` (20 identifiants) renvoie pour chaque match `events`, `lineups`, `statistics`, `players` en **un appel** (vérifié le 03/11 : 399/399 matchs avec les quatre). Aujourd'hui `stats-sync.worker.ts` appelle `/fixtures/statistics?fixture=` **par match** : le remplacer fait ~90 appels de moins par jour et apporte le reste gratuitement.
- Ce qui en dépend : règlement des buteurs, des tirs par joueur et des paris à la minute (phase 3), « Buteur du jour » (phase 4b), contexte de l'IA (plus tard, mesuré sur le résidu), et tout de suite : **les buteurs sur la fiche d'un match fini**.
- Rattrapage : 47 800 matchs avec stats, 2 400 appels une fois, dans la réserve quotidienne du rattrapage des stats (`StatsBackfillService`, budget au-delà de la réserve).

### Étape 1 — Schéma

Trois tables et une table de joueurs, migration Prisma (lancée en prod par l'utilisateur) :

- `player` : `id` (uuid), `externalId` (int, unique), `name`, `firstname?`, `lastname?`, `nationality?`, `birthDate?`, `photoUrl?`, `updatedAt`. Remplie par les compositions et les stats joueurs (identifiant + nom), complétée en phase 3 par les effectifs.
- `fixture_event` : `fixtureId`, `teamId`, `ordinal` (rang dans la réponse, 0..n), `minute`, `extraMinute?`, `type` (`GOAL` | `CARD` | `SUBSTITUTION` | `VAR`), `detail` (texte de l'API : `Normal Goal`, `Penalty`, `Own Goal`, `Missed Penalty`, `Yellow Card`, `Red Card`, …), `comments?`, `playerExternalId?`, `playerName?`, `assistExternalId?`, `assistName?`, `observedAt`. Unique `(fixtureId, ordinal)` ; index `(fixtureId, type)`, `(playerExternalId, type)`.
- `fixture_lineup` : `fixtureId`, `teamId`, `playerExternalId`, `playerName`, `number?`, `position?` (G/D/M/F), `grid?`, `starter` (bool), `formation?`, `coachExternalId?`, `observedAt`. Unique `(fixtureId, teamId, playerExternalId)`.
- `fixture_player_statistic` : `fixtureId`, `teamId`, `playerExternalId`, `minutes`, `position?`, `rating?` (Decimal 4,2), `substitute`, `shotsTotal`, `shotsOn`, `goals`, `assists`, `saves`, `passesTotal`, `passesKey`, `tackles`, `foulsCommitted`, `foulsDrawn`, `yellow`, `red`, `offsides`, `penaltyScored`, `penaltyMissed`, `raw` (Json, le bloc entier), `observedAt`. Unique `(fixtureId, teamId, playerExternalId)`.
- Réécriture à chaque synchronisation (upsert), comme `fixture_statistic`.

### Étape 2 — Ingestion

- Schéma Zod `ApiFootballFixturesByIdsResponseSchema` (`schemas/fixture-full.schema.ts`) : `statistics` au format déjà validé par `stats.schema.ts`, `events`, `lineups`, `players`, tolérant aux champs nuls (rating, grid, shots).
- `stats-sync.worker.ts` : grouper les matchs en attente par 20, un appel `/fixtures?ids=`, puis par match : stats d'équipe (code existant, même `markXgUnavailable`/`markUnavailable`), événements, compositions, stats joueurs vers trois nouveaux dépôts (`FixtureEventRepository`, `FixtureLineupRepository`, `FixturePlayerStatisticRepository`) et `PlayerRepository.upsertMany`. Quota et 429 : même garde qu'aujourd'hui, sur le lot. Un match absent de la réponse = `skipped` + `failedExternalIds`.
- `pending-bets-settlement.worker.ts` et `stale-scheduled-sync.worker.ts` appellent déjà `/fixtures?id=` par match : **pas touchés** dans cette phase (noté hors lot : les grouper aussi).
- Rattrapage : `events-backfill` dans `StatsBackfillService` (même réserve, même pause admin) : matchs finis avec stats d'équipe mais sans `fixture_event`, du plus récent au plus ancien, 20 par appel. Journalisé dans Exploitation (ligne du rattrapage : « événements N / M »).
- `RollingStatsService` : inchangé.

### Étape 3 — La fiche de match

- `MatchSheet` : pour un match fini, `scorers: { minute, player, team: 'home'|'away', kind: 'goal'|'penalty'|'own' }[]` et `redCards`, depuis `fixture_event`. Affichés sous le score, en une ligne par but (« 12' Konsa », « 45+1' Gyökeres (p.) »). Rien pour un match à venir.
- Types web, feuille, mock e2e, Playwright.

### Vérification

- Specs Zod (réponse complète, match sans événements, joueur sans stats), dépôts, worker (groupes de 20, quota, match manquant), `match-sheet.service.spec`.
- Copie locale : migration + `migrate diff` vide ; une passe de stats sur 40 matchs finis récents (clé du `.env`, ~2 appels) ; la fiche d'un de ces matchs montre ses buteurs.
- `/code-review high` (job daté : retards et re-synchronisations ; rien n'est perdu quand un match manque). Mémoire.

---

## Phase 3 — Collecte des nouvelles cotes et leur règlement (une PR, `minor`)

### Context

- Inventaire du 03/11 (`API-FOOTBALL-MARCHES.md`) : corners d'équipe (bets 57/58), corners 1X2 (55) chez 1xBet, Pinnacle, Betano sur 8 matchs sur 10 ; buteur à tout moment (92) et premier buteur (93), tirs par joueur (240/241), tirs cadrés par joueur (269/275) chez Bet365 sur 9–10 ; 1X2 à la 10e/15e/30e/60e/75e minute (54/136/139/137/138) chez Marathonbet, Betano, Bet365.
- Tout vient de l'appel `/odds?fixture=` déjà fait : **0 appel de plus**. Volume : ~250 lignes de plus par match et par relevé (+40 %), compactées par l'archive (#294).
- Les noms des cotes joueurs ne sont pas des identifiants : 26 % non appariés par le nom. Il faut l'effectif de chaque équipe (`/players/squads?team=`, 1 appel par équipe, ~1 300 une fois puis chaque semaine pour les équipes actives, dans la réserve).
- Rien n'est montré au joueur dans cette phase : on mesure.

### Étape 1 — Marchés et migration

- Enum `Market` (migration) : `CORNERS_HOME`, `CORNERS_AWAY`, `CORNERS_1X2`, `GOAL_SCORER_ANYTIME`, `GOAL_SCORER_FIRST`, `PLAYER_SHOTS`, `PLAYER_SHOTS_ON_TARGET`, `MINUTE_1X2`.
- Conventions, toutes avec la colonne `line` (jamais dans `pick`, CLAUDE.md) :
  - `CORNERS_HOME` / `CORNERS_AWAY` : `pick` OVER/UNDER, `line` en ,5 seulement (comme CORNERS) ;
  - `CORNERS_1X2` : `pick` HOME/DRAW/AWAY, `line` null ;
  - `GOAL_SCORER_*` : `pick` = `P<externalId>` du joueur apparié (voir étape 2), `line` null ; « No Goalscorer » → `pick` = `NONE` ;
  - `PLAYER_SHOTS*` : `pick` = `P<externalId>`, `line` = nombre minimal de tirs (« X - 2 » → 2) ;
  - `MINUTE_1X2` : `pick` HOME/DRAW/AWAY, `line` = minute (10, 15, 30, 60, 75).
- `API_FOOTBALL_BET_IDS` complété ; `REFERENCE_ONLY_MARKETS` / `OPERATOR_EXTENDED_MARKETS` / une nouvelle liste `MARKET_BOOKMAKERS` qui dit, par marché, chez quels books on garde (corners : 1xBet + Pinnacle ; joueurs : Bet365 ; minute : Marathonbet + Betano + Bet365). Les autres books restent exclus pour le volume.

### Étape 2 — Effectifs et appariement

- `player_squad` : `teamId`, `playerExternalId`, `number?`, `position?`, `observedAt` ; unique `(teamId, playerExternalId)`. Sync `squads-sync` hebdomadaire sur les équipes des matchs des 10 prochains jours, dans `StatsBackfillService` (réserve), et une fois au déploiement.
- `matchPlayerName(name, squad)` (pur, analysis-core ou utils) : normalisation (accents, points, tirets), nom de famille, puis initiale + nom, puis nom complet ; ambiguïté → non apparié. Diagnostic par relevé : joueurs cotés / appariés, dans le journal et la ligne Exploitation des cotes.
- Un joueur non apparié n'est pas stocké (un `pick` inconnu polluerait la base).

### Étape 3 — Ingestion

- `odds-prematch-sync.worker.ts` : parseurs `parseCornersTeam`, `parseCorners1x2`, `parsePlayerMarket` (nom → `P<id>`, ligne), `parseMinute1x2` (bet id → minute), branchés dans `extractExtendedMarketOdds` sur les books de `MARKET_BOOKMAKERS`. `odds_latest` suit par le déclencheur. Specs sur des réponses réelles (celles de la sonde du 03/11, anonymisées si besoin).
- `inspectExtendedMarkets` couvre les nouveaux marchés (absent chez le book / libellé rejeté).

### Étape 4 — Règlement et CLV

- `bet-settlement.ts` (analysis-core, pur) : `resolveTeamCorners(pick, line, teamCorners)`, `resolveCorners1x2(pick, home, away)` (égalité = DRAW), `resolveGoalScorer(pick, scorerIds, kind)` (`ANYTIME` : a marqué hors csc ; `FIRST` : premier but du match ; `NONE` : aucun but ; joueur absent de la composition → VOID), `resolvePlayerShots(pick, line, shots)` (joueur sans stat → VOID, pas joué → VOID), `resolveMinute1x2(pick, minute, goalsWithMinutes)` (score à la minute `line`, `elapsed <= line`).
- `coupon-settlement` lit `fixture_statistic`, `fixture_event`, `fixture_lineup`, `fixture_player_statistic` selon le marché ; inconnu = attente puis VOID après le délai de grâce, jamais perdu. Ces marchés n'entrent pas dans `channel_selection` (le moteur ne les joue pas).
- `odds_closing_line` / `odds_opening_line` : rien à changer (grain `market, pick, line`).
- Un script d'étude `report:new-markets` (backtest-core) : par marché, fréquence du marché sans marge contre réalisé, par tranche de cote, avec IC, depuis `odds_closing_line` et les tables de règlement — c'est ce que lira la phase 4.

### Vérification

- Specs parseurs (libellés réels), appariement (26 % de cas réels), résolveurs (chaque issue, VOID quand inconnu), migration + `diff` vide.
- Copie locale : une passe de cotes sur les matchs du lendemain avec la clé (quelques appels), les lignes des huit marchés en base, `report:new-markets` qui tourne à vide.
- `/code-review high` (règlement, inconnu ≠ 0, Decimal). Mémoire.

---

## Phase 4 — Les produits, quand la mesure est là

Chaque sous-phase commence par `report:new-markets` sur la fenêtre, et ne livre que si la fréquence réelle est mesurée (IC ≤ ± 8 points sur la bande visée). Un produit se montre dès sa livraison (pas de phase d'ombre), avec sa fréquence **mesurée** et sa pire série.

### 4a — Chasseurs Corners d'équipe et Corners 1X2 (J+14 de la phase 3, une PR)

- Classes `HUNTER_CORNERS_TEAM` (le côté le moins cher parmi `CORNERS_HOME`/`CORNERS_AWAY` en ,5, bande 1,70–2,10 comme le Chasseur Corners, championnats aux stats fiables) et `HUNTER_CORNERS_1X2` (HOME ou AWAY le moins cher ; le nul à 9 % n'est pas joué), même `persistCorners` élargi.
- Écrans comme en phase 1 ; libellés « Corners de <équipe> : plus de 4,5 », « Plus de corners : <équipe> ».
- Rapport : calibration mesurée sur 14 jours, jours composés attendus.

### 4b — Buteur du jour et Tir cadré du jour (J+28 de la phase 3, une PR)

- Règle Buteur : parmi les `GOAL_SCORER_ANYTIME` Bet365 du jour, titulaires probables (dans l'effectif, `position` F ou M, pas blessé si la table des blessures le dit), la cote la plus basse ; une seule jambe. **Chance affichée = fréquence réelle de la tranche de cote mesurée sur les 4 semaines** (table dans `config/`, datée), jamais 1/cote : l'étude donne 13 % réalisés pour 32 % annoncés sur 2,5–4.
- Règle Tir cadré : parmi les `PLAYER_SHOTS_ON_TARGET` ligne 1 (au moins un tir cadré) Bet365, attaquants titulaires probables, la cote la plus basse ; attendu ~44 %.
- Joueur absent de la composition au coup d'envoi → VOID, affiché « Remboursé » (le book rembourse ; à vérifier chez 1xBet et Betclic, le dire dans la fiche produit).
- Compositions avant coup d'envoi : à T-60 le balayage de clôture ajoute `/fixtures?ids=` par 20 matchs → `fixture_lineup` avant le match (~10 appels par jour) ; la carte du produit passe à « titulaire confirmé » ou « ne joue pas · remboursé ».
- Écrans : le nom du joueur et son équipe, « marque environ 1 fois sur N » ; décision du nom avec l'utilisateur.
- Rapport : 4 semaines de calibration par tranche, appariement (part de non appariés), couverture (matchs cotés par jour).

### 4c — « Rien avant la 15e » (J+28, facultatif, dans la PR 4d)

- `MINUTE_1X2` ligne 15, pick DRAW, le moins cher ; attendu 70 % à cote ~1,33. À livrer seulement si l'utilisateur le veut après lecture des chiffres (Marathonbet/Betano seulement dans notre flux).

### 4d — Cartons (décision le 17/11, même PR que 4c)

- Avec deux semaines de cotes 1xBet (#297) : matchs cotés par jour, marge, intitulé du décompte des rouges. Chasseur Cartons (le côté le moins cher, 1,70–2,10) si ≥ 5 matchs par jour cotés dans les championnats aux stats fiables ; sinon on note et on attend.

---

## Phase 5 — Moteur (une PR, pendant l'attente, `minor`)

### Context

- TEAM_TOTAL annonce trop entre 1,45 et 1,80 : ratio 0,83 sur 1 796 jambes réglées (90 jours), alors qu'il tient sous 1,45 (0,96). Un backtest de sa courbe de retrait existe (`db:backtest:team-total-shrinkage-calibration`).
- Le Combiné du jour paie 8,9 % de marge par jambe à des cotes de 1,13 : à chance calibrée égale (à 2 points près), la jambe à la marge 1xBet la plus basse coûte moins. `composeEngineCombo` classe par probabilité calibrée seule.
- L'IA joue 82 % des matchs pour un budget de 3 sur 10 ; la v6 (#295) est relue vers le 10/11.

### Étapes

1. **TEAM_TOTAL** : rejouer le backtest avec une courbe de retrait plus forte sur 1,45–1,80, validation hors échantillon par période (comme le re-fit du 06/10) ; n'expédier que si le ratio passe au-dessus de 0,90 hors échantillon sans dégrader sous 1,45. Sinon, rapport et rien.
2. **Combiné** : option `tieBreak: 'lowestMargin'` dans `composeEngineCombo`, rejeu sur 90 jours (`backtest:composer` ou équivalent) jugé par jambe : réalisé contre annoncé et marge payée ; expédier si la marge baisse sans que le réalisé/annoncé bouge hors du bruit.
3. **IA** : après la lecture v6, si la part de jeu reste > 50 %, plafond déterministe : garder les N avis du jour à la plus haute probabilité calibrée (N dans `config/`), les autres passent en refus commenté. À décider avec l'utilisateur sur les chiffres.

### Vérification

- Backtests committés avec leurs sorties dans `docs/audits/<date>/`, specs des changements, `/code-review high`.

---

## Migrations (toutes lancées en prod par l'utilisateur, au déploiement)

1. Phase 2 : `player`, `fixture_event`, `fixture_lineup`, `fixture_player_statistic`.
2. Phase 3 : enum `Market` (+8 valeurs), `player_squad`, `team."squadSyncedAt"` (`20261104090000_add_new_odds_markets_and_player_squad`).
3. Phase 4 : aucune (classes = `targetOddsMin`).

## Hors plan (noté)

- Tirs, fautes, hors-jeu, arrêts d'équipe : aucun book du flux ne les cote sur les matchs ordinaires ; relancer `probe:inventory` chaque mois.
- Handicap corners (56), double chance corners (339), nombre exact de buts, écart, buteurs par équipe (218–233) : plus tard, selon ce que donnent 4a et 4b.
- Grouper `/fixtures?id=` du règlement et du rattrapage des « à venir » en `ids=` : petit gain, à prendre en passant.
- Compositions et absents dans le contexte de l'IA : seulement après mesure sur le résidu.
- Modèles maison sur les buts : non (stats de match sans apport au-delà de la clôture).

## Todo (un commit par ligne, cocher au fur et à mesure)

### Phase 1 — `feat/hunter-ht-draw`

- [x] 1.1 `feat(analysis-core): HUNTER_HT_DRAW class and spec` _Fait : `HUNTER_HT_DRAW_CLASS` (2,10–2,80, `targetOddsMin` 2,10 libre en base), `HT_DRAW_HUNTER` servi tel quel par `composeHunterByMarket` ; specs bande, coût, AVOID (cote jouable nulle), abstention, nul plein match jamais pris._
- [x] 1.2 `feat(coupon): half-time draw hunter in the evening pass` (vivier, génération, abstention) _Fait : le vivier commun aurait écarté ~85 % des lignes (porte `htftCalibrated` du moteur, en `market_suspended`) : vivier propre `findMarketCandidates` / `CouponPricedPoolService.loadMarket`, qui ne respecte que la vraie suspension (`calibration.market_suspension`) et les alertes de calibration ; `findPlayableQuotes` sert déjà Shin sur le groupe à trois issues, rien ajouté ; chargé à part (un échec n'emporte que ce chasseur) ; `hunter-hunter_ht_draw`. Règlement inchangé : remboursé dès le match fini sans score à la mi-temps (attendre 14 j mesuré inutile, voir le rapport). Copie locale : 12 nuls dans la bande le 04/11, composé à 2,39 chez 1xBet, chance 38,8 %._
- [x] 1.3 `feat(screens): half-time draw hunter on Aujourd'hui, Résultats, digest` _Fait : après `HUNTER_DRAW` dans `TODAY_PRODUCTS` et `TODAY_HERO_RELAY`, cible et bande, `RESULTS_PRODUCTS` lancé le 2026-11-04, deux libellés du résumé ; `today-products.spec`. `console-rules` n'énumère pas les produits._
- [x] 1.4 `feat(web): half-time draw hunter — labels, types, mock, e2e` _Fait : types, ordre, messages fr/en (codes MT / HT), le pari se lit déjà « Égalité à la pause » ; mock et `today.spec` écrits, **non lancés** (Playwright démarre `next dev`, consigne de ne pas lancer de serveur ; la CI ne lance pas l'e2e)._
- [x] 1.5 `docs(audit): half-time draw hunter replayed on Pinnacle closings` _Fait : `docs/audits/2026-11-04/CHASSEUR-NUL-MT.md` — 847 jours sur 889, 39,7 % ± 3,3 réalisés pour 40,3 % annoncés à cote 2,40, retour 0,950 chez Pinnacle (~0,90 chez 1xBet), pire série 12 sur trois ans (l'arithmétique de 2 sur 5 ; ~6 sur sept semaines)._
- [x] PR après `/code-review high` _Fait : 9 constats ; corrigés : attente de 14 j retirée (dépassait la fenêtre de 7 j de Résultats, touchait tous les coupons à jambe de mi-temps), vivier mi-temps isolé et parallèle, requête commune, marché tiré de la spec, prix Pinnacle < 3 h relus dans le rapport ; non retenu : filtre des championnats sans score de mi-temps (seuls les amicaux en manquent, non analysés sur ce marché)._

### Phase 2 — `feat/fixture-events`

- [x] 2.1 `feat(db): player, fixture_event, fixture_lineup, fixture_player_statistic` _Fait : migration `20261103180000_add_fixture_events` (enum `FixtureEventType`, quatre tables, `fixture."eventsSyncedAt"` + index) ; compteurs des stats joueurs et `substitute` nullables (l'API en laisse beaucoup à null : inconnu ≠ 0) ; `eventsSyncedAt` ajouté au plan : il enregistre « ce qui a été rapporté », sans lui un match sans événements serait repris à chaque passage._
- [x] 2.2 `feat(etl): fixtures by ids — one call for stats, events, lineups, player stats` _Fait : `stats-sync` par 20 ids, stats d'équipe et xG aux mêmes règles qu'avant ; module `fixture-events` (quatre dépôts, une transaction par match) ; validation en trois couches (enveloppe = l'appel entier, stats d'équipe, bloc événements/compositions/joueurs) ; match absent = en attente, jamais indisponible ; marqué quand les trois blocs sont venus ou à J+3 ; un bloc vide n'efface rien ; l'API écrit l'id 0 pour un inconnu (15 matchs sur 40). Routine passée à 20 matchs par job (1 appel). Copie locale : 4 appels réels, 55 matchs, 962 événements, 2 391 compositions, 1 632 stats joueurs, rejeu identique._
- [x] 2.3 `feat(etl): events backfill within the stats reserve` _Fait : chaque passage du rattrapage fait son lot de stats puis un lot d'événements (200 matchs, 10 appels) dans le reste du même budget, même file donc même pause ; matchs finis passés par les stats (synchronisées ou indisponibles), au-delà de J+3, du plus récent au plus ancien ; arrêt net au quota ; un match qui échoue trois fois est laissé jusqu'au redémarrage._
- [x] 2.4 `feat(screens): scorers and red cards on a finished match sheet` _Fait : `scorers` et `redCards` (null avant la fin ou si les buts ne font pas le score : rien plutôt que faux) ; but sans buteur (trace d'un but annulé par la VAR), tirs au but et prolongation écartés ; csc compté pour l'équipe de l'événement, « (c.s.c.) » ; 399/399 matchs de l'échantillon et 41/41 de la copie locale tombent juste. Mock et Playwright écrits, **non lancés** (pas de serveur)._
- [x] 2.5 `feat(console): events coverage on the stats line` _Fait : « événements N / M » sur la ligne du rattrapage (M = matchs finis passés par les stats)._
- [x] PR après `/code-review high` _Fait : 10 constats ; corrigés : match absent qui bloquait la routine (plafond de 3 essais), écriture des événements isolée par match, alerte quotidienne sur les rejets Zod, joueur sans nom ou sans `games` qui rejetait tout le match, bloc vide qui effaçait une composition déjà écrite, matchs aux stats indisponibles inclus au rattrapage, tirs au but et prolongation hors des buteurs, schéma `/fixtures/statistics` mort retiré ; non retenus : double lecture de l'identité du match (20 requêtes par appel, négligeable) et dépôt d'événements qui écrit `fixture.eventsSyncedAt` dans sa transaction (même choix que `FixtureStatisticsRepository`)._

### Phase 3 — `feat/new-odds-markets`

- [x] 3.1 `feat(db): eight markets and player_squad` _Fait : migration `20261104090000_add_new_odds_markets_and_player_squad` (une seule : `ADD VALUE` passe en transaction tant que rien n'y utilise la valeur), `player_squad` avec `name` (l'orthographe de l'effectif, « K. Mbappé », gardée à part de `player.name` que les stats de match écrivent en entier) et `team."squadSyncedAt"` (ce qui a été rapporté, pour ne reprendre que le dû) ; aucune colonne sur `odds_snapshot` (archive inchangée)._
- [x] 3.2 `feat(etl): squads sync and player name matching` _Fait : `SquadsSyncService` dans le passage du rattrapage, après les stats et avant les événements (40 équipes, 1 appel chacune) : équipes des 10 prochains jours sans effectif ou vieux d'une semaine (461 sur la copie locale, donc le « premier passage » = les premiers passages après déploiement) ; réponse vide n'efface rien ; l'API écrit des entités HTML et de l'UTF-8 lu en Latin-1 (« N. O&apos;Reilly », « MaksimoviÄ ») : réparés. `matchPlayerName` (analysis-core) : exact, ordre inversé, initiales + nom, nom contenu, prénom court, initiale + dernier mot, nom unique ; deux joueurs à la première règle qui trouve = ambigu, non apparié. « effectifs N / M » sur la ligne du rattrapage._
- [x] 3.3 `feat(etl): ingest team corners, corners 1X2, scorers, player shots, minute 1X2` _Fait : `odds-new-markets.ts`, `MARKET_BOOKMAKERS` ; corners 1X2 chez 1xBet seulement (Pinnacle ne le cote pas) ; tirs par joueur gardés jusqu'à « au moins 3 » (`PLAYER_SHOTS_MAX_LINE`, 45 % du volume au-delà, cotes 6–21) ; Bet365 id 275 portait des noms sans nombre de tirs le 03/11 : rejeté, visible au diagnostic. Copie locale, 8 matchs de C1 du 04/11 (14 effectifs + 8 cotes) : 2 394 lignes, ~302 par match et par relevé en plus de 1 123 (+27 % sur une grande affiche, beaucoup moins ailleurs : sans Bet365 joueurs ~40) ; 1 195 noms appariés sur 1 302 (91,8 %) avant réglage, 12 des 30 premiers manqués récupérés après._
- [x] 3.4 `feat(settlement): resolvers for the eight markets, unknown stays unknown` _Fait : `stat-markets.ts` (analysis-core) et `MatchFactsRepository` ; buteurs à la Bet365 (csc exclu, premier buteur après un csc = le suivant, remplaçant entré après le premier but remboursé, « No Goalscorer » gagnant si seulement des csc) ; tirs réglés seulement si les joueurs de l'équipe font le total de l'équipe (cadrés 797/798 équipes, tirs 424/798 : les totaux par joueur en oublient) ; minute = buts de minute ≤ ligne (45+2 = 45e). Coupons : même chemin que CORNERS, délai propre `STAT_MARKET_SETTLEMENT` (14 j)._
- [x] 3.5 `feat(backtest): report:new-markets — market frequency vs realised by odds band` _Fait : `odds_closing_line` ≤ 3 h (les cotes de buteurs ne bougent plus à 2 h), mêmes résolveurs que le règlement, sans marge par normalisation des groupes fermés (plus/moins, 1X2 ; buteurs et tirs : 1/cote seulement), IC de Wilson ; tourne à vide sur la copie locale, vérifié de bout en bout sur des cotes fictives._
- [x] PR après `/code-review high` _Fait : 10 constats ; corrigés : buteurs appariés dans l'effectif de leur équipe (placés par les listes de tirs) sinon strictement, minutes nulles ≠ « n'a pas joué », entité HTML hors plage qui aurait bloqué chaque passage, échecs d'une équipe remis à zéro au succès, alerte Zod quotidienne, avertissement si des joueurs sont cotés sans effectif, diagnostic des lignes entières, lecteurs de cotes du moteur et de VANTAGE sans les huit marchés, délai de remboursement propre, rapport groupé par match ; non retenu : un planificateur à part pour les effectifs (le plan les veut dans la réserve du rattrapage ; l'avertissement et la ligne Exploitation rendent la dépendance visible)._

### Phase 4 — `feat/hunter-corners-team`, `feat/scorer-of-the-day`, `feat/hunter-cards-minute`

- [ ] 4a.1 rapport corners d'équipe (J+14) · 4a.2 classes et génération · 4a.3 écrans · PR
- [ ] 4b.1 rapport buteurs et tirs (J+28) · 4b.2 compositions à T-60 · 4b.3 Buteur du jour · 4b.4 Tir cadré du jour · 4b.5 écrans · PR
- [ ] 4c/4d rapport cartons (17/11) et minute · produits selon décision · PR

### Phase 5 — `feat/engine-tuning`

- [x] 5.1 `docs(audit): TEAM_TOTAL shrinkage refit on 1.45–1.80` (+ config si validé) _Fait : rien d'expédié (`docs/audits/2026-11-03/TEAM-TOTAL-SHRINKAGE.md`). Rejeu de la chaîne de production sur 5 900 matchs (01/06 → 03/11), retrait vers le taux de base appliqué aux choix cotés 1,45–1,80, F choisi sur une moitié, mesuré une fois sur l'autre : tranche 0,792 → 0,781 (F 0,8) et 0,836 → 0,854 (F 0,4), jamais au-dessus de 0,90 ; sous 1,45 inchangé. Aucun F ne corrige, même F = 0 : l'écart est au prix, pas au taux de base — seule la grille de marché en entrée (phase 3 redéfinie) le corrigerait. Le rejeu du 06/10 partage maintenant `scripts/production-chain.ts`._
- [x] 5.2 `feat(coupon): engine combo breaks ties on the lowest margin` (+ rejeu) _Fait : expédié, activé (`COMBO_CONFIG.marginTieBreak`, fenêtre 2 points, politique `engine-combo-v2`) ; `docs/audits/2026-11-03/COMBINE-MARGE.md`. Rejeu du compositeur sur 49 jours de prix 1xBet (14/09 → 01/11), à 17 h la veille, vivier et calibration connus à cet instant : marge payée par jambe 8,93 % → 8,52 % (baisse dans les deux moitiés), réalisé ÷ annoncé 1,020 [0,935 ; 1,105] → 1,028 sur 95 / 94 jambes, dans le bruit. 20 jambes changent sur 16 jours. Le départage ne joue qu'entre matchs d'un même championnat : la sélection mise en avant de chaque match et les championnats retenus ne changent pas ; une marge inconnue ne gagne jamais. 49 jours au lieu de 90 : 1xBet n'est relevé que depuis le 13/09._
- [ ] 5.3 décision plafond IA (après v6)
- [ ] PR
