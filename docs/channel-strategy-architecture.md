# Architecture des canaux de stratégie

> Statut : proposition d'architecture cible, non implémentée.
>
> Objectif : rendre explicite le fonctionnement multi-canal d'EVCore, réduire
> les ambiguïtés du modèle actuel et faciliter l'ajout de nouvelles stratégies.

## 1. Contexte

EVCore ne produit plus une décision unique par match. Une même analyse calcule
un socle probabiliste commun, puis plusieurs stratégies indépendantes
interprètent ce socle avec leurs propres objectifs, seuils et règles de
sélection.

Les cinq canaux actuels sont :

- `EV` : recherche de valeur attendue positive ;
- `SV` : recherche d'une sélection plus probable et moins volatile ;
- `CONF` : issue directionnelle dominante sur le marché 1X2 (renommé
  `DOMINANT` dans l'enum cible, voir sections 6 et 15) ;
- `BB` : stratégie spécialisée sur les deux équipes qui marquent ;
- `NUL` : stratégie spécialisée sur le match nul.

Le moteur calcule notamment :

- les lambdas domicile et extérieur ;
- les distributions de Poisson ;
- les probabilités 1X2, BTTS, Over/Under et marchés dérivés ;
- le score déterministe ;
- les cotes disponibles et leurs probabilités implicites ;
- les signaux contextuels ou shadow.

Chaque canal applique ensuite sa propre politique. Par conséquent, un match
peut avoir `EV = NO_SELECTION` tout en ayant une sélection `BB`, `NUL` ou
`CONF` valide.

## 2. Problème de l'architecture actuelle

L'architecture actuelle fonctionne, mais son vocabulaire et sa persistance
rendent le domaine ambigu.

### 2.1 `ModelRun.decision` ressemble à une décision globale

`ModelRun.decision` vaut aujourd'hui `BET` ou `NO_BET`. En pratique, cette
décision décrit principalement le canal EV. Elle ne signifie pas que tous les
autres canaux ont refusé le match.

Exemple possible aujourd'hui :

```text
ModelRun.decision = NO_BET
CONF              = HOME
BB                = YES
NUL               = aucune sélection
```

Le nom `decision` masque donc la portée réelle de l'information.

### 2.2 Les canaux sont stockés dans plusieurs modèles différents

- `EV` et `SV` sont matérialisés dans `Bet` ;
- `CONF`, `DRAW` et `BTTS` sont matérialisés dans `Prediction` ;
- `SV` est distingué d'EV avec `isSafeValue` ;
- l'enum `PredictionChannel` ne contient ni `EV` ni `SV`.

Pire : il existe aujourd'hui **trois vocabulaires concurrents** pour la même
notion de canal :

- `PredictionChannel = { CONF, DRAW, BTTS }` ;
- `CouponLegCanal = { EV, SV, BB, NUL, CONF }` ;
- la convention implicite `isSafeValue` qui dérive `SV` à partir d'`EV` dans `Bet`.

Le rapport et les APIs doivent donc reconstruire la notion de canal à partir de
plusieurs conventions techniques incohérentes entre elles. Un enum `StrategyChannel`
unique (section 4.3) remplace ces trois vocabulaires.

### 2.3 Un pari et une décision analytique sont deux concepts différents

Une stratégie peut sélectionner un signal sans qu'une mise soit réellement
placée. À l'inverse, un utilisateur peut créer un pari depuis un marché que le
moteur n'a pas sélectionné.

Le modèle cible doit distinguer :

- **la décision analytique** produite par une stratégie ;
- **la sélection** recommandée par cette décision ;
- **le pari** effectivement enregistré ou exécuté.

### 2.4 Les cycles de vie ne sont pas homogènes

Les analyses J-, JT et éventuellement live peuvent recalculer les probabilités
et modifier les choix. Il faut pouvoir répondre sans ambiguïté à ces questions :

- quelle stratégie a pris cette décision ?
- sur quel `ModelRun` ?
- à quel instant par rapport au coup d'envoi ?
- quelle version de configuration a été utilisée ?
- la décision a-t-elle remplacé une décision précédente ?
- quelle décision a finalement été publiée ou jouée ?

La section 8.1 tranche ces questions en posant le **grain** d'un `ModelRun`
(une exécution immuable, `Fixture → ModelRun` en 1-à-N).

## 3. Principe directeur

Un **canal représente une stratégie de sélection**, pas un marché.

Le marché décrit ce sur quoi porte la sélection : `ONE_X_TWO`, `BTTS`,
`OVER_UNDER`, `DOUBLE_CHANCE`, etc.

La stratégie décrit pourquoi cette sélection existe : valeur, sécurité,
confiance, consensus, désaccord avec le marché, protection contre le risque,
ou autre objectif mesurable.

```text
Analyse commune du match
          |
          v
Probabilités + cotes + contexte
          |
          +--> stratégie EV ----------> sélection éventuelle
          +--> stratégie SV ----------> sélection éventuelle
          +--> stratégie DOMINANT --> sélection éventuelle
          +--> stratégie BB ----------> sélection éventuelle
          +--> stratégie NUL ---------> sélection éventuelle
          +--> stratégie future ------> sélection éventuelle
```

### 3.1 Deux familles de canaux

Tous les canaux sont **indépendants** : chacun décide seul, avec ses propres
seuils et règles. Mais ils ne sont pas tous libres sur le choix du marché. On
distingue deux familles, et chaque canal déclare explicitement à laquelle il
appartient via ses **marchés autorisés** (`allowedMarkets`).

**Canaux spécialisés marché (market-bound)** — contraints à un marché unique.
La stratégie *est* le marché : elle ne peut émettre qu'un pick de ce marché.

- `BB` ne produit que des picks `BTTS` ;
- `NUL` ne produit que `ONE_X_TWO / DRAW` ;
- `DOMINANT` (ex-`CONF`) ne produit que `ONE_X_TWO` (`HOME`, `DRAW`, `AWAY`) ;
- `GOALS` ne produit que `OVER_UNDER` ;
- `FIRST_HALF` ne produit que des marchés de mi-temps ;
- `DOUBLE_CHANCE` ne produit que `DOUBLE_CHANCE`.

**Canaux transverses (market-agnostic)** — libres sur le marché. La stratégie
est un objectif (valeur, sécurité, désaccord, protection…) qui peut s'exprimer
sur **n'importe quel marché autorisé** ; le pick dépend du match, pas du canal.

- `EV`, `SV`, `UNDERDOG`, `FAVORITE`, `MARKET_MOVE`, `LIVE_VALUE`, `CONSENSUS`,
  `CONTRARIAN`, `AVOID`.

Invariant à faire respecter en persistance et dans le contrat : pour toute
`ChannelSelection`, `selection.market ∈ channel.allowedMarkets`. Un canal
spécialisé a un `allowedMarkets` singleton (ou restreint) ; un canal transverse
a l'ensemble complet des marchés évaluables. C'est cet invariant qui garantit
qu'un canal `BB` ne pourra jamais émettre autre chose qu'un pick BTTS, alors
qu'un canal `EV` peut, lui, retenir le meilleur marché du match.

## 4. Architecture cible

### 4.1 Vue générale

```text
Fixture
  └── AnalysisRun
        ├── snapshot des features
        ├── probabilités communes
        ├── cotes utilisées
        ├── phase temporelle : J_MINUS | MATCH_DAY | LIVE
        └── ChannelDecision[]
              ├── channel
              ├── status
              ├── raison
              ├── configuration utilisée
              └── ChannelSelection[]
                    ├── marché et pick
                    ├── probabilité
                    ├── cote et EV
                    ├── score de qualité
                    └── résultat
```

`AnalysisRun` peut rester l'actuel `ModelRun`, éventuellement renommé plus
tard. Le changement essentiel est l'ajout d'une représentation uniforme des
décisions par canal.

### 4.2 Statuts de décision

Une stratégie doit produire une décision même lorsqu'elle ne sélectionne rien.
Cela rend les absences explicables et analysables.

```ts
type ChannelDecisionStatus =
  | "SELECTED"
  | "REJECTED"
  | "DISABLED"
  | "INSUFFICIENT_DATA"
  | "MISSING_ODDS"
  | "NOT_APPLICABLE";
```

Exemples :

- `SELECTED` : au moins une sélection a été retenue ;
- `REJECTED` : des candidats existaient, mais aucun ne passait les règles ;
- `DISABLED` : canal désactivé pour cette compétition ;
- `INSUFFICIENT_DATA` : historique ou qualité de données insuffisants ;
- `MISSING_ODDS` : stratégie dépendante des cotes impossible à calculer ;
- `NOT_APPLICABLE` : stratégie non pertinente dans cette phase du match.

### 4.3 Modèle Prisma indicatif

Le schéma exact devra être validé avant migration. Cette proposition favorise
l'historique par run et autorise plusieurs sélections dans un même canal.

```prisma
enum StrategyChannel {
  EV
  SV
  DOMINANT // ex-CONF
  BB
  NUL
  GOALS
  FIRST_HALF
  DOUBLE_CHANCE
  UNDERDOG
  FAVORITE
  LIVE_VALUE
  MARKET_MOVE
  CONSENSUS
  CONTRARIAN
  AVOID
}

enum ChannelDecisionStatus {
  SELECTED
  REJECTED
  DISABLED
  INSUFFICIENT_DATA
  MISSING_ODDS
  NOT_APPLICABLE
}

model ChannelDecision {
  id            String                @id @default(dbgenerated("uuidv7()")) @db.Uuid
  modelRunId    String                @db.Uuid
  modelRun      ModelRun              @relation(fields: [modelRunId], references: [id])
  channel       StrategyChannel
  status        ChannelDecisionStatus
  reasonCode    String?
  reasonDetails Json?
  configVersion String?
  selections    ChannelSelection[]
  createdAt     DateTime              @default(now())

  // Un canal tranche une seule fois par exécution. Deux exécutions (J-, JT,
  // live, ou re-run) ont deux modelRunId distincts. Voir section 8.1 (grain).
  @@unique([modelRunId, channel])
  @@index([channel, status, createdAt])
}

model ChannelSelection {
  id                String          @id @default(dbgenerated("uuidv7()")) @db.Uuid
  channelDecisionId String          @db.Uuid
  channelDecision   ChannelDecision @relation(fields: [channelDecisionId], references: [id])
  market            Market
  pick              String
  comboMarket       Market?
  comboPick         String?
  probability       Decimal         @db.Decimal(5, 4)
  odds              Decimal?        @db.Decimal(6, 3)
  impliedProbability Decimal?       @db.Decimal(5, 4)
  ev                Decimal?        @db.Decimal(6, 4)
  qualityScore      Decimal?        @db.Decimal(6, 4)
  rank              Int             @default(1)
  result            BetStatus?
  settledAt         DateTime?
  createdAt         DateTime        @default(now())

  @@unique([channelDecisionId, rank])
  @@index([market, result, createdAt])
}
```

### 4.4 Pourquoi séparer décision et sélection ?

Cette séparation permet :

- de stocker un refus sans inventer un faux pick ;
- d'expliquer le refus avec un code stable ;
- d'autoriser plusieurs sélections pour une stratégie future ;
- de comparer les stratégies au niveau décision et au niveau marché ;
- de conserver `Bet` pour les mises réellement matérialisées.

Exemple : le canal `CONSENSUS` pourrait conserver deux sélections compatibles,
alors que le canal `EV` resterait limité à une seule sélection principale.

## 5. Contrat d'une stratégie

Chaque stratégie doit respecter un contrat commun et rester indépendante de la
persistance.

Conformément aux règles d'arithmétique du projet, toute valeur de probabilité,
de cote, d'EV ou de score est portée par `Decimal` (decimal.js / `Prisma.Decimal`),
jamais par `number` natif.

```ts
type StrategyContext = {
  fixture: FixtureSnapshot;
  phase: "J_MINUS" | "MATCH_DAY" | "LIVE";
  competitionCode: string;
  deterministicScore: Decimal;
  probabilities: ProbabilitySnapshot; // valeurs Decimal, bornées [0, 1]
  evaluatedMarkets: EvaluatedMarket[];
  odds: OddsSnapshot | null;
  signals: ContextSignals;
  previousDecisions: ReadonlyMap<StrategyChannel, StrategyDecision>;
};

type StrategyDecision = {
  channel: StrategyChannel;
  status: ChannelDecisionStatus;
  reasonCode?: string;
  reasonDetails?: Record<string, unknown>;
  selections: StrategySelection[];
};

interface ChannelStrategy {
  readonly channel: StrategyChannel;
  // Marchés que ce canal a le droit de sélectionner.
  // Singleton (ou restreint) pour un canal spécialisé, ensemble complet
  // pour un canal transverse. Voir section 3.1.
  readonly allowedMarkets: readonly Market[];
  evaluate(context: StrategyContext): StrategyDecision;
}
```

Invariant vérifié à la persistance (et idéalement en test unitaire de chaque
stratégie) : toute `selection.market` retournée par `evaluate` appartient à
`strategy.allowedMarkets`. Une sélection hors périmètre est un bug du canal, pas
une donnée à stocker — elle doit faire échouer le run, pas être enregistrée.

Le betting engine orchestre les stratégies, mais ne contient pas toutes leurs
règles dans une seule méthode.

```ts
const decisions = strategies.map((strategy) => strategy.evaluate(context));
await channelDecisionRepository.saveRunDecisions(modelRun.id, decisions);
```

Les stratégies dépendantes d'autres canaux, comme `CONSENSUS`, doivent être
exécutées dans une seconde phase explicite.

```text
Phase 1 : EV, SV, DOMINANT, BB, NUL, GOALS, UNDERDOG, etc.
Phase 2 : CONSENSUS, CONTRARIAN, AVOID ou autres méta-stratégies.
```

## 6. Catalogue des canaux

Chaque fiche précise désormais la **famille** du canal (spécialisé marché ou
transverse, voir section 3.1) et ses **marchés autorisés**. Vue d'ensemble :

| Canal           | Famille            | Marchés autorisés                          |
| --------------- | ------------------ | ------------------------------------------ |
| `EV`            | transverse         | tous les marchés évalués                   |
| `SV`            | transverse         | tous les marchés évalués                   |
| `DOMINANT`      | spécialisé         | `ONE_X_TWO`                                |
| `BB`            | spécialisé         | `BTTS` (`YES` ou `NO`)                      |
| `NUL`           | spécialisé         | `ONE_X_TWO` (`DRAW` uniquement)            |
| `GOALS`         | spécialisé         | `OVER_UNDER`                               |
| `FIRST_HALF`    | spécialisé         | marchés de mi-temps                        |
| `DOUBLE_CHANCE` | spécialisé         | `DOUBLE_CHANCE`                            |
| `UNDERDOG`      | transverse         | tous les marchés évalués                   |
| `FAVORITE`      | transverse         | tous les marchés évalués                   |
| `MARKET_MOVE`   | transverse         | tous les marchés évalués                   |
| `LIVE_VALUE`    | transverse         | tous les marchés évalués (live)            |
| `CONSENSUS`     | transverse (méta)  | tous les marchés évalués                   |
| `CONTRARIAN`    | transverse (méta)  | tous les marchés évalués                   |
| `AVOID`         | transverse (méta)  | aucun pick — décision négative seulement   |

### 6.1 Canaux actuels

#### EV — meilleure valeur attendue

Famille : transverse — libre de sélectionner n'importe quel marché évalué.

Objectif : sélectionner le marché dont la cote est supérieure à la valeur
estimée par le moteur, sous contraintes de probabilité, d'EV, de qualité et de
risque.

Exemple :

```text
Marché : BTTS
Pick : YES
Probabilité moteur : 48 %
Cote : 3.00
Probabilité implicite : 33,3 %
EV : +44 %
Décision EV : SELECTED
```

Une sélection EV n'est pas nécessairement le résultat le plus probable. Elle
représente d'abord un écart favorable entre probabilité et cote.

#### SV — forte probabilité, faible risque

Famille : transverse — libre de sélectionner n'importe quel marché évalué.

Objectif : sélectionner un marché à probabilité élevée, cote maîtrisée et EV
non négative. Le canal privilégie la stabilité, mais doit toujours être évalué
par son ROI et pas seulement par son taux de réussite.

Exemple :

```text
Marché : OVER_UNDER
Pick : UNDER_4_5
Probabilité : 84 %
Cote : 1.27
EV : +6,7 %
Décision SV : SELECTED
```

#### DOMINANT (ex-`CONF`) — issue directionnelle dominante

Famille : spécialisé — marché autorisé `ONE_X_TWO` uniquement.

Renommage : le canal `CONF` est renommé `DOMINANT` dans l'enum cible
`StrategyChannel`, car le nom décrit ce que fait le canal — retenir l'issue qui
domine nettement — plutôt qu'une attitude. Le rename se fait au moment de
l'introduction de `StrategyChannel`, via le mapping `CONF (legacy) → DOMINANT`
appliqué une fois par le script de migration (section 13) ; il ne reste aucun
`CONF` ni `PredictionChannel` après la bascule. Le libellé produit affiché à
l'utilisateur (aujourd'hui « VICTOIRE », via i18n) peut rester inchangé : nom
d'enum technique et label UI sont découplés (voir sections 12.6 et 15).

