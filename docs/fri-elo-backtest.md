# FRI — Implémentation ELO dans le backtest

Date : 2026-06-02  
Statut : **à implémenter** — FRI actuellement skippé à 100% en backtest (MISSING_TEAM_STATS)

---

## Contexte

Le moteur live utilise un pipeline dédié pour FRI (amicaux internationaux) :

```
isSeniorNationalTeam(home) && isSeniorNationalTeam(away)
  → ELO snapshot → eloProbabilities(eloHome, eloAway)   [FRI_ELO_REAL]
  → sinon Pinnacle déviguée                              [ODDS_DEVIG]
  → sinon skip                                           [fallbackReason]
```

Le backtest ne connaît que le chemin Poisson → tous les fixtures FRI tombent en `MISSING_TEAM_STATS`.

Pour calibrer les canaux CONF/DRAW/BTTS sur FRI, il faut porter le chemin ELO dans `runBacktest()`.

---

## Ce qui existe déjà

### Table `NationalTeamEloRating`
Stocke les snapshots ELO historiques :
```
id, teamName, eloCode, rating (Int), source, snapshotAt (DateTime)
@@unique([teamName, snapshotAt])
@@index([snapshotAt])
@@index([teamName, snapshotAt])
```
→ plusieurs snapshots par équipe dans le temps → backtest peut charger le rating à la date de chaque fixture.

### Fonctions disponibles (à importer dans le backtest)
- `eloProbabilities(eloHome: number, eloAway: number): MatchProbabilities`  
  → dans `betting-engine.service.ts` (privé) ou à extraire dans `betting-engine.utils.ts`
- `isSeniorNationalTeam(name: string): boolean`  
  → dans `fri-elo.utils.ts`
- `TEAM_NAME_TO_ELO_CODE: Record<string, string>`  
  → dans `fri-elo.utils.ts`

### Constantes FRI
```typescript
// betting-engine.service.ts
const FRI_HOME_ADVANTAGE_ELO = 50;   // points ELO d'avantage domicile
const FRI_DRAW_RATE = 0.22;          // taux nul empirique pour les amicaux
```

---

## Plan d'implémentation

### Étape 1 — Extraire `eloProbabilities` dans les utils

`eloProbabilities` est actuellement une fonction inline ou privée dans le service.  
La déplacer dans `betting-engine.utils.ts` (ou `fri-elo.utils.ts`) pour qu'elle soit importable par le backtest.

**Fichiers :** `betting-engine.utils.ts`, `fri-elo.utils.ts`

```typescript
// fri-elo.utils.ts (à ajouter)
export function eloProbabilities(
  eloHome: number,
  eloAway: number,
  homeAdvantage = FRI_HOME_ADVANTAGE_ELO,
  drawRate = FRI_DRAW_RATE,
): MatchProbabilities {
  // formule actuelle du service (à copier/déplacer)
}
```

### Étape 2 — Charger les ELO snapshots dans le backtest

Dans `BacktestService`, ajouter une méthode de chargement des ELO par fixture date :

```typescript
// backtest.service.ts — nouvelle méthode privée
private async loadEloSnapshotsForFixtures(
  fixtures: FixtureForBacktest[],
  homeTeamNames: Map<string, string>,   // fixtureId → homeName
  awayTeamNames: Map<string, string>,   // fixtureId → awayName
): Promise<Map<string, { home: number | null; away: number | null }>> {
  // Pour chaque fixture, trouver le rating le plus récent AVANT scheduledAt
  // Grouper par teamName pour minimiser les requêtes
  // Retourner Map<fixtureId, { home, away }>
}
```

**Requête Prisma (par équipe) :**
```typescript
await prisma.nationalTeamEloRating.findFirst({
  where: {
    teamName: teamName,
    snapshotAt: { lte: fixture.scheduledAt },
  },
  orderBy: { snapshotAt: 'desc' },
})
```

**Optimisation :** charger tous les snapshots en une seule requête groupée, puis filtrer en mémoire par date (évite N+1).

### Étape 3 — Brancher dans `runBacktest()`

Dans la boucle principale de `runBacktest()`, détecter FRI et utiliser ELO :

