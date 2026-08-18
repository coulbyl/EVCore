# Harnais de backtest — cadrage architecture

> Statut : cadrage + premier chantier en cours (`packages/backtest-core`,
> `point-in-time-loader.ts`). Non finalisé — les 27 scripts existants ne
> sont pas encore migrés.
>
> Objectif : remplacer 27 scripts de backtest indépendants (11 338 lignes,
> `packages/db/scripts/backtest-*.ts`), sans harnais partagé, par un socle
> unique qui rejoue le pipeline de prod plutôt que de le réimplémenter à
> chaque fois — et qui rend une classe entière de biais (lire des données du
> futur) structurellement impossible plutôt que dépendante de la discipline
> de chaque script.

## 1. Constat de départ

Audit du 2026-08-17 : sur 27 scripts `backtest-*.ts`,

- **17** reconstruisent bien via `@evcore/analysis-core` (rejouent le
  pipeline) — mais chacun le fait indépendamment, dupliqué 17 fois ;
- **10** interrogent Prisma directement sans repasser par le moteur —
  `backtest-channel-league-whitelist.ts`, `backtest-decisions-ranking.ts`,
  `backtest-coupon-params-validation.ts`, `backtest-coupon-quality-signals.ts`,
  `backtest-joint-probability-calibration.ts`,
  `backtest-team-total-btts-competition.ts`, `backtest-ml-shadow-correction.ts`,
  `backtest-invest-ranking.ts`, `backtest-calibration-alert-over-under.ts`,
  `backtest-signal-window-calibration.ts`.

Le premier de cette liste est déjà connu buggé (mémoire projet
`project_channel_whitelist_replay_gap` : relit l'historique au lieu de
rejouer). Les 9 autres n'ont jamais été audités pour le même défaut.

## 2. Où vit le harnais : en dehors du backend

**`packages/backtest-core`**, aux côtés de `packages/analysis-core` et
`packages/db` — jamais dans `apps/backend`.

Raisons :

1. **Précédent déjà posé.** `packages/analysis-core` a été extrait du
   backend précisément pour être réutilisable sans NestJS/Prisma (mémoire
   `project_analysis_core_extraction`). C'est le socle pur que le harnais
   doit consommer, pas dupliquer.
2. **Coût d'itération.** Démarrer un contexte NestJS complet (DI, modules,
   `ConfigService`) à chaque run d'un script de calibration lancé des
   dizaines de fois par session est une friction inutile.
3. **Contamination des hypothèses "live".** Le repository layer du backend
   est pensé pour "la dernière donnée connue maintenant" ; un backtest a
   besoin de l'inverse — "la donnée telle qu'elle existait à cet instant
   précis du passé". Mélanger les deux dans le même repository réexpose au
   bug du §3.
4. **Le symptôme existait déjà** : `betting-engine.service.ts` porte des
   méthodes `listEvaluatedPicksForBacktest`,
   `listEvaluatedOneXTwoPicksForBacktest`, `selectSafeValuePickForBacktest` —
   un service de prod qui traîne du code réservé au backtest. Signe que la
   frontière était déjà en train de se corrompre.

`backtest-core` dépend de `@evcore/analysis-core` et `@evcore/db`. Rien dans
`apps/backend` ne dépend de `backtest-core` — le backend n'a jamais besoin
de savoir que le harnais existe.

## 3. Bug trouvé et corrigé en posant le harnais (2026-08-17)

En concevant `point-in-time-loader.ts`, audit de `OddsSnapshotLoader`
(`apps/backend/.../pricing/odds-snapshot.loader.ts`) : le paramètre
`cutoff` n'était respecté **que pour le marché `ONE_X_TWO`**. Pour les 16
autres marchés (BTTS, HT/FT, First Half Winner, Double Chance, Draw No Bet,
Clean Sheet ×2, Win to Nil ×2, Win Either Half, Over/Under, Over/Under HT,
Team Total ×2, Result Total Goals, Result BTTS, Correct Score),
`findBestBookmakerForMarket` recevait un `_cutoff` explicitement inutilisé,
et `findPerPickOddsPerLine` n'avait même pas de paramètre `cutoff` — toujours
la cote la plus récente en base, quel que soit l'instant demandé. Un
commentaire du refactor précédent documentait le défaut sans le corriger
("preserved as-is rather than silently changed while refactoring").

**Impact réel, pas seulement backtest** : `analyzeFixture()` appelle cette
fonction avec `cutoff7d` pour son filtre de mouvement de cote — inopérant en
prod sur 16 marchés sur 17 avant le fix. Tout backtest rejouant une date
passée sur un marché hors 1X2 récupérait silencieusement des cotes du futur.

