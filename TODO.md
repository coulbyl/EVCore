# EVCore — TODO Mois 1 : ETL Workers

> Plan de travail détaillé pour le milestone `mvp-month-1` (due 14 mars 2026).
> Référence spec : [EVCORE.md](EVCORE.md) §3.2, §4.1, §14.2 | Avancement : [ROADMAP.md](ROADMAP.md)

---

## Vue d'ensemble

Mois 1 construit **la fondation de données** sans laquelle rien d'autre n'est possible.
L'objectif est d'avoir 3 saisons EPL en base, des stats rolling calculées, un modèle de Poisson
qui génère des probabilités, et un backtest qui mesure la qualité du modèle.

### Avancement (mis à jour le 27 février 2026)

- Semaine 1 ETL: workers `fixtures_sync`, `results_sync`, `xg_sync` et `stats_sync` implémentés.
- Validation Zod: schémas et tests unitaires en place.
- Orchestration: BullMQ configuré + dispatch par saison avec delays progressifs testés.
- Service fixture: mapping métier des statuts API vers DB testé (`AWARDED -> FINISHED`, etc.).
- Semaine 2 rolling-stats: calculs + upsert `TeamStats` + endpoints de backfill implémentés.
- Semaine 3 betting-engine: Poisson + marchés dérivés + score déterministe + persistance `ModelRun` implémentés.
- Semaine 4 backtest: module `backtest` livré (pipeline saison, Brier Score, Calibration Error, ROI simulé, rapport JSON + logs Pino).
- Standardisation backend: guide d'écriture (`apps/backend/CODE_GUIDE.md`) + aliases TS (`@`, `@utils`, `@modules`, `@config`).
- Source de vérité dates: utilitaires centralisés (`date.utils.ts`) avec `date-fns`.
- Reste principal: automatisation/alerting (Novu) et suite Mois 2.

```
football-data.org ──► fixtures_sync ──► Fixture (DB)
                  ──► results_sync  ──► Fixture.homeScore / awayScore / status

Understat ─────────► xg_sync ────────► Fixture.homeXg / awayXg

FBref ─────────────► stats_sync ──────► TeamStats (forme, dom/ext, volatilité)

TeamStats ─────────► rolling-stats ───► TeamStats (calculs dérivés)

TeamStats ─────────► poisson-model ──► ModelRun.features + probabilités

ModelRun ──────────► backtest ────────► Brier Score + Calibration Error
```

---

## Structure NestJS à créer

```
apps/backend/src/modules/
  etl/
    etl.module.ts
    workers/
      fixtures-sync.worker.ts      # football-data.org → Fixture
      results-sync.worker.ts       # football-data.org → scores + status
      xg-sync.worker.ts            # Understat → homeXg / awayXg
      stats-sync.worker.ts         # FBref → TeamStats brutes
    schemas/                       # Zod : validation avant toute écriture DB
      fixture.schema.ts
      result.schema.ts
      xg.schema.ts
      stats.schema.ts
    etl.service.ts                 # orchestration manuelle (déclenche les jobs)
  fixture/
    fixture.module.ts
    fixture.repository.ts          # toutes les queries Prisma Fixture
    fixture.service.ts
  rolling-stats/
    rolling-stats.module.ts
    rolling-stats.service.ts       # calcule forme, xG rolling, dom/ext, volatilité
  betting-engine/
    betting-engine.module.ts
    betting-engine.service.ts      # Poisson → probabilités → score déterministe
    ev.constants.ts                # EV_THRESHOLD, poids features — jamais inline
  backtest/
    backtest.module.ts
    backtest.service.ts            # rejoue les ModelRun sur données historiques
    backtest.report.ts             # Brier Score, Calibration Error, ROI simulé
```

---

## Semaine 1 — ETL historique (fixtures + résultats + xG + stats)

### Prérequis techniques

Installer dans `apps/backend` :

```bash
pnpm add bullmq ioredis cheerio zod pino pino-pretty
pnpm add -D @types/cheerio
```

Ajouter au catalog (`pnpm-workspace.yaml`) :
`bullmq`, `ioredis`, `cheerio`, `zod`, `pino`, `pino-pretty`

