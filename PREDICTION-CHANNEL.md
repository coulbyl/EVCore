# Canal Confiance — Spécification d'implémentation

## Prérequis : Fix Safe Value ✅ FAIT

### Diagnostic initial

Le canal Safe Value produisait **+12% ROI** sur 48 bets settlés (vs +1.8% pour le canal EV) mais était **complètement invisible dans l'UI**. Cause : la query fixtures récupérait les bets avec `orderBy: ev desc, take: 1` — les bets SV (EV ~0.07) perdaient systématiquement face aux bets EV (~0.31) et n'apparaissaient pas dans la réponse.

### Correction apportée (branche `feat/safe-value-visibility`)

**Backend — `fixture-scoring.service.ts`**

- Champ `isSafeValue` ajouté à la sélection des bets
- `take: 1` → `take: 5` pour récupérer tous les bets d'un model run
- Split dans le mapping : `evBet = bets.find(b => !b.isSafeValue)`, `svBet = bets.find(b => b.isSafeValue)`
- Nouveau type `ScoredFixtureSvBet` + champ `safeValueBet` dans `ScoredFixtureRow`

**Web types — `fixture.ts`**

- Nouveau type `FixtureSvBet`
- Champ `safeValueBet: FixtureSvBet | null` ajouté à `FixtureRow`

**UI — `fixtures-table.tsx`**

- Badge `Safe` (sky-blue) + composant `SVRow`
- **Mobile** : row "Safe" visible sous le résultat EV, même si les deux coexistent sur le même fixture
- **Desktop** : pick SV sous le pick EV dans la colonne Pick, EV SV en sky-blue dans la colonne EV, résultat SV dans la colonne Résultat

Un match peut désormais afficher **EV + Safe simultanément** sans que l'un cache l'autre.

### Leçon pour le canal Confiance

**Un canal qui n'est pas visible dès le premier jour n'existe pas pour l'utilisateur.**

Le canal Confiance doit avoir son composant UI créé en même temps que le backend — pas après. L'ordre d'implémentation du canal Confiance (section plus bas) intègre cette contrainte : l'étape UI est bloquante avant la mise en prod.

---

## Contexte

Le canal EV actuel optimise l'edge contre le bookmaker : peu de picks par jour, axés sur la valeur espérée. L'objectif du canal confiance est orthogonal : **avoir plus de bonnes prédictions que de mauvaises sur une journée**, indépendamment des cotes.

Les deux canaux coexistent et sont indépendants. Ils partagent la même computation Poisson mais appliquent des critères de décision différents.

---

## Principe de décision

```
Canal EV (actuel)           Canal Confiance (nouveau)
────────────────────        ────────────────────────────
EV ≥ threshold              P_max ≥ PREDICTION_THRESHOLD[competition]
odds dans [floor, cap]      aucun filtre cote
score ≥ MODEL_SCORE_THRESHOLD   aucun filtre score
→ Bet (avec cote, stake)    → Prediction (pick + probabilité)
```

`P_max = max(P_home, P_draw, P_away)` — la probabilité Poisson du pick argmax.

La prédiction est l'outcome que le modèle considère le plus probable, à condition que sa confiance dépasse le seuil calibré pour la ligue.

---

## Seuils validés par backtest

Données recalibrées via le backtest complet relancé le 19 avril 2026.

### Ligues activées

| Ligue | Seuil | Hit rate | N (backtest) | Notes                                                |
| ----- | ----- | -------- | ------------ | ---------------------------------------------------- |
| BL1   | 0.50  | 57.1%    | 362          | Baisse du seuil validée pour remonter la couverture  |
| PL    | 0.55  | 67.6%    | 238          | Stable, seuil conservé                               |
| SP2   | 0.55  | 60.4%    | 139          | 0.50 ne passe pas, 0.55 restaure un canal valide    |
| POR   | 0.50  | 60.4%    | 111          | Stable, seuil conservé                               |
| LL    | 0.50  | 62.7%    | 346          | Baisse du seuil validée avec forte couverture        |
| ERD   | 0.50  | 56.9%    | 160          | Passe au seuil actuel                                |
| WCQE  | 0.50  | 61.5%    | 109          | Stable, bon volume                                   |
| EL1   | 0.55  | 56.0%    | 339          | 0.65 trop strict, 0.55 repasse au-dessus du plancher |
| CH    | 0.60  | 59.7%    | 186          | Réactivation validée au premier cycle complet        |

### Ligues désactivées