Objectif : sélectionner l'issue `HOME`, `DRAW` ou `AWAY` ayant la probabilité
la plus élevée, si elle dépasse le seuil de la compétition et mène assez
nettement la seconde issue.

Exemple :

```text
HOME : 67 %
DRAW : 20 %
AWAY : 13 %
Seuil DOMINANT ligue : 60 %
Marge sur la seconde issue : 47 points
Décision DOMINANT : HOME
```

#### BB — stratégie BTTS

Famille : spécialisé marché (`allowedMarkets = [BTTS]`), mais **pas pick-bound** :
le canal peut émettre `YES` **ou** `NO`. La contrainte porte sur le marché (BTTS),
jamais sur le pick.

Objectif : identifier les matchs où le profil de buts rend un côté du marché BTTS
exploitable. Le canal sélectionne le côté dont la probabilité dépasse le seuil
calibré, c'est-à-dire `YES` si `P(BTTS YES)` est suffisamment élevée, `NO` si
`P(BTTS NO) = 1 − P(BTTS YES)` l'est.

Évolution par rapport à l'existant : aujourd'hui le canal ne retient que
`BTTS YES`. Ouvrir le `NO` est trivial côté calcul mais exige une **calibration
séparée par côté** :

- les seuils par ligue actuels ont été backtestés sur la population `YES`
  uniquement ; ils ne sont pas valides pour le `NO` ;