---

### Worker 1 — `fixtures_sync`

**Quoi :** Importe les fixtures (matchs planifiés et joués) depuis football-data.org.

**Pourquoi en premier :** Toutes les autres données (scores, xG, stats) se rattachent à une
`Fixture`. Sans fixtures, rien ne peut être inséré en base.

**Source :** `https://api.football-data.org/v4/competitions/PL/matches?season=YYYY`
Clé API gratuite, header `X-Auth-Token`.

**Rate limit :** 10 req/min (free tier) → throttle 1 req/6s.

**Ce que le worker fait :**

1. Récupère les matchs pour les saisons 2021, 2022, 2023 (3 saisons EPL)
2. Valide chaque payload avec un schéma Zod strict
3. Upsert `Competition` → `Season` → `Team` (homeTeam + awayTeam) → `Fixture`
4. Si Zod échoue : rejette le payload entier, log Pino error, continue le reste

**Schéma Zod à créer (`schemas/fixture.schema.ts`) :**

```ts
// Valide la réponse brute de football-data.org avant tout upsert
const FootballDataFixtureSchema = z.object({
  id: z.number(),
  utcDate: z.string().datetime(),
  matchday: z.number().int().positive(),
  status: z.enum(["SCHEDULED", "FINISHED", "POSTPONED", "CANCELLED"]),
  homeTeam: z.object({
    id: z.number(),
    name: z.string(),
    shortName: z.string(),
  }),
  awayTeam: z.object({
    id: z.number(),
    name: z.string(),
    shortName: z.string(),
  }),
  score: z.object({
    fullTime: z.object({
      home: z.number().nullable(),
      away: z.number().nullable(),
    }),
  }),
});
```

**Règles Prisma :**

- `upsert` sur `externalId` — réentrant, safe à rejouer
- Fixture `POSTPONED` → stockée, aucun `ModelRun` généré (check dans betting-engine)

---

### Worker 2 — `results_sync`

**Quoi :** Met à jour les scores et statuts des fixtures déjà en base.