| Ligue | Raison                                                                      |
| ----- | --------------------------------------------------------------------------- |
| D2    | Aucun seuil testé ne valide hit rate + couverture au cycle du 19/04/2026   |
| F2    | Aucun seuil testé ne passe le plancher de hit rate                          |
| I2    | Aucun seuil testé ne passe le plancher de hit rate                          |
| EL2   | Aucun seuil testé ne valide simultanément volume, couverture et hit rate    |
| MX1   | Modèle non calibré, backtest toujours insuffisant                           |
| UNL   | 0% à tous les seuils                                                        |
| FRI   | Jamais > 50%, trop de variables non modélisées (matchs amicaux)             |
| SA    | Plafonne à 50–60% avec N insuffisant, pattern instable                      |
| UEL   | Données trop sparse                                                         |
| UECL  | Données insuffisantes                                                       |
| UCL   | Données insuffisantes                                                       |
| J1    | Volume trop faible                                                          |
| L1    | Hit rate variable, pas stable sur plusieurs seuils                          |

---

## Modèle de données

Nouvelle table Prisma `prediction`, séparée de `bet`. Une prédiction n'est pas un pari — elle n'a pas de cote, de stake ou d'EV.

```prisma
model Prediction {
  id            String    @id @default(dbgenerated("uuidv7()"))
  fixtureId     String
  modelRunId    String
  competition   String    // code ligue (BL1, PL, etc.)
  market        Market    @default(ONE_X_TWO)
  pick          String    // HOME | DRAW | AWAY
  probability   Decimal   @db.Decimal(5, 4)  // P_max du modèle
  correct       Boolean?  // null = pending, true/false après settle
  settledAt     DateTime?
  createdAt     DateTime  @default(now())

  fixture   Fixture  @relation(fields: [fixtureId], references: [id])
  modelRun  ModelRun @relation(fields: [modelRunId], references: [id])

  @@index([fixtureId])
  @@index([competition, createdAt])
}
```

Le settle est déclenché automatiquement au même moment que `settleOpenBets()` dans `BettingEngineService`.

---

## Configuration par ligue

Nouveau fichier `apps/backend/src/modules/prediction/prediction.constants.ts` :

```ts
export type PredictionLeagueConfig = {
  enabled: boolean;
  threshold: number; // P_max minimum pour publier une prédiction
  minSampleN: number; // fixtures minimum en DB avant d'activer
};

export const PREDICTION_CONFIG: Record<string, PredictionLeagueConfig> = {
  BL1: { enabled: true, threshold: 0.5, minSampleN: 10 },
  D2: { enabled: false, threshold: 0.55, minSampleN: 10 },
  PL: { enabled: true, threshold: 0.55, minSampleN: 10 },
  SP2: { enabled: true, threshold: 0.55, minSampleN: 10 },
  POR: { enabled: true, threshold: 0.5, minSampleN: 10 },
  LL: { enabled: true, threshold: 0.5, minSampleN: 20 },
  F2: { enabled: false, threshold: 0.5, minSampleN: 10 },
  I2: { enabled: false, threshold: 0.55, minSampleN: 10 },
  ERD: { enabled: true, threshold: 0.5, minSampleN: 10 },
  WCQE: { enabled: true, threshold: 0.5, minSampleN: 10 },
  EL1: { enabled: true, threshold: 0.55, minSampleN: 20 },
  EL2: { enabled: false, threshold: 0.55, minSampleN: 15 },
  CH: { enabled: true, threshold: 0.6, minSampleN: 20 },
  MX1: { enabled: false, threshold: 0.99, minSampleN: 50 },
  FRI: { enabled: false, threshold: 0.99, minSampleN: 50 },
  SA: { enabled: false, threshold: 0.99, minSampleN: 50 },
  UNL: { enabled: false, threshold: 0.99, minSampleN: 50 },
  UEL: { enabled: false, threshold: 0.99, minSampleN: 50 },
  UECL: { enabled: false, threshold: 0.99, minSampleN: 50 },
  UCL: { enabled: false, threshold: 0.99, minSampleN: 50 },
};

const PREDICTION_CONFIG_DEFAULT: PredictionLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 50,
};

export function getPredictionConfig(
  competitionCode: string | null | undefined,
): PredictionLeagueConfig {
  if (competitionCode != null && competitionCode in PREDICTION_CONFIG) {
    return PREDICTION_CONFIG[competitionCode];
  }
  return PREDICTION_CONFIG_DEFAULT;
}
```

---

## Intégration dans `analyzeFixture()`

Le canal confiance s'exécute **après** le canal EV, sur les mêmes probabilities déjà calculées. Aucun recalcul.