- le moteur **plafonne les probabilités BTTS** (ex. ~0,47 sur certaines
  compétitions), donc `P(BTTS NO)` est souvent mécaniquement élevée : réutiliser
  le seuil `YES` inonderait les ligues peu prolifiques de picks `NO` mal calibrés ;
- prévoir donc un seuil, un `minSampleN` et un backtest distincts pour `NO`, et
  démarrer le côté `NO` en mode observation avant activation par segment validé.

Exemples :

```text
lambdaHome : 1.53
lambdaAway : 2.07
P(BTTS YES) : 68,5 %
Seuil BB YES ligue : 60 %
Décision BB : YES
```

```text
lambdaHome : 0.74
lambdaAway : 0.66
P(BTTS YES) : 31,0 %
P(BTTS NO) : 69,0 %
Seuil BB NO ligue : 62 %   (calibré séparément)
Décision BB : NO
```

#### NUL — spécialiste des matchs nuls

Famille : spécialisé — marché autorisé `ONE_X_TWO`, pick `DRAW` uniquement.

Objectif : isoler les matchs dont le profil de marché et la calibration de la
compétition rendent le nul intéressant. Aujourd'hui, le signal principal est
la probabilité implicite `1 / drawOdds`, et non la probabilité Poisson du nul.

Exemple :