```typescript
// Dans la boucle for (const fixture of fixtures)
if (competitionCode === 'FRI') {
  const homeTeamName = fixture.homeTeam?.name ?? null;
  const awayTeamName = fixture.awayTeam?.name ?? null;

  const isSenior =
    homeTeamName !== null &&
    awayTeamName !== null &&
    isSeniorNationalTeam(homeTeamName) &&
    isSeniorNationalTeam(awayTeamName);

  if (!isSenior) {
    skippedCount++;
    analysisEntries.push(buildAnalysisEntry({ reason: 'NON_SENIOR_FIXTURE', ... }));
    continue;
  }

  const eloEntry = eloByFixture.get(fixture.id);
  if (!eloEntry?.home || !eloEntry?.away) {
    skippedCount++;
    analysisEntries.push(buildAnalysisEntry({ reason: 'MISSING_ELO', ... }));
    continue;
  }

  const computed = {
    probabilities: eloProbabilities(eloEntry.home, eloEntry.away),
    deterministicScore: new Decimal(Math.max(
      eloEntry.home, eloEntry.away  // ou dériver depuis probabilities.home
    )),
    lambda: { home: 0, away: 0 },  // non pertinent pour FRI
    features: {} as DeterministicFeatures,
  };

  // suite normale : oneXTwoPredictions, calibrationPoints, appendPredictionCandidates...
}
```

### Étape 4 — Charger les noms d'équipes dans les fixtures FRI

Le backtest actuel ne sélectionne pas `homeTeam.name` dans la requête Prisma initiale.  
Ajouter ce select pour FRI :

```typescript
// Dans loadFixturesForSeason() ou directement dans runBacktest()
// Ajouter au select existant :
homeTeam: { select: { name: true } },
awayTeam: { select: { name: true } },
```

Conditionnel si nécessaire pour ne pas impacter les autres compétitions.

### Étape 5 — Reason codes à ajouter dans `backtest.constants.ts`

```typescript
// backtest-analysis.latest.ndjson reasons
'NON_SENIOR_FIXTURE'   // U17, U19, clubs — ignorés par FRI
'MISSING_ELO'          // équipe senior sans snapshot ELO avant la date
```

---

## Ce que le backtest FRI NE fait PAS (scope exclu)

- **EV/SV picks** : nécessitent des cotes Pinnacle historiques. Les cotes FRI ne sont pas stockées en DB pour les fixtures passées → 0 bets EV attendus. Ce n'est pas un problème — l'objectif est de calibrer CONF/DRAW/BTTS uniquement.
- **Pinnacle deviguée fallback** : inutile pour le backtest (pas de cotes historiques FRI). Les fixtures sans ELO sont skippées.

---

## Volume attendu après implémentation

FRI 2026-27 : 207 fixtures terminées dont 101 senior.

Sur ces 101 :
- Équipes couvertes par `TEAM_NAME_TO_ELO_CODE` : ~70 noms mappés
- Équipes avec snapshot ELO dans la DB : dépend des syncs effectués
- Estimation analysables : 60-80 fixtures

**À vérifier avant d'implémenter :**
```sql
SELECT COUNT(DISTINCT r.\"teamName\")
FROM national_team_elo_rating r
WHERE r.\"teamName\" IN (
  SELECT DISTINCT t.name FROM team t
  JOIN fixture f ON (f.\"homeTeamId\"=t.id OR f.\"awayTeamId\"=t.id)
  JOIN season s ON s.id=f.\"seasonId\"
  JOIN competition c ON c.id=s.\"competitionId\"
  WHERE c.code='FRI'
);
```

---

## Refactoring requis — qualité code

`backtest.service.ts` fait déjà ~2 500 lignes. L'ajout FRI ne doit pas aggraver ça. Les règles du projet s'appliquent intégralement.

### Règles TypeScript (strict)

- Zéro `any` — utiliser `unknown` puis narrower, ou typer proprement
- Types de retour explicites sur toutes les méthodes publiques et privées
- `noUncheckedIndexedAccess` actif — toujours vérifier `.get()` et accès tableaux
- `as const` sur les objets de config

### Extraction requise avant d'écrire le code FRI

**`eloProbabilities` est actuellement inline dans `BettingEngineService.analyzeFriFixture`.**  
Elle doit être extraite en fonction pure exportée dans `betting-engine.utils.ts` (ou `fri-elo.utils.ts`) AVANT d'être utilisée dans le backtest. Une fonction pure = testable, sans injection de service.

```typescript
// betting-engine.utils.ts — export pur, pas de dépendance NestJS
export function eloProbabilities(
  eloHome: number,
  eloAway: number,
  homeAdvantage?: number,
): MatchProbabilities { ... }
```

### Découpage en méthodes courtes

Ne pas inliner la logique FRI dans la boucle principale de `runBacktest()`. Extraire :

```
runBacktest()
  └─ processFriFixture(fixture, eloEntry) → FixtureResult | null
       └─ eloProbabilities()              ← pure, importée depuis utils
  └─ loadEloSnapshotsForFixtures()        ← privée, une seule requête groupée
```