```
analyzeFixture(fixtureId)
  ↓
computePoissonMarkets()          ← une fois
  ↓
[Canal EV]                       ← inchangé
  if EV ≥ threshold + filtres → createBet()
  ↓
[Canal Confiance]                ← nouveau
  config = getPredictionConfig(competitionCode)
  if config.enabled AND P_max ≥ config.threshold
    → createPrediction()
```

`createPrediction()` est dans `PredictionService`, module séparé de `BettingEngineService`.

### Cas possibles pour un fixture

| Canal EV | Canal Confiance | Signification                               |
| -------- | --------------- | ------------------------------------------- |
| BET      | prédiction      | Signal fort — concordance des deux canaux   |
| NO_BET   | prédiction      | Cas le plus fréquent (~80% des prédictions) |
| BET      | aucune          | EV sur pick non-favori (longshot AWAY/DRAW) |
| NO_BET   | aucune          | Match équilibré ou ligue désactivée         |

---

## Settle des prédictions

Déclenché dans `BettingEngineService.settleOpenBets()`, en parallèle du settle des bets EV.

```ts
// Dans settleOpenBets(), après la boucle sur les bets :
await this.predictionService.settlePredictions(fixtureId, {
  homeScore: fixture.homeScore,
  awayScore: fixture.awayScore,
});
```

`settlePredictions()` :

1. Trouve toutes les `Prediction` du fixture avec `correct = null`
2. Calcule l'outcome réel (HOME / DRAW / AWAY)
3. Met à jour `correct` et `settledAt`

---

## Extension du backtest

Le backtest existant (`BacktestService`) doit tracker les métriques du canal confiance en parallèle des métriques EV.

### Nouvelle section dans le rapport backtest

```ts
type PredictionBacktestResult = {
  competition: string;
  threshold: number;
  total: number; // fixtures évaluées
  predicted: number; // prédictions émises (P_max >= threshold)
  correct: number; // prédictions correctes
  hitRate: number; // correct / predicted
  coverageRate: number; // predicted / total
};
```

### Critère de validation par ligue

Une ligue passe la validation backtest prédiction si :

- `hitRate ≥ 0.55` sur au moins `minSampleN` prédictions
- `coverageRate ≥ 0.10` (le modèle prédit au moins 10% des matchs de la ligue)

Si une ligue échoue sur le prochain backtest, son `enabled` passe à `false` automatiquement dans les constantes (mise à jour manuelle après audit).

---

## Boucle de calibration

Le seuil par ligue est recalibré à chaque backtest complet (cycle actuel : mensuel). Workflow :

1. `pnpm --filter backend backtest` → génère rapport avec `PredictionBacktestResult[]`
2. Comparer les `hitRate` par ligue avec les seuils actuels
3. Si hitRate chute sous 0.55 sur 20+ prédictions → augmenter le threshold de 0.05
4. Si hitRate > 0.70 sur 20+ prédictions → possibilité de baisser le threshold de 0.05 pour augmenter la couverture
5. Mettre à jour `PREDICTION_CONFIG` et committer

---

## Structure des modules backend

```
apps/backend/src/modules/prediction/
  prediction.module.ts
  prediction.service.ts       # createPrediction(), settlePredictions(), list
  prediction.repository.ts    # queries Prisma
  prediction.controller.ts    # GET /predictions (filtre par date/ligue)
  prediction.constants.ts     # PREDICTION_CONFIG + getPredictionConfig()
  dto/
    prediction-query.dto.ts
  entities/
    prediction.entity.ts
```

`PredictionModule` est importé dans `BettingEngineModule` pour l'injection dans `analyzeFixture()`.

---

## API endpoints

```
GET /predictions
  ?date=2026-04-19          # filtre par date de match (optionnel, défaut = aujourd'hui)
  ?competition=BL1          # filtre par ligue (optionnel)
  ?status=pending|settled   # filtre par état (optionnel)

Réponse :
[
  {
    id, fixtureId, competition,
    homeTeam, awayTeam, kickoff,
    pick, probability,           // "HOME" | "DRAW" | "AWAY", 0.63
    correct,                     // null | true | false
    evBet: { pick, odds, ev } | null  // le bet EV associé s'il existe
  }
]

GET /predictions/stats
  ?from=2026-04-01&to=2026-04-19
  ?competition=BL1

Réponse :
{
  total, correct, hitRate,
  byCompetition: [{ competition, total, correct, hitRate }]
}
```

---

## Changements UI

### 1. Dashboard — bloc "Prédictions du jour"

Nouveau composant `PredictionsCard` inséré dans `DashboardPageClient`, au-dessus des KPI cards.

