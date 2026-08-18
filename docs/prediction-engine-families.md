# Familles de moteurs prédictifs

> Statut : note de cadrage stratégique, **non implémentée**.
>
> Objectif : identifier les **familles de moteurs prédictifs** qu'EVCore doit
> porter — pas marché par marché, pas sport par sport, mais par **processus
> générateur partagé** — pour que l'architecture des canaux
> (`docs/channel-strategy-architecture.md`) s'articule sur des fondations
> qui n'auront pas besoin d'être redécoupées à chaque nouveau marché.
>
> **Portée actuelle : football, marchés déjà en scope (EVCORE.md §3.3)
> uniquement.** La section 0 ci-dessous est la portée de travail réelle. Les
> sections 1 à 4 (cross-sport) sont une vision long terme volontairement mise
> en pause — voir `docs/multi-sport-extension.md` §5 : ne pas ouvrir de sport
> tant que le football n'est pas rentable. Elles sont conservées pour que
> l'architecture football ne soit pas redécoupée le jour où la question se
> posera, pas comme un chantier actif.

## 0. Portée actuelle — football, marchés existants

### 0.1 Carte canal → famille

EVCore a aujourd'hui 20 canaux actifs (`registry.ts`, `V1_STRATEGIES`). Le
nombre ne change pas : ce qui change, c'est la famille qui nourrit chacun, et
pour VALUE/SAFE, la phase à laquelle ils s'exécutent.

| Canal(aux)                                                                                                              | Marché(s)                                                         | Famille                            | Statut du moteur                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOMINANT, GOALS, CLEAN_SHEET, TEAM_TOTAL, DOUBLE_CHANCE, DRAW_NO_BET, WIN_TO_NIL, RESULT_TOTAL_GOALS, RESULT_BTTS, BTTS | 1X2, O/U, Clean Sheet, Team Total, DC, DNB, WTN, composites, BTTS | **A — Poisson plein-match**        | Existant, mature (`lambda.home`/`lambda.away`, corrigé H2H)                                                                                                                             |
| CORRECT_SCORE                                                                                                           | Score exact                                                       | **A-bis — matrice complète**       | Existant, validé 2026-08-15 (signal H2H scoreline)                                                                                                                                      |
| WIN_EITHER_HALF, OVER_UNDER_HT, FIRST_HALF_WINNER, HALF_TIME_FULL_TIME                                                  | Marchés mi-temps                                                  | **A' — distribution buts 1ère MT** | **Faux moteur** : `lambda × 0.44` fixe, aucune calibration ligue/équipe (`FIRST_HALF_GOAL_FRACTION`, poisson.ts:23) — cause probable du HT Over désactivé (recalibration WC 2026-07-01) |
| DRAW                                                                                                                    | ONE_X_TWO (DRAW)                                                  | **D — implicite marché**           | Existant, correct (`1/drawOdds`)                                                                                                                                                        |
| VALUE, SAFE                                                                                                             | transversal                                                       | _filtres_, pas une famille         | Existant mais mal placé — scanne `evaluatedMarkets` en Phase 1 au lieu de filtrer les décisions Phase 1 des 16 autres canaux                                                            |
| CONSENSUS, AVOID                                                                                                        | méta                                                              | lisent tout le reste               | Existant, Phase 2                                                                                                                                                                       |

### 0.2 Pipeline de lecture d'une fiche de match (cible)

1. **Fiche brute** (inchangé) — `BettingEngineService.analyzeFixture()` :
   stats rolling, xG, forme dom/ext, volatilité ligue, blessures/H2H/congestion
   (shadow), dernière snapshot de cotes.
2. **Chaque famille calcule sa distribution indépendamment** à partir de
   cette même fiche :
   - Famille A : `lambda.home`/`lambda.away` (existant) ;
   - Famille A' : **à construire** — un λ 1ère mi-temps calibré par ligue,
     indépendant du λ plein-match, remplaçant `FIRST_HALF_GOAL_FRACTION` ;
   - Famille A-bis : réutilise la distribution complète de A + signal H2H
     scoreline (existant) ;
   - Famille D : lit directement la cote, aucun calcul.
3. **Chaque famille déverse ses picks évalués** (proba, cote, EV,
   qualityScore) dans le même format `EvaluatedPick` — aujourd'hui une seule
   fonction (`listEvaluatedPicks`) le fait depuis un seul λ ; demain, chaque
   moteur de famille contribue sa tranche de marchés.