**Pourquoi séparé de `fixtures_sync` :** La séparation des responsabilités. `fixtures_sync`
crée les entités, `results_sync` met à jour les résultats. En production, `results_sync`
tournera post-match (triggered by BullMQ après la fin d'un match).

**Source :** Même endpoint football-data.org, filtre sur `status=FINISHED`.

**Ce que le worker fait :**

1. Récupère uniquement les matchs `FINISHED`
2. Valide avec `ResultSchema` (Zod)
3. Update `Fixture` : `homeScore`, `awayScore`, `status: FINISHED`
4. Ne touche pas aux fixtures `POSTPONED` ou `CANCELLED`

**Schéma Zod (`schemas/result.schema.ts`) :**

```ts
const ResultSchema = z.object({
  externalId: z.number(),
  homeScore: z.number().int().nonnegative(),
  awayScore: z.number().int().nonnegative(),
  status: z.literal("FINISHED"),
});
```

---

### Worker 3 — `xg_sync`

**Quoi :** Récupère les xG (Expected Goals) par match depuis Understat.

**Pourquoi xG :** Le xG mesure la qualité des occasions, pas juste les buts marqués.
C'est le signal le plus prédictif pour le modèle de Poisson (voir EVCORE.md §4.1).

**Source :** `https://understat.com/league/EPL/YYYY` — scraping HTML.
Understat n'a pas d'API officielle, les données sont injectées dans le HTML en JSON encodé.

**Rate limit :** Custom delay 3s entre chaque requête.

**Ce que le worker fait :**

1. Charge la page de la saison EPL
2. Parse le JSON encodé dans `<script>` (pattern `var datesData = JSON.parse(...)`)
3. Extrait `h_xg` (home xG) et `a_xg` (away xG) par match
4. Matche chaque match Understat avec une `Fixture` en base via date + équipes
5. Valide avec `XgSchema` (Zod)
6. Update `Fixture.homeXg` et `Fixture.awayXg`

**Schéma Zod (`schemas/xg.schema.ts`) :**

```ts
const XgMatchSchema = z
  .object({
    h_id: z.string(), // Understat team ID
    a_id: z.string(),
    datetime: z.string(),
    h_xg: z
      .string()
      .regex(/^\d+\.\d+$/)
      .transform(Number),
    a_xg: z
      .string()
      .regex(/^\d+\.\d+$/)
      .transform(Number),
  })
  .refine((d) => d.h_xg >= 0 && d.h_xg <= 10, {
    message: "xG home hors plage valide [0, 10]",
  });
```

**Attention :** Si le match Understat ne peut pas être matché à une `Fixture` DB →
log warning + skip (ne pas bloquer les autres). Le matching se fait via date (±1 jour) + équipe.

---

### Worker 4 — `stats_sync`

**Quoi :** Récupère les stats d'équipes depuis FBref (forme, dom/ext).

**Source :** `https://fbref.com/en/comps/9/Premier-League-Stats` — scraping Cheerio.

**Rate limit :** 1 req/3s (politique FBref — respecter absolument, risque de ban IP).

**Ce que le worker fait :**

1. Charge la page de la saison
2. Parse les tableaux HTML avec Cheerio
3. Extrait par équipe : `W/D/L` domicile, `W/D/L` extérieur, forme sur 5 derniers matchs
4. Valide avec `StatsSchema` (Zod)
5. Insère dans `TeamStats` (snapshot de début de saison, recalculé rolling en Semaine 2)

**Schéma Zod (`schemas/stats.schema.ts`) :**

```ts
const TeamStatsRawSchema = z.object({
  teamName: z.string().min(1),
  homeWins: z.number().int().nonnegative(),
  homeDraws: z.number().int().nonnegative(),
  homeLosses: z.number().int().nonnegative(),
  awayWins: z.number().int().nonnegative(),
  awayDraws: z.number().int().nonnegative(),
  awayLosses: z.number().int().nonnegative(),
});
```

---

### Setup BullMQ

Chaque worker est un `BullMQ Worker` qui consomme une queue Redis.

```ts
// etl.module.ts — enregistrement des queues
BullModule.registerQueue(
  { name: "fixtures-sync" },
  { name: "results-sync" },
  { name: "xg-sync" },
  { name: "stats-sync" },
);

// Pattern worker (même pour tous)
@Processor("fixtures-sync")
export class FixturesSyncWorker extends WorkerHost {
  async process(job: Job): Promise<void> {
    // 1. fetch → 2. Zod.parse (throw si invalid) → 3. upsert DB
  }
}
```

Retry config BullMQ :

```ts
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  // Si 3 échecs : job passe en "failed" → Novu alert
}
```

---

### Tests Semaine 1

Pour chaque schéma Zod, tester :

- ✅ Payload valide → parse OK
- ❌ Champ manquant → ZodError
- ❌ Type incorrect (string à la place de number) → ZodError
- ⚠️ Cas limites (xG = 0, score 0-0, fixture POSTPONED)

```ts
// Exemple : schemas/xg.schema.spec.ts
describe('XgMatchSchema', () => {
  it('accepte un xG valide', () => {
    expect(() => XgMatchSchema.parse({ h_xg: '1.23', a_xg: '0.87', ... })).not.toThrow();
  });
  it('rejette un xG négatif', () => {
    expect(() => XgMatchSchema.parse({ h_xg: '-0.5', ... })).toThrow();
  });
  it('rejette un xG > 10 (données corrompues)', () => {
    expect(() => XgMatchSchema.parse({ h_xg: '15.2', ... })).toThrow();
  });
});
```

---

## Semaine 2 — Stats rolling

Les données brutes sont en base. On calcule les features qui alimentent le modèle.

### Feature 1 — Forme récente (poids 30%)

**Définition :** 5 derniers matchs de l'équipe, avec décroissance exponentielle (facteur 0.8).

```
résultat le plus récent × 1.0
résultat précédent      × 0.8
                        × 0.64
                        × 0.51
                        × 0.41
```

Résultat : W = 3 pts, D = 1 pt, L = 0 pt → normalisé sur 3.

**Implémentation :**

```ts
function calculateRecentForm(results: MatchResult[]): Decimal {
  const DECAY = 0.8;
  const weights = [1.0, DECAY, DECAY ** 2, DECAY ** 3, DECAY ** 4];
  const last5 = results.slice(-5).reverse(); // plus récent en premier

  const weightedSum = last5.reduce((sum, result, i) => {
    const pts = result === "W" ? 3 : result === "D" ? 1 : 0;
    return sum + pts * (weights[i] ?? 0);
  }, 0);

  const maxPossible = weights
    .slice(0, last5.length)
    .reduce((s, w) => s + w * 3, 0);
  return new Decimal(weightedSum / maxPossible); // normalisé [0, 1]
}
```

**Edge case :** Si l'équipe a joué moins de 5 matchs en saison → utilise les matchs disponibles.
Si moins de 5 matchs → `recentForm` exclu du scoring (poids redistribués, voir EVCORE.md §8).

---

### Feature 2 — xG rolling (poids 30%)

**Définition :** Moyenne des xG marqués et encaissés sur les 10 derniers matchs.

```ts
// Rolling 10 matchs — utilise Fixture.homeXg / awayXg déjà en base
function calculateRollingXg(
  fixtures: FixtureWithXg[],
  teamId: string,
): { xgFor: Decimal; xgAgainst: Decimal } {
  const last10 = fixtures.slice(-10);
  // xgFor = xG de l'équipe dans ces matchs (home ou away selon contexte)
  // xgAgainst = xG concédé
}
```

---

### Feature 3 — Performance dom/ext (poids 25%)

**Définition :** Taux de victoire / nul / défaite selon le contexte (domicile ou extérieur),
sur toute la saison en cours.

```ts
// Calculé séparément pour homeContext et awayContext
function calculateDomExtPerf(
  fixtures: Fixture[],
  teamId: string,
  context: "home" | "away",
) {
  const relevant = fixtures.filter((f) =>
    context === "home" ? f.homeTeamId === teamId : f.awayTeamId === teamId,
  );
  return {
    winRate: new Decimal(wins / relevant.length),
    drawRate: new Decimal(draws / relevant.length),
    lossRate: new Decimal(losses / relevant.length),
  };
}
```

---

### Feature 4 — Volatilité ligue (poids 15%)

**Définition :** Écart-type des totaux de buts par match dans la ligue sur la saison.

```ts
import { standardDeviation } from "simple-statistics"; // via pnpm add simple-statistics

function calculateLeagueVolatility(fixtures: Fixture[]): Decimal {
  const finished = fixtures.filter(
    (f) => f.status === "FINISHED" && f.homeScore !== null,
  );
  const totals = finished.map((f) => (f.homeScore ?? 0) + (f.awayScore ?? 0));
  return new Decimal(standardDeviation(totals));
}
```

---

### Stockage — `TeamStats`

Après chaque calcul, on insère une ligne dans `TeamStats` pour chaque équipe,
référencée à la fixture venant d'être jouée (snapshot rolling à ce moment précis).

```ts
// rolling-stats.service.ts
async computeAndStore(teamId: string, afterFixtureId: string): Promise<void> {
  const stats = await this.computeStats(teamId, afterFixtureId);
  await this.prisma.teamStats.upsert({
    where: { teamId_afterFixtureId: { teamId, afterFixtureId } },
    create: stats,
    update: stats,
  });
}
```

### Trigger applicatif (backfill)

Le module expose 2 endpoints manuels pour lancer le calcul historique:

- `POST /rolling-stats/backfill/:season` (ex. `2021`)
- `POST /rolling-stats/backfill-all` (saisons `ETL_CONSTANTS.EPL_SEASONS`)

Le backfill parcourt les fixtures `FINISHED` de la saison et calcule 2 snapshots `TeamStats` par fixture (home + away).

---

## Semaine 3 — Modèle probabiliste (Poisson)

### Pourquoi Poisson

La distribution de Poisson modélise naturellement le nombre de buts dans un match.
Paramètre `λ` (lambda) = taux de buts attendu = fonction des xG et de la force des équipes.

### Calcul des probabilités 1X2

```ts
import * as jStat from "jstat"; // pnpm add jstat

// λ home = xgFor(home) × (1 - xgAgainst(away) / leagueAvgXg)
// λ away = xgFor(away) × (1 - xgAgainst(home) / leagueAvgXg)

function poissonProba(
  lambdaHome: number,
  lambdaAway: number,
): { home: Decimal; draw: Decimal; away: Decimal } {
  let pHome = 0,
    pDraw = 0,
    pAway = 0;

  for (let h = 0; h <= 10; h++) {
    for (let a = 0; a <= 10; a++) {
      const p =
        jStat.poisson.pdf(h, lambdaHome) * jStat.poisson.pdf(a, lambdaAway);
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
    }
  }
  // Normaliser pour que home + draw + away = 1
  return {
    home: new Decimal(pHome),
    draw: new Decimal(pDraw),
    away: new Decimal(pAway),
  };
}
```

### Dérivation des autres marchés

À partir des probabilités 1X2, on dérive **les 4 marchés MVP** :

```ts
// Over/Under 2.5 — via distribution jointe de Poisson
pOver25 = P(totalButs > 2) = 1 - P(totalButs ≤ 2)

// BTTS — probabilité que les deux équipes marquent
pBTTS_yes = P(homeScore ≥ 1) × P(awayScore ≥ 1)
           = (1 - P(homeScore=0)) × (1 - P(awayScore=0))
           = (1 - e^-λHome) × (1 - e^-λAway)

// Double Chance — combinaisons des proba 1X2
p1X = pHome + pDraw
pX2 = pDraw + pAway
p12 = pHome + pAway
```

### Score déterministe

Les 4 features normalisées [0,1] sont combinées avec les poids de EVCORE.md §4.1 :

```ts
// ev.constants.ts — jamais inline, jamais modifié sans validation
export const FEATURE_WEIGHTS = {
  recentForm: new Decimal("0.30"),
  xg: new Decimal("0.30"),
  domExtPerf: new Decimal("0.25"),
  leagueVolat: new Decimal("0.15"),
} as const;

export const EV_THRESHOLD = new Decimal("0.08"); // ≥ 8%
```

```ts
deterministicScore =
  recentForm × 0.30 +
  xgScore × 0.30 +
  domExtScore × 0.25 +
  volatilityScore × 0.15
```

### Tests unitaires obligatoires

```ts
// betting-engine.service.spec.ts
describe("poissonProba", () => {
  it("retourne des proba qui somment à ~1", () => {
    const { home, draw, away } = poissonProba(1.5, 1.2);
    const sum = home.plus(draw).plus(away);
    expect(sum.toDecimalPlaces(4).toNumber()).toBeCloseTo(1, 3);
  });

  it("favorise l équipe avec plus de xG", () => {
    const { home } = poissonProba(2.0, 0.8);
    expect(home.toNumber()).toBeGreaterThan(0.5);
  });
});

describe("deterministicScore", () => {
  it("calcule le score avec inputs connus", () => {
    const score = calculateDeterministicScore({
      recentForm: new Decimal("0.8"),
      xg: new Decimal("0.7"),
      domExtPerf: new Decimal("0.6"),
      leagueVolat: new Decimal("0.4"),
    });
    // 0.8×0.30 + 0.7×0.30 + 0.6×0.25 + 0.4×0.15 = 0.24+0.21+0.15+0.06 = 0.66
    expect(score.toNumber()).toBeCloseTo(0.66, 4);
  });
});
```

---

## Semaine 4 — Backtest & calibration

### Pipeline backtest

Pour chaque fixture historique `FINISHED` (3 saisons) :

1. Charger les `TeamStats` **au moment du match** (snapshot `afterFixtureId` du match précédent)
2. Calculer les probabilités Poisson
3. Générer un `ModelRun` simulé (sans EV → odds absentes en MVP)
4. Comparer `probEstimated` vs résultat réel → contribution au Brier Score

```ts
// backtest.service.ts
async runBacktest(seasonId: string): Promise<BacktestReport> {
  const fixtures = await this.fixtureRepo.findFinishedBySeason(seasonId);

  for (const fixture of fixtures) {
    const stats = await this.teamStatsRepo.findAtFixture(fixture.id);
    if (!stats) continue; // moins de données que nécessaire → skip

    const proba = this.bettingEngine.computeProbabilities(stats);
    contributions.push({ fixture, proba, actual: getOutcome(fixture) });
  }

  return this.buildReport(contributions);
}
```

### Brier Score

Mesure l'accuracy d'une prédiction probabiliste. Plus proche de 0 = meilleur.

```ts
// BS = (1/N) × Σ (p_estimated - outcome)²
// outcome = 1 si l'événement s'est produit, 0 sinon
function brierScore(predictions: { prob: number; actual: 0 | 1 }[]): number {
  const sum = predictions.reduce((s, p) => s + (p.prob - p.actual) ** 2, 0);
  return sum / predictions.length;
}
```

Seuil acceptable à définir lors du backtest. Référence football : BS < 0.20 pour 1X2.

### Calibration Error

Mesure si les probabilités estimées correspondent aux fréquences réelles.

```ts
// simple-statistics pour grouper par bucket
// Bucket 0.5–0.6 : si on prédit 55%, ça arrive combien de fois réellement ?
```

### Rapport final

```ts
type BacktestReport = {
  seasonId: string;
  fixtureCount: number;
  brierScore: Decimal; // cible < 0.20
  calibrationError: Decimal; // cible < 0.05
  roiSimulated: Decimal; // simulé sans odds réelles (estimation)
  reportGeneratedAt: Date;
};
```

Log Pino en JSON. L'alerte Novu (`brierScore > 0.25`) est planifiée en Semaine 8 (tracking).

---

## Ordre d'implémentation recommandé

```
[x] 1. ETL module + BullMQ setup (connexion Redis, queues)
[x] 2. fixtures_sync + Zod schema + tests Zod → données en base
[x] 3. results_sync + Zod schema + tests Zod → scores en base
[x] 4. xg_sync + Zod schema + tests Zod → xG en base
[~] 5. stats_sync + Zod schema + tests Zod → stats brutes (validation OK, persistance TeamStats en Semaine 2)
[x] 6. rolling-stats : recentForm + tests unitaires
[x] 7. rolling-stats : xG rolling + tests unitaires
[x] 8. rolling-stats : dom/ext + volatilité + tests unitaires
[x] 9. TeamStats upsert → snapshot par fixture (+ backfill manuel)
[x] 10. betting-engine : Poisson proba 1X2 + tests inputs/outputs connus
[x] 11. betting-engine : dérivation Over/Under, BTTS, Double Chance
[x] 12. betting-engine : score déterministe + ev.constants.ts
[x] 12b. betting-engine : analyse fixture/saison + persistance ModelRun
[x] 13. backtest : pipeline par saison (rejouable sur 3 saisons)
[x] 14. backtest : Brier Score + Calibration Error
[x] 15. backtest : rapport JSON + log Pino
[ ] 16. tracking (S8) : alerte Novu si Brier Score > seuil
```

---

## Dépendances à ajouter

```bash
# Runtime
pnpm --filter backend add simple-statistics

# Types
# (none required here)
```

`bullmq`, `ioredis`, `cheerio`, `zod`, `pino`, `pino-pretty`, `decimal.js` et `@types/cheerio` sont déjà installés/catalogués.
`date-fns` est aussi installé/catalogué pour centraliser la manipulation des dates.

---

## Points de vigilance

| Risque                             | Mitigation                                                      |
| ---------------------------------- | --------------------------------------------------------------- |
| Rate limit FBref (1 req/3s)        | Throttle via `setTimeout` dans le worker, pas de retry agressif |
| Matching Understat ↔ Fixture       | Fuzzy matching sur date (±1j) + nom équipe normalisé            |
| Moins de 5 matchs en saison        | `recentForm` exclue, poids redistribués proportionnellement     |
| Fixture `POSTPONED`                | Vérification `status !== 'POSTPONED'` avant tout `ModelRun`     |
| `decimal.js` obligatoire           | Aucun calcul d'odds/EV/prob avec `number` natif                 |
| Zod reject → pas de partial insert | Transaction Prisma sur chaque ingestion, rollback si Zod fail   |