```text
Cote du nul : 3.20
Probabilité implicite : 31,25 %
Seuil NUL ligue : 30 %
Décision NUL : DRAW
```

### 6.2 Canaux candidats

#### GOALS — Over/Under selon le total de buts attendu

Objectif : spécialiser la sélection des marchés de buts en utilisant le total
de lambdas, la distribution complète des scores, le profil de ligue et les
cotes Over/Under.

Exemples :

- `OVER_2_5` lorsque le total attendu est élevé et les deux attaques sont
  suffisamment contributrices ;
- `UNDER_3_5` dans une ligue peu volatile avec faible total attendu ;
- rejet explicite lorsque les lambdas et les cotes racontent des scénarios
  contradictoires.

#### FIRST_HALF — marchés de première mi-temps

Objectif : exploiter les probabilités et données propres à la première
mi-temps : vainqueur MT, Over/Under MT ou combinaison MT/fin de match.

Cette stratégie nécessite une calibration séparée. Une bonne prédiction du
score final ne garantit pas une bonne prédiction de première mi-temps.

#### DOUBLE_CHANCE — protection 1X/X2

Objectif : rechercher une exposition directionnelle avec protection contre le
nul ou contre une défaite du favori.

Exemple : `X2` lorsqu'une équipe extérieure est sous-évaluée, mais que la
victoire sèche reste trop volatile.

#### UNDERDOG — outsider sous-évalué avec cote élevée

Objectif : identifier les outsiders dont la probabilité moteur dépasse
significativement la probabilité implicite, avec des garde-fous renforcés sur
la calibration et les données.

Exemple :

```text
P(AWAY) moteur : 31 %
Cote AWAY : 4.50
P implicite : 22,2 %
Edge brut : +8,8 points
Décision UNDERDOG : SELECTED si le segment est historiquement validé
```

#### FAVORITE — favori fiable

Objectif : retenir un favori très probable, correctement calibré et compatible
avec une cote minimale. Ce canal peut alimenter des combinés, mais ne doit pas
confondre forte probabilité et rentabilité.

Exemple : `HOME` à 78 % et cote 1.35, retenu uniquement si le segment produit
une valeur et une calibration acceptables.

#### LIVE_VALUE — opportunités détectées en direct

Objectif : comparer l'état live du match aux probabilités pré-match et aux
cotes en direct.

Entrées supplémentaires nécessaires : minute, score courant, cartons, tirs,
xG live, changements de cote et état des compositions.

Ce canal doit être isolé des analyses J-/JT afin d'éviter tout mélange de
population dans les statistiques.

#### MARKET_MOVE — mouvements de cote

Objectif : exploiter ou filtrer les variations significatives entre plusieurs
snapshots de marché.

Exemples :

- suivre une baisse de cote confirmée par plusieurs bookmakers ;
- rejeter une sélection EV dont la cote s'est dégradée de façon adverse ;
- détecter une divergence entre marché sharp et marché grand public.