4. **`buildStrategyContext()` groupe par marché** (`evaluatedMarkets`) —
   mécaniquement inchangé, juste alimenté par plusieurs moteurs.
5. **Orchestrateur, 3 phases** :
   - **Phase 1 — 16 canaux de marché** : chacun choisit la meilleure
     prédiction de son marché, dans sa famille.
   - **Phase 2 — VALUE, SAFE** (déplacés ici) : ne touchent plus
     `evaluatedMarkets`, lisent `previousDecisions` (les 16 décisions de
     Phase 1) et filtrent par edge/probabilité ce qui a déjà été jugé bon par
     le spécialiste du marché.
   - **Phase 3 — CONSENSUS, AVOID** : inchangé.
6. **Sortie** : 20 `StrategyDecision` par fixture → `ChannelDecision` +
   `ModelRun`, comme aujourd'hui. Le statut « staké ou non » reste une
   décision downstream séparée (générateur de coupon), jamais un attribut du
   canal.

### 0.3 Chantiers concrets, dans l'ordre

1. **Famille A'** : remplacer `FIRST_HALF_GOAL_FRACTION = 0.44` par un ratio
   calibré par ligue (voire par équipe si le volume le permet) sur la donnée
   réelle de buts avant 45'. Mono-sport, mono-famille, corrige un biais déjà
   identifié (HT Over désactivé) — premier cas réel pour valider le
   découpage avant de toucher à VALUE/SAFE.
   - **À vérifier à ce moment-là** (noté 2026-08-17, pas encore fait) :
     `OU_HT_PICKS` ne couvre que `0.5`/`1.5` (`ouHT` dans `poisson.ts`,
     `pick-evaluation.ts`) — contrairement à `OVER_UNDER` plein-match qui va
     jusqu'à `4.5`. Cohérent avec le domaine actuel (peu de buts en une
     mi-temps), mais à confirmer sur la donnée réelle si les bookmakers
     cotent des lignes `2.5`+ en pratique une fois le vrai moteur mi-temps
     construit — sinon `2.5`+ reste hors scope sans jamais avoir été
     explicitement tranché.
2. **VALUE/SAFE en Phase 2** : `value.strategy.ts` et `safe.strategy.ts`
   cessent de scanner `context.evaluatedMarkets` et lisent
   `context.previousDecisions` à la place ; déplacement de `VALUE`/`SAFE`
   hors de la boucle Phase 1 de l'orchestrateur (`orchestrator.ts`), aux
   côtés de `CONSENSUS`/`AVOID`.
3. **Audit de calibration par (marché × ligue)** une fois les deux premiers
   chantiers faits, pour établir lesquels des 16 canaux de marché méritent
   réellement d'alimenter VALUE/SAFE aujourd'hui.

Aucun de ces trois chantiers n'ouvre de nouveau marché ni de nouveau sport —
strictement une reformulation interne de ce qui existe déjà.

---

## 1. Vision long terme — familles cross-sport (non prioritaire)

> À partir d'ici, le document explore le cadrage multi-sport. Rien de cette
> section n'est planifié ; elle existe pour que la Famille A/A'/D ci-dessus
> ne soit pas redécoupée le jour où `docs/multi-sport-extension.md` autorise
> l'ouverture d'un second sport.

### 1.1 Principe directeur

Une famille de moteur n'est pas définie par le sport, ni par le marché, mais
par **le processus stochastique qui engendre le résultat**. Deux marchés de
deux sports différents peuvent partager la même famille (les cartons au
football et les fautes au basket sont tous les deux des processus d'arrivée
d'événements discrets) ; deux marchés du même sport peuvent appartenir à des
familles différentes (buts et cartons au football n'ont pas le même
générateur, même si les deux utilisent une loi de Poisson — voir §3.1).

C'est la correction à apporter à `docs/multi-sport-extension.md` §2, qui
pose aujourd'hui « un socle par sport ». Plus précis : **un moteur par
famille de processus générateur, réutilisé par tous les sports qui
partagent cette famille.** Le socle réellement spécifique au sport, ce sont
les _paramètres d'entrée_ du moteur (xG et forme pour le football, rating
d'efficacité × rythme pour le basket, Elo par surface pour le tennis), pas
la famille elle-même.

### 1.2 Les familles identifiées

### Famille A — Processus d'arrivée d'événements discrets (Poisson / binomiale négative)

Événements comptables, à faible fréquence, qui s'accumulent au fil du match
comme un flux d'arrivées indépendantes (ou faiblement dépendantes) du temps.
C'est la famille la mieux établie en football, mais elle n'est pas propre au
football.

- **Générateur** : loi de Poisson (ou binomiale négative si surdispersion),
  taux d'arrivée λ dépendant du contexte (équipe, adversaire, référentiel de
  ligue) ; extensions par régresseurs dynamiques (score courant, cartons déjà
  distribués) pour les modèles les plus récents.