**Fix** (voir TODO.md "Bugs & dette technique") : `cutoff` filtré
systématiquement partout. Suite backend complète (956 tests) verte après
fix. **Puis extraction** : la logique pure d'assemblage des cotes
(`assembleFullOddsSnapshot` et ses dépendances — `pickBestBookmaker`,
`resolvePerPickOddsPerLine`, etc.) a été déplacée de
`apps/backend/.../odds-snapshot.loader.ts` vers
`packages/analysis-core/src/pricing/odds-assembly.ts` : un seul
implémentation, partagée par la prod (I/O Prisma dans `OddsSnapshotLoader`)
et par le harnais de backtest, au lieu d'une deuxième copie qui aurait pu
diverger silencieusement.

## 4. "Event-driven" — precisement ce que ça veut dire ici

**Pas de BullMQ/Redis pour rejouer un backtest.** Un vrai bus d'événements
introduit latence, non-déterminisme d'ordonnancement et complexité de debug
— pour rejouer des données déjà toutes en Postgres, triées, connues à
l'avance. Pure sur-ingénierie.

Le patron "event-driven backtesting" emprunté à la littérature quant est un
**patron de code**, pas une infra : chaque match devient un événement traité
dans l'ordre chronologique strict, par une seule boucle, qui appelle
systématiquement le même chemin de décision que la prod. Modèle hybride
recommandé : **la boucle de décision reste séquentielle** (garantit qu'aucune
information du futur ne fuite vers le passé), mais **le chargement des
données et le calcul des métriques peuvent être vectorisés/batchés** pour la
vitesse.

Un vrai bus d'événements ne gagnerait sa place que pour un rejeu **live**
intra-match minute par minute (LIVE_VALUE, Phase 2+) — pas pour les
backtests pré-match actuels.

## 5. Design du package

```
packages/backtest-core/
  src/
    point-in-time-loader.ts   ← correctif structurel : impossible de lire
                                 une donnée postérieure à `asOf` — SEUL
                                 fichier du package qui a le droit de
                                 toucher @evcore/db (garde-fou testé)
    replay-engine.ts          ← boucle chronologique (fixtures = événements,
                                 walk strict par scheduledAt)
    backtest-runner.ts        ← façade CLI (à venir)
    architecture.guard.spec.ts
```

**Métriques** : pas de module dédié — `@evcore/analysis-core` a déjà
`metrics/scoring.ts` (`brierScoreOneXTwo`, `calibrationError`) et
`metrics/roi.ts` (`flatRoi`, `maxDrawdown`, `evBins`), purs, testés. Le
harnais les réutilise ; les 27 scripts recalculaient chacun leur propre
version.

### `point-in-time-loader.ts` — le correctif structurel

Au lieu de faire confiance à chaque script pour "ne pas lire le futur", on
rend l'erreur impossible à écrire : toute lecture passe par un
`PointInTimeContext { asOf: Date }`, et chaque requête est bornée par
construction. Le point clé (recherche §backtest-harness, conversation
2026-08-17) : ce n'est pas la date de l'événement qui compte, c'est **la
date à laquelle l'information est devenue connue** — une snapshot de cotes,
une stat rolling, un Elo, tous filtrés par leur propre horodatage
d'enregistrement `<= asOf`, pas seulement `scheduledAt <= asOf` sur la
fixture.

Première capacité : cotes (`loadOdds`/`loadOddsBatch`), en réutilisant
`assembleFullOddsSnapshot` de `@evcore/analysis-core` (donc garanti
identique au comportement prod post-fix), et énumération des fixtures
(`listFixtures` — chronologique, `FixtureStatus.FINISHED` uniquement avec
score non nul, filtré par `Competition.includeInBacktest`). Les autres
sources (team stats rolling, H2H, Elo FRI…) suivront le même patron — une
méthode de plus sur `PointInTimeLoader`, jamais de Prisma brut ailleurs dans
le package.

### `replay-engine.ts` — la boucle chronologique

`ReplayEngine.replay(options)` est un générateur async : il énumère les
fixtures via `PointInTimeLoader.listFixtures` (déjà triées par
`scheduledAt`), puis pour chacune construit son propre
`PointInTimeContext { asOf: fixture.scheduledAt }` et résout les cotes avec
**ce** cutoff — jamais un cutoff partagé pour tout le run. Générateur plutôt
que tableau : un replay sur une saison complète, c'est des milliers de
fixtures : le script appelant consomme un `ReplayStep` à la fois au lieu de
tout charger en mémoire.

Portée actuelle : cotes + team stats. Un replay complet du score
déterministe a aussi besoin de H2H, congestion, Elo FRI — chacune une
future méthode sur `PointInTimeLoader`, branchée dans `ReplayStep` de la
même façon.

### Team stats — politique de repli cross-compétition extraite