#### CONSENSUS — convergence de stratégies indépendantes

Objectif : produire une sélection uniquement lorsque plusieurs stratégies
indépendantes convergent vers un scénario compatible.

Exemples :

```text
EV         : HOME
DOMINANT : HOME
FAVORITE   : HOME
CONSENSUS  : HOME, niveau 3/3
```

```text
GOALS : OVER_2_5
BB    : YES
CONSENSUS : scénario de match ouvert
```

Le consensus ne doit pas compter deux stratégies reposant exactement sur la
même règle comme deux preuves indépendantes.

#### CONTRARIAN — désaccord significatif avec le marché

Objectif : identifier un désaccord mesurable et historiquement justifié entre
le moteur et le marché.

Ce canal ne signifie pas « jouer systématiquement contre le bookmaker ». Il
nécessite un segment calibré, une divergence minimale et des contrôles de
qualité renforcés.

Exemple : le marché valorise `HOME` à 65 %, alors que le modèle corrigé et
calibré l'estime à 48 % et identifie `X2` comme protection rentable.

#### AVOID — matchs instables ou données suspectes

Objectif : produire une décision négative explicite lorsqu'un match ne doit
pas alimenter les recommandations automatiques.

Signaux possibles :

- lambda au plancher ou incohérent avec les données récentes ;
- écart extrême entre modèle et marché ;
- données d'équipe insuffisantes ou dupliquées ;
- changement brutal de composition ;
- cotes incomplètes ou très dispersées ;
- compétition ou contexte non calibré ;
- contradiction forte entre plusieurs stratégies.

`AVOID` peut agir comme méta-stratégie et bloquer la publication sans effacer
les décisions analytiques des autres canaux.

## 7. Exemple complet d'un run multi-canal

Une analyse ne doit plus être résumée par un unique `BET/NO_BET`.

```json
{
  "fixture": "Home FC vs Away FC",
  "phase": "MATCH_DAY",
  "modelRunId": "run-123",
  "probabilities": {
    "home": 0.46,
    "draw": 0.29,
    "away": 0.25,
    "bttsYes": 0.64,
    "over25": 0.58
  },
  "decisions": [
    {
      "channel": "EV",
      "status": "REJECTED",
      "reasonCode": "EV_BELOW_THRESHOLD",
      "selections": []
    },
    {
      "channel": "SV",
      "status": "SELECTED",
      "selections": [
        {
          "market": "OVER_UNDER",
          "pick": "UNDER_4_5",
          "probability": 0.86,
          "odds": 1.3,
          "ev": 0.118
        }
      ]
    },
    {
      "channel": "DOMINANT",
      "status": "REJECTED",
      "reasonCode": "PROBABILITY_BELOW_LEAGUE_THRESHOLD",
      "selections": []
    },
    {
      "channel": "BB",
      "status": "SELECTED",
      "selections": [
        {
          "market": "BTTS",
          "pick": "YES",
          "probability": 0.64
        }
      ]
    },
    {
      "channel": "NUL",
      "status": "SELECTED",
      "selections": [
        {
          "market": "ONE_X_TWO",
          "pick": "DRAW",
          "probability": 0.303,
          "odds": 3.3
        }
      ]
    },
    {
      "channel": "CONSENSUS",
      "status": "REJECTED",
      "reasonCode": "NO_COMPATIBLE_CONVERGENCE",
      "selections": []
    }
  ]
}
```

Cette sortie exprime correctement que le canal EV n'a rien retenu, tandis que
SV, BB et NUL ont chacun trouvé un signal selon leur propre stratégie.

## 8. Gestion des runs J-, JT et live

Les changements entre plusieurs analyses sont normaux et doivent devenir une
dimension explicite du modèle.

### 8.1 Grain d'un `ModelRun`

Un `ModelRun` représente **une exécution du moteur sur une fixture à un instant
donné, immuable**. La phase (`J_MINUS` / `MATCH_DAY` / `LIVE`) est une *étiquette*
portée par le run, pas le grain : on peut réexécuter plusieurs fois dans une même
phase (par exemple si les cotes bougent à J-1). Conséquences directes :

- la relation `Fixture → ModelRun` est **1-à-N** : un match a autant de runs que
  d'exécutions d'analyse ;
- il n'existe **jamais** de décision canal au niveau fixture, seulement au niveau
  run. « La décision EV du match » n'a pas de sens ; seule « la décision EV du run
  JT du match » existe ;
- un run n'est jamais muté : une réanalyse crée un **nouveau** run, elle ne
  réécrit pas le précédent (intégrité du snapshot et de l'audit, anti-fuite
  temporelle de la section 14) ;
- c'est ce grain qui justifie `@@unique([modelRunId, channel])` (section 4.3) :
  au sein d'**une** exécution, un canal tranche une seule fois ; deux exécutions
  ont deux `modelRunId` distincts, donc un même canal peut parfaitement changer
  d'avis d'un run à l'autre.

Lire « l'état courant » d'un match revient donc à sélectionner le run le plus
récent par fixture et canal (`DISTINCT ON (fixtureId, channel) ORDER BY
analyzedAt DESC`), encapsulé une fois dans le repository.

Champs recommandés sur `ModelRun` ou dans son contexte :

```ts
type AnalysisPhase = "J_MINUS" | "MATCH_DAY" | "LIVE";

type AnalysisTiming = {
  phase: AnalysisPhase;
  analyzedAt: string;
  scheduledAt: string;
  minutesBeforeKickoff: number;
  oddsSnapshotAt?: string;
};
```

Principes :

- chaque run conserve ses décisions et ne réécrit pas l'historique du run
  précédent ;
- l'interface peut afficher la décision la plus récente ;
- les rapports analytiques peuvent comparer J- et JT ;
- une décision publiée ou jouée doit conserver une référence vers le run qui
  l'a produite ;