- **Marchés couverts (football, existant EVCore)** : 1X2, Over/Under, BTTS,
  Clean Sheet, Team Total, Win to Nil, Double Chance, Draw No Bet, Win Either
  Half — tout ce qui dérive de la distribution de buts fin de match (déjà la
  « Famille 1 » identifiée dans cette conversation).
- **Marchés couverts (football, pas encore modélisés séparément)** :
  **cartons/bookings** — la littérature confirme qu'un modèle Poisson dédié
  (pas le même λ que les buts) capture bien le comptage de cartons, avec un
  effet arbitre significatif (± 20 % ou plus selon l'arbitre désigné) et une
  composante temporelle. **Corners, tirs cadrés** appartiennent à la même
  famille.
- **Marchés couverts (autres sports)** : fautes au basket, pénalités au
  hockey, corners au handball — tout comptage d'événements discrets à faible
  fréquence sur la durée du match.
- **Ce que ça implique pour EVCore** : les cartons ne sont pas juste « un
  nouveau marché à ajouter au Poisson buts existant » — c'est un **second
  moteur de la même famille**, avec son propre λ (taux de cartons par
  équipe/arbitre/ligue), séparé du λ buts. Même famille de processus, deux
  instances distinctes.

### Famille B — Processus de marge/total continu (proche-normal, sports à score élevé)

Sports où le score final résulte d'un très grand nombre de possessions à
faible variance individuelle, si bien que l'écart de score (marge) et le
total converge vers une distribution quasi-continue plutôt qu'un comptage
Poisson à faible fréquence.

- **Générateur** : la marge de victoire observée suit une loi **normale**
  centrée sur le spread pré-match, écart-type mesuré (~14 points en NFL) ;
  au basket, le score se module plutôt par **rythme (pace) × efficacité
  offensive/défensive par possession** que par un comptage d'événements rares.
- **Marchés couverts** : moneyline, spread/handicap en points, total de
  points — basketball (NBA, Euroleague), football américain, potentiellement
  handball (scores élevés, structure de jeu comparable).
- **Différence avec la Famille A** : ce n'est pas un flux de rares
  événements indépendants (un but toutes les ~50 minutes de jeu utile) mais
  une accumulation dense de scores fréquents — le régime asymptotique change
  la loi de la variable, pas juste son échelle. Réutiliser un moteur Poisson
  buts pour prédire un total de points basket serait un mauvais choix de
  famille, pas juste un mauvais paramétrage.
- **Ce que ça implique** : si EVCore ouvre le basket un jour (recommandé en
  3ᵉ position dans `multi-sport-extension.md` §5), ce n'est **pas** un
  nouveau socle Poisson à réentraîner — c'est une famille entièrement
  différente à construire, la Famille B.

### Famille C — Structure hiérarchique point → jeu → set (sports de raquette/filet)

Tennis, volleyball, tennis de table, badminton. La victoire au niveau
supérieur (set, match) se déduit d'une chaîne de probabilités au niveau
inférieur (probabilité de gagner un point au service/relance), pas d'un
comptage de buts.

- **Générateur** : modèle hiérarchique/Markov — probabilité de point
  (service/retour) → probabilité de jeu (formule fermée binomiale) →
  probabilité de set → probabilité de match. Le volleyball ajoute un second
  étage (modèle binomial pour le set gagnant, binomiale négative tronquée
  pour l'écart de points du perdant).
- **Marchés couverts** : vainqueur, total de jeux/points, handicap de
  jeux/points, vainqueur du premier set.
- **Paramètres d'entrée sport-spécifiques** : Elo par surface (tennis — pèse
  ≈ 44 % du rating total selon la littérature citée dans
  `multi-sport-extension.md`), ratios service/retour par joueur.
- **Ce que ça implique** : c'est la famille pressentie pour le **2ᵉ sport**
  d'EVCore (tennis, déjà recommandé en priorité dans
  `multi-sport-extension.md` §5) — et le volleyball ou le tennis de table
  pourraient réutiliser directement cette même famille C plus tard, avec
  seulement de nouveaux paramètres d'entrée, pas un nouveau moteur.