`processFriFixture` doit être une méthode privée courte (< 30 lignes) qui retourne
`null` si le fixture doit être skippé (non-senior, ELO absent), ou un objet
`{ probabilities, actual, score }` exploitable par la boucle.

### Requête Prisma — pas de N+1

Charger **tous** les ELO nécessaires en **une seule requête** avant la boucle :

```typescript
// ✅ Une requête groupée
const allEloRows = await this.prisma.client.nationalTeamEloRating.findMany({
  where: { teamName: { in: allTeamNames }, snapshotAt: { lte: latestFixtureDate } },
  orderBy: { snapshotAt: 'desc' },
});
// Puis filtrer en mémoire par (teamName, fixture.scheduledAt)
```

```typescript
// ❌ À ne pas faire — N+1 dans la boucle
for (const fixture of fixtures) {
  const elo = await prisma.nationalTeamEloRating.findFirst({ where: { teamName: ... } });
}
```

### Select Prisma minimal

Le select des fixtures FRI nécessite `homeTeam.name` et `awayTeam.name`. Ne les ajouter
que dans la requête FRI (ou conditionnellement) — ne pas alourdir le type `FixtureForBacktest`
utilisé par toutes les autres compétitions.

Option propre : requête séparée `loadFriTeamNames(fixtureIds)` → `Map<string, { home: string; away: string }>`.

### Isolation — zéro régression sur les autres compétitions

- La branche FRI dans `runBacktest()` doit être entourée d'un `if (competitionCode === 'FRI') { ... continue; }` précoce.
- Aucune variable introduite pour FRI ne doit modifier les chemins Poisson existants.
- Les tests existants sur `runBacktest()` (BL1, PL, etc.) doivent passer sans modification.

### Tests à écrire

| Test | Fichier |
|------|---------|
| `eloProbabilities(1800, 1600)` → probas cohérentes (home > 0.5, sum = 1) | `betting-engine.utils.spec.ts` |
| `eloProbabilities` symétrie inverse : swap home/away → home/away swappés | idem |
| `processFriFixture` non-senior → retourne null | `backtest.service.spec.ts` |
| `processFriFixture` ELO manquant → retourne null | idem |
| `processFriFixture` ELO présent → retourne probas valides | idem |
| Backtest FRI end-to-end : `analyzedCount > 0` si ELO en DB | intégration |

### ESLint — vérification avant merge

```bash
pnpm --filter backend lint
pnpm --filter backend typecheck
pnpm --filter backend test  # tests unitaires doivent passer
```

---

## Fichiers à modifier

| Fichier | Changement |
|---------|------------|
| `betting-engine.utils.ts` | Extraire et exporter `eloProbabilities()` (pur, testable) |
| `betting-engine.service.ts` | Remplacer l'inline par un import de `eloProbabilities` |
| `fri-elo.utils.ts` | Exporter `FRI_HOME_ADVANTAGE_ELO`, `FRI_DRAW_RATE` si inline dans le service |
| `backtest.service.ts` | `loadEloSnapshotsForFixtures()` + `processFriFixture()` + branche dans `runBacktest()` |
| `backtest.constants.ts` | Ajouter reason codes `NON_SENIOR_FIXTURE`, `MISSING_ELO` |
| `betting-engine.utils.spec.ts` | Tests unitaires `eloProbabilities` |
| `backtest.service.spec.ts` | Tests unitaires `processFriFixture` |

---

## Test de validation

Après implémentation :
```bash
curl -X POST http://localhost:3001/backtest/FRI/2026-27
```

Attendu :
- `analyzedCount` > 0 (plus de 0/64)
- `brierScore` dans la réponse
- `predictionBacktests[CONF].thresholds` avec des picks

Calibration :
- Brier FRI attendu : inconnu (pas de baseline). Comparer à 0.65 (WC).
- CONF : si HR ≥ 55% à un seuil → activer dans `prediction.constants.ts`
- DRAW : taux nul FRI ~22% (FRI_DRAW_RATE) → seuil 0.22+ 
- BTTS : FRI senior = matchs ouverts → signal potentiellement plus fort que WCQ

---

## Note sur `prediction.constants.ts` actuelle

```typescript
FRI: {
  // FRI backtest 2026-05-03: only 44 fixtures total — no signal derivable.
  CONF: { enabled: false, threshold: 0.99, minSampleN: 50 },
}
```

Ce commentaire était basé sur un backtest Poisson (chemin incorrect). À mettre à jour après le backtest ELO.