- les statistiques ne doivent pas mélanger J-, JT et live sans filtre
  explicite.

## 9. Settlement et matérialisation des paris

`ChannelSelection` décrit une sortie analytique. `Bet` décrit une mise réelle
ou une sélection matérialisée dans le produit.

Flux recommandé :

```text
ChannelSelection
      |
      +--> publication dans les picks du jour
      +--> ajout manuel à un coupon
      +--> création éventuelle d'un Bet
      +--> settlement analytique de la sélection
```

Une référence optionnelle peut relier `Bet` à `ChannelSelection`. Ainsi :

- les performances analytiques mesurent toutes les sélections publiées ;
- les performances financières mesurent uniquement les paris matérialisés ;
- les paris utilisateur ne sont jamais confondus avec les picks du moteur.

### 9.1 Autorité de settlement

Après la bascule (section 13), il n'existe **que deux** sources de vérité, sans
coexistence legacy :

- `ChannelSelection.result` est l'**autorité analytique** : il alimente hit
  rate, ROI analytique, Brier et calibration par canal ;
- `Bet.status` est l'**autorité financière** : il ne mesure que les mises
  réellement engagées (moteur ou utilisateur).

`Prediction` n'existe plus : il est migré dans `ChannelSelection` puis supprimé
par le script de migration (section 13). Il n'y a donc jamais de phase où trois
cycles de settlement coexistent.

Règle anti-double-comptage : une sélection liée à un `Bet` est réglée une seule
fois côté analytique via `ChannelSelection` ; le settlement de `Bet` ne
réagrège jamais les sélections, il ne règle que la mise.

## 10. Métriques par stratégie

Chaque canal doit avoir ses propres métriques et critères de validation.

Métriques communes :

- volume et couverture ;
- hit rate ;
- ROI et net units lorsque des cotes existent ;
- Brier score et erreur de calibration ;
- closing-line value ;
- drawdown ;
- performance par ligue, marché, tranche de cote et phase temporelle ;
- stabilité entre saisons ;
- taux de décisions `REJECTED`, `DISABLED` et `INSUFFICIENT_DATA`.

Métriques spécialisées :

- `CONSENSUS` : performance selon le nombre et l'indépendance des stratégies
  convergentes ;
- `CONTRARIAN` : performance selon l'amplitude du désaccord avec le marché ;
- `AVOID` : pertes évitées, faux blocages et couverture sacrifiée ;
- `MARKET_MOVE` : performance selon direction et amplitude du mouvement ;
- `LIVE_VALUE` : performance par minute, score courant et état du match.

## 11. Ajout d'un nouveau canal

Un nouveau canal ne doit pas être ajouté uniquement parce qu'un marché existe.
Il doit répondre à une hypothèse stratégique distincte.

Checklist minimale :

1. Définir l'objectif et la question à laquelle le canal répond.
2. Identifier ses entrées et ses dépendances.
3. Choisir sa famille (spécialisé marché ou transverse) et définir ses
   `allowedMarkets` en conséquence (section 3.1).
4. Définir ses critères `SELECTED` et ses codes de rejet.
5. Définir ses seuils par compétition ou son comportement par défaut.
6. Implémenter la stratégie derrière le contrat commun.
7. Ajouter des tests unitaires de sélection et de rejet.
8. Exécuter un backtest séparé par ligue, marché et saison.
9. Démarrer en shadow ou observation mode.
10. Activer uniquement les segments validés.
11. Ajouter le settlement et les métriques.
12. Exposer le canal dans les rapports, l'API et le frontend.

## 12. Impact de développement

### 12.1 Base de données

Cible : un seul modèle de canal, **aucune structure legacy conservée**. La
bascule se fait par un script de migration unique (section 13), pas par
coexistence durable.

- ajouter `StrategyChannel`, `ChannelDecisionStatus`, `ChannelDecision` et
  `ChannelSelection` ;
- relier les décisions à `ModelRun` ;
- ajouter une référence `channelSelectionId` (nullable) depuis `Bet` ;
- backfiller intégralement l'historique matérialisé vers les nouvelles tables
  (voir section 13, étape 2) ;
- puis **supprimer** les structures legacy dans la même release :
  - table `Prediction` et enum `PredictionChannel` ;
  - enum `CouponLegCanal` (remplacé par `StrategyChannel`, `CONF → DOMINANT`) ;
  - colonne `Bet.isSafeValue` (l'info SV est désormais portée par le canal de
    la `ChannelSelection` liée) ;
  - colonne `ModelRun.decision` (remplacée par la `ChannelDecision` du canal EV).

### 12.2 Betting engine

- extraire un `StrategyContext` commun ;
- déplacer les règles de chaque canal dans une stratégie dédiée ;
- persister une décision pour chaque canal exécuté, directement dans
  `ChannelDecision`/`ChannelSelection` (plus d'écriture vers `Prediction` ni de
  flag `isSafeValue`) ;
- séparer les stratégies primaires des méta-stratégies ;
- conserver les calculs probabilistes actuels à l'identique.

### 12.3 Settlement

- régler les `ChannelSelection` selon leur marché ;
- conserver le settlement de `Bet` pour les mises ;
- éviter de compter deux fois une même sélection liée à un pari ;
- traiter séparément les décisions live et pré-match.

### 12.4 Rapports et data analysis

- remplacer la reconstruction implicite des canaux par une lecture directe ;
- exporter un objet par `modelRun × channel × selection` ;
- inclure les décisions sans sélection pour analyser les raisons de rejet ;
- faciliter la comparaison J-/JT et l'étude des contradictions ;
- produire des datasets homogènes pour le ML et les IA externes.

### 12.5 API

- normaliser les DTO autour de `channel`, `status` et `selections` ;
- exposer une décision par canal, y compris `REJECTED` / `NO_SELECTION` avec son
  `reasonCode`, sans la confondre avec une absence de run ;