### Famille D (fallback transversal) — Probabilité implicite du marché, sans moteur interne

Ce n'est pas un processus générateur — c'est un aveu structuré que le modèle
interne ne bat pas le marché sur ce point précis, quel que soit le sport.

- **Déjà en production** : DRAW au football (`1/drawOdds` comme signal
  principal, parce que le Poisson plafonne structurellement autour de 0.32
  de probabilité de nul).
- **Généralisable** : chaque famille A/B/C peut avoir des marchés ou des
  segments où le moteur interne est prouvé structurellement faible (ex. le
  favorite-longshot bias documenté en tennis dans `multi-sport-extension.md`
  — le taux de perte réel des outsiders y est ≈ 40 % au-dessus du prédit).
  Dans ce cas, le bon choix architectural n'est pas de forcer un modèle
  interne coûte que coûte, mais de basculer ce marché précis sur la Famille D
  — un pattern déjà validé sur DRAW, à traiter comme une **famille légitime**
  plutôt qu'une bidouille locale.

### 1.3 Deux couches transversales — pas des familles, des traitements au-dessus des familles

### 3.1 Marchés composites/corrélés

HT/FT, Result + Total Goals, Result + BTTS au football ; race-to-X combiné
au moneyline en basket ; combos set + total au tennis. Ce ne sont pas de
nouveaux processus générateurs — ce sont des **combinaisons du produit
cartésien** de sorties déjà produites par une (ou deux) famille(s)
existante(s). EVCore a déjà appris cette leçon une fois (EVCORE.md
§3.3 « Marchés pré-combinés ») : préférer une vraie cote bookmaker
pré-combinée à une probabilité jointe synthétique recalculée en interne.
Cette couche devrait être un **module de pricing composite** générique,
appliqué au-dessus de n'importe quelle famille, pas dupliqué par marché.

### 3.2 Granularité joueur (player props)

Points/rebonds/passes au basket, tirs cadrés/buts au football, retours
gagnés au tennis. Ce n'est pas une famille à part — c'est le **même
générateur que la famille du sport, appliqué à la granularité joueur**
plutôt qu'équipe, ajusté par un facteur d'usage (usage rate / minutes
projetées / rôle dans le système de jeu). Explicitement **hors scope
EVCORE.md aujourd'hui** (pas dans le §3.3 marchés ciblés) — à ne pas ouvrir
sans le même arbitrage de phase que multi-sport (cf. `CLAUDE.md`, table
Phase Boundaries), simplement noté ici pour que l'architecture n'ait pas à
être redécoupée le jour où la question se posera.

### 1.4 Ce que ça change pour l'architecture cible