`PointInTimeLoader.loadTeamStats()` reproduit exactement la logique de
`BettingEngineService.analyzeFixture` (stats saison courante avant `asOf`,
repli cross-compétition pour l'Europe/sélections nationales/rollover
domestique). La politique de décision (`resolveEffectiveTeamStats` — quand
blender, avec quels poids) a été extraite en fonction pure dans
`packages/analysis-core/src/probability/team-stats-resolution.ts`
(2026-08-18), aux côtés des constantes (`isEuropeanCompetition`,
`isNationalTeamCompetition`, poids de blend, `DOMESTIC_SEASON_ROLLOVER_MIN_GAMES`).
`apps/backend/.../ev.constants.ts` les ré-exporte désormais au lieu de les
dupliquer. Comme pour les cotes : une seule implémentation de la politique,
partagée par la prod et le harnais — seule la logique de *fetch* (quelles
lignes aller chercher, avec quel `asOf`) reste distincte entre
`BettingEngineService` (Prisma direct, requêtes "maintenant") et
`PointInTimeLoader` (Prisma direct, requêtes bornées par `asOf`).

Les cas d'usage qui n'ont besoin que "à quoi ressemblait le marché au coup
d'envoi" (audits de calibration comparant la probabilité moteur à la cote
de clôture, par ex.) étaient déjà servis par les cotes seules ; ceux qui ont
besoin de reconstruire le λ Poisson lui-même (donc la probabilité moteur)
le sont désormais aussi, pour le cas majoritaire (compétitions domestiques
à échantillon établi, Europe, sélections nationales).

### H2H et congestion — même patron, extraits le 18/08

`H2HService` (`computeH2HScore`, `computeH2HMarketSignals`,
`computeH2HScorelineSignal`) et `CongestionService` étaient déjà
structurés comme le futur `resolveEffectiveTeamStats` : une requête Prisma
déjà point-in-time-safe par construction (`scheduledAt: { lt: fixtureDate }`)
suivie d'un calcul pur. Extraction identique : le calcul pur part dans
`packages/analysis-core/src/probability/h2h.ts` et `congestion.ts`, les deux
services backend deviennent de purs appelants Prisma, et
`PointInTimeLoader` gagne `loadH2HLegs`/`loadH2HScore`/
`loadH2HMarketSignals`/`loadH2HScorelineSignal` et `loadCongestionScore`.

Note sur `loadCongestionScore` : la moitié "fixtures à venir" de son calcul
lit des fixtures `SCHEDULED` **après** `asOf` — ce n'est pas une fuite de
futur au sens où on l'entend ici (aucun résultat n'est lu, seulement le
calendrier, une donnée légitimement connue à l'avance).

### Ce qui reste pour un replay complet

**Elo FRI** (`fri-model.service.ts`/`fri-model.utils.ts`, canal FRI —
sélections nationales hors tournoi majeur) n'est pas encore extrait. Déjà
structuré pareil (utils purs + service I/O, avec ses propres tests), donc
le même patron s'applique — reporté : c'est un canal de niche (V1 limitée à
`ONE_X_TWO`, fallback hors pipeline Poisson principal), pas nécessaire pour
que le harnais couvre le cas majoritaire des compétitions domestiques/
européennes/sélections nationales en tournoi. Voir TODO.md.

## 6. Migration des 27 scripts (plus tard, pas ce soir)

Les scripts `packages/db/scripts/backtest-*.ts` deviendront de fins
wrappers CLI : parsing d'arguments + appel à `backtest-core` + écriture du
rapport. Priorité de migration : les 10 scripts identifiés §1 comme
n'utilisant pas `analysis-core` — candidats les plus probables au même bug
que le whitelist.

## 7. Sources consultées (août 2026)

- Walk-forward, point-in-time, biais de look-ahead : Great Bets
  (<https://www.greatbets.co.uk/how-to-backtest-a-sports-betting-strategy-without-overfitting/>),
  GoaliQ (<https://www.goaliqai.com/backtesting-a-football-betting-model-explained/>),
  BALLDONTLIE (<https://www.balldontlie.io/blog/why-backtesting-matters/>).
- Architecture event-driven de backtest : Timothy Kimutai
  (<https://timkimutai.medium.com/how-i-built-an-event-driven-backtesting-engine-in-python-25179a80cde0>),
  Jakub Polec
  (<https://medium.com/@jpolec_72972/building-a-robust-backtesting-framework-event-driven-architecture-22aa77eedf34>).
- Données point-in-time / "as of" : Quantopian look-ahead bias
  (<https://www.quantopian.com/posts/look-ahead-bias-point-in-time-fundamental-data-in-research>),
  sharpely.in
  (<https://sharpely.in/blog/bias-free-backtesting-explained:-how-sharpely-uses-point-in-time-data-to-avoid-look-ahead-and-survivorship-bias>).