```
┌─────────────────────────────────────────────────────┐
│  Prédictions du jour          6 matchs · 4/6 hier ✓ │
├─────────────────────────────────────────────────────┤
│  Bayern vs Stuttgart    ● DOMICILE   63%  PENDING   │
│  Man City vs Arsenal    ● DOMICILE   61%  PENDING   │
│  PSG vs Lyon            ● DOMICILE   67%  ✓         │
│  Real vs Barça          ● EXTÉRIEUR  60%  ✗         │
└─────────────────────────────────────────────────────┘
```

- La ligne `4/6 hier ✓` = hitRate de la veille — recalculé à minuit
- Couleur badge prédiction : indigo par défaut, puis vert/rouge après settle
- Dot de statut : vert = correct, rouge = incorrect, gris = pending
- Score du jour affiché au format `X/Y ✓`
- Mobile-first : liste de cards, pas de tableau

### 2. Fixture card — badge prédiction

Sur le tableau fixtures, badge secondaire de prédiction :

```
[NO BET]  [→ DOM 63%]    ← prédiction seule
[BET]     [→ DOM 61%]    ← concordance (signal fort)
[BET]     —              ← EV sur pick non-favori
```

Format : `→ DOM` / `→ EXT` / `→ NUL` + probabilité en %.

- Mobile : affiché en row 3, à côté du badge décision
- Desktop : affiché dans la colonne Décision, sous le badge `BET` / `NO BET`

### 3. Page prédictions (optionnel — phase 2 UI)

Page `/dashboard/predictions` avec historique, filtre par ligue, courbe de hit rate dans le temps. À implémenter après validation en prod sur 2–3 semaines.

---

## Ordre d'implémentation

### Phase 0 — Fix Safe Value ✅ FAIT

- `fixture-scoring.service.ts` — split EV / SV dans la query fixtures
- `FixtureRow` web — champ `safeValueBet` ajouté
- `fixtures-table.tsx` — badge `Safe` visible sur mobile et desktop
- Un fixture peut afficher EV + Safe simultanément

### Phase 1 — Backend Confiance ✅ LIVRÉE

1. **Migration Prisma** — table `Prediction` + relations `Fixture` + `ModelRun`
2. **`prediction.constants.ts`** — `PREDICTION_CONFIG` + `getPredictionConfig()`
3. **`PredictionRepository`** — queries Prisma
4. **`PredictionService`** — `createPrediction()`, `settlePredictions()`, `list()`, `stats()`
5. **Intégration dans `analyzeFixture()`** — prédictions incluses directement dans le `select fixture` de `fixture-scoring.service.ts`
6. **Intégration dashboard** — `findByDate()` enrichi avec noms d'équipes et kickoff
7. **`PredictionController`** — `GET /predictions`, `GET /predictions/stats`

### Phase 2 — UI Confiance ✅ LIVRÉE

8. **`PredictionsCard`** — composant dashboard "Prédictions du jour" avec dot de statut, score du jour `X/Y ✓` et hit rate veille
9. **`PredictionBadge`** — badge indigo `→ DOM 63%` sur les fixtures, qui vire vert/rouge après settle

La contrainte UI bloquante est levée : le canal Confiance dispose maintenant d'une visibilité dashboard + fixtures avant extension du scope produit. Leçon Safe Value appliquée.

### Phase 3 — Backtest et calibration ✅ LIVRÉE

10. **Extension backtest** — `predictionBacktest` ajouté au rapport par saison et en agrégé, avec scan multi-seuils et verdict par ligue
11. **Premier cycle de recalibration** — `PREDICTION_CONFIG` ajusté sur la base du backtest complet du 19 avril 2026

Décisions du premier cycle :

- seuil abaissé : `BL1` (`0.60 -> 0.50`), `LL` (`0.60 -> 0.50`), `EL1` (`0.65 -> 0.55`)
- seuil relevé : `SP2` (`0.50 -> 0.55`), `CH` réactivée à `0.60`
- ligues désactivées : `D2`, `F2`, `I2`, `EL2`
- ligues conservées : `PL`, `POR`, `ERD`, `WCQE`

---

## Contraintes héritées du CLAUDE.md

- Jamais `process.env` directement → `ConfigService`
- Jamais Prisma directement dans les services → `PredictionRepository`
- Zod pour tout input externe, `class-validator` pour les DTOs HTTP
- Tests unitaires `PredictionService` colocalisés (`prediction.service.spec.ts`)
- `Decimal.js` si des calculs sur `probability` sont nécessaires