| Famille                               | Processus                         | Sports concernés (aujourd'hui + à terme)                                              | Statut EVCore                                             |
| ------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A — Arrivée discrète (Poisson/NegBin) | Comptage d'événements rares       | Football (buts ✅, cartons/corners à construire), basket (fautes), hockey (pénalités) | Moteur buts existant ; cartons = 2ᵉ instance à construire |
| B — Marge/total continu               | Score dense, quasi-normal         | Basket, football américain, handball                                                  | Inexistant — nécessaire si basket s'ouvre                 |
| C — Hiérarchique point→jeu→set        | Chaîne Markov/binomiale imbriquée | Tennis, volleyball, tennis de table, badminton                                        | Inexistant — pressenti pour le 2ᵉ sport (tennis)          |
| D — Implicite marché (fallback)       | Aucun — lecture de cote dévigée   | Tous, marché par marché où le moteur interne est prouvé faible                        | Existant sur DRAW, à généraliser comme pattern explicite  |

La conséquence architecturale directe : la couche `ChannelStrategy` /
`StrategyContext` (déjà découplée du calcul de probabilité, voir
`channel-strategy-architecture.md`) n'a **aucune raison de changer** quand
une famille B ou C apparaît — elle consomme déjà une `probabilities` /
`evaluatedMarkets` générique. Ce qui doit changer, c'est en amont : au lieu
d'un seul générateur (`lambda` Poisson football) injecté dans
`buildStrategyContext`, il faut une interface `PredictionEngine` par
famille, et chaque (sport, marché) déclare quelle famille l'alimente. Le
sport n'écrit pas « son » socle from scratch — il branche ses paramètres
d'entrée sur le moteur de famille qui correspond à son processus générateur,
et n'écrit un nouveau moteur que si sa famille n'existe pas encore (ex.
tennis → Famille C, à écrire une fois ; volleyball, plus tard → même
Famille C, juste de nouveaux paramètres).

### 1.5 Recommandation

1. Ne pas construire les Familles B/C maintenant — même discipline que
   `multi-sport-extension.md` §5 (le football doit d'abord être rentable).
2. Mais **poser dès maintenant l'interface `PredictionEngine` par famille**
   dans le refactor des canaux en cours — c'est un coût faible aujourd'hui
   (un seul point d'injection à définir proprement) et un coût élevé plus
   tard (retrouver et découpler tous les endroits où le code suppose « la
   probabilité vient d'un Poisson buts »).
3. Traiter les **cartons** comme premier test de la Famille A à deux
   instances (buts + cartons, même famille, deux moteurs) — c'est un
   chantier mono-sport, mono-famille, donc sans le risque du multi-sport, et
   ça validerait le découpage avant d'ouvrir un sport.
4. Traiter la Famille D (implicite marché) comme un **pattern de première
   classe**, pas une exception DRAW — tout marché de toute famille peut y
   basculer si l'audit de calibration (déjà demandé plus tôt dans cette
   conversation) prouve un biais structurel non corrigible.

## 2. Sources consultées (août 2026)

- Poisson en football (buts) : « Predicting Football Match Results Using a
  Poisson Regression Model »
  (<https://www.mdpi.com/2076-3417/14/16/7230>) ; double Poisson Euro 2020
  (<https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9119507/>).
- Modèles dynamiques (buts, cartons, blessures comme processus d'arrivée) :
  « Stochastic modelling of football matches »
  (<https://arxiv.org/pdf/2312.04338>).
- Modélisation des cartons (Poisson dédié, effet arbitre) :
  « Modelling bookings in association football »
  (<https://eprints.whiterose.ac.uk/id/eprint/229624/1/Modelling_bookings_in_association_football.pdf>),
  « Referee Card Stats: Using Discipline Data for Betting »
  (<https://planetefootball.com/guides/referee-card-stats-betting>),
  « Booking Points Calculator »
  (<https://gamblingcalc.com/betting/football/cards-booking-points-calculator/>).
- Basketball — modèles de marge/possession : « A gamma process based in-play
  prediction model for NBA games »
  (<https://www.sciencedirect.com/science/article/abs/pii/S0377221719309233>),
  Shirley 2007 (chaîne de Markov par possession), « Predicting NBA Win Totals
  and Point Spreads »
  (<https://medium.com/@jriordan1/predicting-2023-24-nba-win-totals-a515b6f845cc>).
- Distribution normale de la marge (NFL/NBA autour du spread) :
  « Predicting Scores Using Vegas Point Spreads in Football & Basketball »
  (<https://www.boydsbets.com/ats-margin-standard-deviations-by-point-spread/>),
  « FORMULATING OPTIMAL BETTING STRATEGIES… »
  (<https://scholarworks.calstate.edu/downloads/2j62s5932>).
- Modèles hiérarchiques point→jeu→set (tennis, volleyball) : « A Bayesian
  Quest for Finding a Unified Model for Predicting Volleyball Games »
  (<https://arxiv.org/pdf/1911.01815>), « A point-based Bayesian
  hierarchical model »
  (<https://martiningram.github.io/papers/bayes_point_based.pdf>), « The
  Winning Probability of a Game and the Importance of Points in Tennis
  Matches »
  (<https://www.researchgate.net/publication/337993303_The_Winning_Probability_of_a_Game_and_the_Importance_of_Points_in_Tennis_Matches>).
- Player props (granularité joueur, usage rate) : « Sports Betting
  Probability Models Explained »
  (<https://turtleevlabs.com/blog/sports-betting-probability-models>), «
  Finding profitable player props: basketball and football »
  (<https://kazibet.com/prop-bets-guide-how-to-find-profitable-player-props-in-basketball-and-football/>).
- Voir aussi `docs/multi-sport-extension.md` (juin 2026) pour le classement
  des sports candidats et les critères d'ouverture — ce document-ci ne
  remet pas en cause son calendrier, seulement la mécanique de « socle par
  sport » vs « moteur par famille ».