- permettre le filtrage par stratégie, marché et phase temporelle ;
- basculer les réponses EV/SV et `Prediction` vers la nouvelle représentation
  dans la même release — pas de couche de compatibilité maintenue dans le temps.

### 12.6 Frontend

Le frontend reproduit aujourd'hui le même éclatement de vocabulaire que le
backend, et doit être unifié dans la même release — sans legacy ni double
lecture. Cette section est autant un travail d'architecture que de
compréhension.

**Un seul vocabulaire de canal.** Le web porte aujourd'hui trois types
concurrents : `canal-badge` (`EV|SV|CONF|DRAW|BTTS`), `investment`/`coupon`
(`EV|SV|BB|NUL|CONF`) et les canaux virtuels / `COUPON` des vues investment.
Les remplacer par un **type unique aligné sur `StrategyChannel`**, défini une
fois et ré-exporté, jamais redéclaré par domaine. Mapping appliqué à la bascule :
`CONF → DOMINANT`, `DRAW → NUL`, `BTTS → BB`.

**Découpler le nom d'enum du libellé affiché.** La valeur technique
(`DOMINANT`) ne doit jamais apparaître en dur dans le JSX. Aujourd'hui
`canal-badge` mélange trois conventions : `t("matchNull")` pour `DRAW`,
`t("btts")` pour `BTTS`, la chaîne en dur `"VICT"` pour `CONF`, et la valeur
brute pour `EV`/`SV`. Cible : un seul mapping canal → clé i18n. Le libellé
utilisateur (par ex. « VICTOIRE » via `picks.confidence`) peut rester inchangé ;
seules la clé et le token couleur sont remappés (`--canal-conf → --canal-dominant`,
`--canal-draw → --canal-nul`, `--canal-btts → --canal-bb`).

**Représenter un run comme multi-canal, pas comme `BET`/`NO_BET`.** L'UI ne doit
plus résumer un match par une décision binaire. La vue fixture affiche la liste
des `ChannelDecision` avec leur `status` ; une décision `REJECTED` /
`NO_SELECTION` est rendue explicitement, avec son `reasonCode` traduit, et n'est
jamais confondue avec « pas de run ». Les vues `canal-cards` et `picks` listent
par canal.

**Lecture directe, pas de reconstruction côté client.** Plus de dérivation du
canal à partir de `isSafeValue` ou de `Prediction` dans le navigateur : la donnée
arrive déjà normalisée (`channel`, `status`, `selections`). Filtres par
stratégie, marché et phase (J-/JT/live) lus directement.

**Suppression, pas désactivation.** Types, hooks et composants basculent dans la
même release que l'API ; les anciens DTO EV/SV/Prediction et le code de
reconstruction de canal sont **supprimés**, pas laissés en parallèle.

**Extensibilité.** Ajouter un canal (`GOALS`, `CONSENSUS`, `AVOID`…) se réduit à
étendre l'enum partagé, ajouter une clé i18n et un token couleur ; les
composants liste / badge / filtre le prennent sans markup dédié. `AVOID`
s'affiche comme décision négative (badge d'avertissement), jamais comme pick.

### 12.7 Tests

- tests unitaires par stratégie (sélection ET rejet, invariant `allowedMarkets`) ;
- tests d'orchestration d'un run multi-canal ;
- tests de persistance de toutes les décisions ;
- tests d'idempotence et de réconciliation du script de backfill ;
- tests de settlement par marché ;
- test de parité ancien/nouveau rapport exécuté en pré-bascule (gate de la
  migration), pas comme régression permanente.

## 13. Migration — bascule unique et propre

Pas de double écriture, pas de coexistence de schémas, pas de couche de
compatibilité durable. La transition est une **bascule unique**, livrée dans une
seule release coordonnée, exécutée par un script de migration **idempotent et
transactionnel**, vérifiée avant tout `DROP`, et avec un chemin de rollback
testé. « Propre » ne veut pas dire « risqué » : le legacy n'est supprimé
qu'**après** validation de la parité.

### Étape 0 — préparation

- développer le betting engine sur le nouveau contrat (`StrategyContext`,
  registre de stratégies, `ChannelDecision`/`ChannelSelection`) derrière les
  tables cibles, sans encore router les consommateurs ;
- planifier une courte fenêtre de faible trafic (les crons d'analyse et de
  settlement sont suspendus le temps de la bascule).

### Étape 1 — schéma (migration Prisma)

- créer les enums `StrategyChannel`, `ChannelDecisionStatus` ;
- créer les tables `channel_decision` et `channel_selection` ;
- ajouter `Bet.channelSelectionId` (FK nullable).

### Étape 2 — backfill (script idempotent, en transaction)

Reconstruire l'historique matérialisé vers les nouvelles tables, par `ModelRun` :

- canal `EV` : `Bet` (`source=MODEL`, `isSafeValue=false`) → `ChannelDecision(EV,
  SELECTED)` + `ChannelSelection` (marché, pick, proba, cote, EV, qualityScore,
  `result = Bet.status`) ; sinon `decision = NO_BET` → `ChannelDecision(EV,
  REJECTED, reasonCode=BACKFILL)` ;
- canal `SV` : `Bet` (`isSafeValue=true`) → `ChannelDecision(SV, SELECTED)` +
  sélection ;
- canaux `DOMINANT`, `NUL`, `BB` : depuis `Prediction`
  (`CONF→DOMINANT`, `DRAW→NUL`, `BTTS→BB`) → `ChannelDecision(SELECTED)` +
  `ChannelSelection` (marché, pick, `probability`, `result` dérivé de
  `correct`) ;
- relier chaque `Bet` matérialisé à sa `ChannelSelection` via
  `channelSelectionId` ;
- migrer les jambes de coupon : `CouponLegCanal → StrategyChannel`
  (`CONF → DOMINANT`).

Les décisions de rejet historiques non matérialisées ne sont pas inventées :
seules les sélections réellement enregistrées sont backfillées. Le script est
re-exécutable sans créer de doublon (clés `@@unique([modelRunId, channel])` et
`@@unique([channelDecisionId, rank])`).

### Étape 3 — vérification (gate avant tout DROP)

- réconciliation de comptage : nb de `ChannelSelection SELECTED` ==
  nb de `Bet MODEL` + nb de `Prediction` migrées ;
- parité par fixture et somme des résultats settlés ;
- exécution du test de parité ancien/nouveau rapport sur la même période.

Si une vérification échoue, la transaction n'est pas committée : aucun legacy
n'a été supprimé, l'état précédent est intact.

### Étape 4 — bascule des consommateurs (même release)

- l'engine écrit désormais uniquement `ChannelDecision`/`ChannelSelection` ;
- rapport d'audit, statistiques, exports ML, endpoints et frontend lisent la
  nouvelle représentation ;
- le settlement analytique s'appuie sur `ChannelSelection`.

### Étape 5 — suppression du legacy (migration finale, après gate vert)

- `DROP TABLE prediction` ; `DROP TYPE PredictionChannel`, `CouponLegCanal` ;
- `ALTER TABLE bet DROP COLUMN isSafeValue` ;
- retirer `ModelRun.decision` (remplacée par la `ChannelDecision` EV).

Aucune de ces structures ne survit à la release : il ne reste qu'un seul
vocabulaire de canal (`StrategyChannel`) et deux autorités de settlement
(`ChannelSelection`, `Bet`).

### Étape 6 — nouveaux canaux

Ordre conseillé :

1. `GOALS`, car les probabilités nécessaires existent déjà ;
2. `CONSENSUS`, pour exploiter les décisions normalisées ;
3. `AVOID`, pour contrôler les anomalies et contradictions ;
4. `UNDERDOG` ou `FAVORITE`, après calibration des segments 1X2 ;
5. `MARKET_MOVE`, lorsque l'historique de cotes est assez dense ;
6. `FIRST_HALF`, avec un dataset mi-temps validé ;
7. `LIVE_VALUE`, dans un pipeline live séparé.

## 14. Risques et garde-fous

### Explosion du nombre de canaux

Risque : créer un canal par marché ou par intuition produit.

Garde-fou : exiger une hypothèse, un backtest, des seuils et des métriques
propres avant activation.

### Double comptage des mêmes signaux

Risque : considérer EV, FAVORITE et DOMINANT comme trois confirmations alors qu'ils
reposent sur les mêmes probabilités.

Garde-fou : documenter les dépendances et mesurer l'indépendance des stratégies
dans `CONSENSUS`.

### Sélection hors du périmètre d'un canal

Risque : un canal spécialisé (par exemple `BB`) émet un pick d'un autre marché,
ou un canal transverse sélectionne un marché qu'il ne devrait pas évaluer.

Garde-fou : chaque canal déclare ses `allowedMarkets` (section 3.1 et 5) ;
l'invariant `selection.market ∈ channel.allowedMarkets` est vérifié à la
persistance et couvert par un test unitaire de sélection ET de rejet pour chaque
stratégie. Une violation fait échouer le run au lieu d'écrire une donnée fausse.

### Fuite de données temporelle

Risque : analyser une décision pré-match avec des données connues après le
coup d'envoi.

Garde-fou : conserver les snapshots, timestamps et phases d'analyse, et joindre
chaque sélection à son run exact.

### Complexité de migration

Risque : casser les rapports, coupons ou statistiques existants lors de la
bascule unique.

Garde-fou : script de migration idempotent et transactionnel, gate de parité
ancien/nouveau rapport **avant** tout `DROP`, et rollback testé (transaction non
committée + migration `down` Prisma). Le legacy n'est supprimé qu'après le gate
vert (section 13).

### Confusion entre précision et rentabilité

Risque : promouvoir un canal à fort hit rate mais à cotes trop faibles.

Garde-fou : définir les critères de succès selon l'objectif réel de chaque
stratégie et toujours afficher hit rate, ROI, calibration et volume ensemble.

## 15. Décisions recommandées

1. Conserver le socle probabiliste commun du betting engine.
2. Définir officiellement un canal comme une stratégie de sélection.
3. Migrer `ModelRun.decision` vers la `ChannelDecision` du canal EV, puis
   retirer la colonne — aucune décision EV legacy ne subsiste.
4. Basculer vers `ChannelDecision`/`ChannelSelection` par une migration unique,
   scriptée et vérifiée, sans double écriture ni coexistence legacy (section 13).
5. Conserver l'historique par run pour comparer J-, JT et live.
6. Séparer les décisions analytiques des paris réellement matérialisés.
7. Exiger une calibration indépendante avant l'activation d'un nouveau canal.
8. Utiliser la nouvelle représentation comme base des rapports Data Analyst,
   du ML et des analyses par IA externe.
9. Renommer `CONF` en `DOMINANT` dans le même script de migration que
   l'introduction de `StrategyChannel` (mapping appliqué une fois). Ne pas faire
   ce rename en isolé : à chaud il coûte une migration Postgres et ~300
   références pour zéro gain fonctionnel.
10. Ouvrir le côté `NO` du canal `BB` (aujourd'hui limité à `YES`) avec une
    calibration séparée par côté — seuil, `minSampleN` et backtest distincts —
    et un démarrage en mode observation, le marché restant contraint à `BTTS`.

Cette architecture transforme le moteur actuel en plateforme de stratégies :
les calculs communs restent centralisés, tandis que chaque canal devient
explicable, testable, mesurable et extensible indépendamment.
