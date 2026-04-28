# P3 — Page Performance : plan d'implémentation

use skills in projects : shadcn-ui, nextjs, playwright

## Endpoints backend disponibles (vérifiés)

| Endpoint                       | Méthode | Données                                                                                        |
| ------------------------------ | ------- | ---------------------------------------------------------------------------------------------- |
| `/dashboard/summary`           | GET     | `PnlSummary` : roi, winRate, netUnits, settledBets, wonBets                                    |
| `/dashboard/competition-stats` | GET     | `CompetitionStat[]` : ROI model + user par compétition (30j)                                   |
| `/adjustment`                  | GET     | `AdjustmentProposal[]` : calibrationError, proposedWeights, createdAt, status                  |
| `/risk/report/weekly`          | POST    | `WeeklyReportPayload` : roiOneXTwo, betsPlaced (brierScore = 0 placeholder)                    |
| `/backtest`                    | POST    | `BacktestReport` : roiSimulated, brierScore, marketPerformance[] — résultats NON stockés en DB |

---

## Hooks à créer

### 1. `domains/adjustment/types/adjustment.ts`

```ts
export type WeightMap = {
  recentForm: number;
  xg: number;
  domExtPerf: number;
  leagueVolat: number;
};

export type AdjustmentProposal = {
  id: string;
  currentWeights: WeightMap;
  proposedWeights: WeightMap;
  calibrationError: number;
  triggerBetCount: number;
  status: "APPLIED" | "PENDING";
  appliedAt: string | null;
  createdAt: string;
  notes: string | null;
};
```

### 2. `domains/adjustment/use-cases/get-adjustment-proposals.ts`

```ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { AdjustmentProposal } from "../types/adjustment";

export function useAdjustmentProposals() {
  return useQuery({
    queryKey: ["adjustment-proposals"],
    queryFn: () =>
      clientApiRequest<AdjustmentProposal[]>("/adjustment", {
        fallbackErrorMessage: "Impossible de charger les proposals.",
      }),
    refetchInterval: 5 * 60_000,
  });
}
```

---

## Structure de la page

```
app/dashboard/performance/
├── page.tsx                          ← Server Component (SSR pnlSummary)
└── components/
    ├── overview-section.tsx          ← StatCards : ROI, winRate, netUnits, settled
    ├── calibration-section.tsx       ← EvLineChart calibrationError + poids actuels
    ├── weights-timeline-section.tsx  ← EvLineChart 4 facteurs (recentForm, xg, domExtPerf, leagueVolat)
    ├── competition-stats-section.tsx ← DataTable ROI par compétition
    └── backtest-section.tsx          ← Bouton "Lancer backtest" + résultats inline
```

---

## Section 1 — Vue d'ensemble (`overview-section.tsx`)

- Hook : `useDashboardSummary()` déjà existant dans `domains/dashboard/use-cases/get-dashboard-summary.ts`
- Afficher `pnlSummary` : roi, winRate, netUnits, settledBets/wonBets
- 4 `StatCard` sur grille `grid-cols-2 sm:grid-cols-4`
- Pas de sélecteur de période pour l'instant (l'API ne supporte pas de plage — pnlDate = jour exact)

```tsx
"use client";
import { useDashboardSummary } from "@/domains/dashboard/use-cases/get-dashboard-summary";
import { StatCard } from "@evcore/ui";

export function OverviewSection() {
  const { data } = useDashboardSummary();
  const pnl = data?.pnlSummary;
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="ROI" value={pnl?.roi ?? "—"} tone="accent" />
      <StatCard label="Réussite" value={pnl?.winRate ?? "—"} tone="success" />
      <StatCard label="Gain net" value={pnl?.netUnits ?? "—"} tone="neutral" />
      <StatCard
        label="Paris réglés"
        value={String(pnl?.settledBets ?? "—")}
        tone="neutral"
      />
    </section>
  );
}
```

---

## Section 2 — Calibration (`calibration-section.tsx`)

- Hook : `useAdjustmentProposals()` (à créer)
- `EvLineChart` : x = `createdAt` (formater en date courte), y = `calibrationError`
- Montrer seulement les proposals `status === "APPLIED"` pour la courbe
- En dessous : poids actuels (dernière proposal APPLIED) avec une `StatList`
- Attention : `calibrationError` est un Brier score (0 = parfait, 1 = catastrophique)

```tsx
const applied = proposals.filter((p) => p.status === "APPLIED");
const chartData = applied.map((p) => ({
  date: formatDateShort(p.createdAt),
  brierScore: p.calibrationError,
}));
// EvLineChart : lines=[{ key: "brierScore", color: CHART_COLORS.amber, label: "Erreur calibration" }]
```

---

## Section 3 — Évolution des poids (`weights-timeline-section.tsx`)

- Même hook : `useAdjustmentProposals()`
- `EvLineChart` multi-lignes : 1 ligne par facteur
- `LineDef[]` à construire :

```ts
const FACTOR_LINES: LineDef[] = [
  { key: "recentForm", color: CHART_COLORS.teal, label: "Forme récente" },
  { key: "xg", color: CHART_COLORS.amber, label: "Expected Goals" },
  { key: "domExtPerf", color: CHART_COLORS.indigo, label: "Dom./Ext." },
  { key: "leagueVolat", color: CHART_COLORS.muted, label: "Stabilité ligue" },
];
```

- Données : `applied.map(p => ({ date, ...p.proposedWeights }))`
- Si 0 ou 1 proposal : afficher un `Empty` state "Pas encore de données d'apprentissage."

---

## Section 4 — ROI par compétition (`competition-stats-section.tsx`)

- Hook : `useCompetitionStats()` déjà existant dans `domains/dashboard/use-cases/get-competition-stats.ts`
- `DataTable` avec colonnes : Compétition, Analysés (30j), ROI modèle, Réussite modèle, Mes paris (ROI user)
- Mettre `— ` si roi/winRate est null (données insuffisantes < 10 bets)
- Trier par `activeFixtures DESC` (déjà fait côté backend)
- Highlight : la ligne avec le meilleur ROI model en vert, le pire en rouge (via `rowClassName`)

```ts
const columns: ColumnDef<CompetitionStat>[] = [
  { id: "name", header: "Compétition", accessorKey: "competitionName" },
  { id: "fixtures", header: "Matchs 30j", accessorFn: (r) => r.activeFixtures },
  {
    id: "modelRoi",
    header: "ROI Modèle",
    accessorFn: (r) => r.model.roi ?? "—",
  },
  {
    id: "modelWr",
    header: "Réussite",
    accessorFn: (r) => r.model.winRate ?? "—",
  },
  {
    id: "myRoi",
    header: "Mes paris",
    accessorFn: (r) => r.myPicks?.roi ?? "—",
  },
];
```

---

## Section 5 — Backtest (`backtest-section.tsx`)

- Bouton "Lancer le backtest" → `POST /backtest` via `clientApiRequest`
- State local : `"idle" | "loading" | "done" | "error"`
- Résultat inline quand `done` :
  - `StatCard` : ROI simulé, Brier Score, Max drawdown, paris analysés
  - `EvBarChart` : marketPerformance — ROI par marché (ONE_X_TWO, OVER_UNDER…)
- Attention : backtest est lent (plusieurs secondes) — montrer un spinner
- `useMutation` de TanStack Query :

```ts
const mutation = useMutation({
  mutationFn: () =>
    clientApiRequest<BacktestReport>("/backtest", { method: "POST" }),
});
```

---

## i18n — clés à ajouter dans `fr.json` / `en.json`

Ajouter sous le namespace `"performancePage"` (distinct de `"performance"` existant) :

```json
"performancePage": {
  "title": "Performance",
  "overview": "Vue d'ensemble",
  "calibration": "Calibration du modèle",
  "calibrationHint": "Score Brier après chaque recalibration automatique (0 = parfait).",
  "weights": "Évolution des poids",
  "weightsHint": "Contribution de chaque facteur, ajustée automatiquement.",
  "competitions": "ROI par compétition",
  "competitionsPeriod": "30 derniers jours",
  "backtest": "Backtest",
  "backtestHint": "Simulation sur les données historiques. Durée estimée : 30–60 s.",
  "runBacktest": "Lancer le backtest",
  "backtestRunning": "Backtest en cours…",
  "roiSimulated": "ROI simulé",
  "maxDrawdown": "Max drawdown",
  "noCalibrationData": "Aucune recalibration effectuée.",
  "noWeightData": "Pas encore de données d'apprentissage.",
  "factors": {
    "recentForm": "Forme récente",
    "xg": "Expected Goals (xG)",
    "domExtPerf": "Avantage dom./ext.",
    "leagueVolat": "Stabilité de la ligue"
  }
}
```

---

## Navigation (`app-shell.tsx`)

Ajouter après "Picks du jour" (avant "Mes coupons") :

```ts
{
  label: "Performance",
  href: "/dashboard/performance",
  active: pathname.startsWith("/dashboard/performance"),
},
```

Et dans `messages/fr.json` → `"nav"` : ajouter `"performance": "Performance"`.

---

## `page.tsx` — Server Component

```tsx
import { getTranslations } from "next-intl/server";
import { Page, PageContent } from "@evcore/ui";
import { OverviewSection } from "./components/overview-section";
import { CalibrationSection } from "./components/calibration-section";
import { WeightsTimelineSection } from "./components/weights-timeline-section";
import { CompetitionStatsSection } from "./components/competition-stats-section";
import { BacktestSection } from "./components/backtest-section";

export default async function PerformancePage() {
  const t = await getTranslations("performancePage");
  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="mb-6">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("overview")}
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            {t("title")}
          </h1>
        </div>
        <div className="flex flex-col gap-5">
          <OverviewSection />
          <CalibrationSection />
          <WeightsTimelineSection />
          <CompetitionStatsSection />
          <BacktestSection />
        </div>
      </PageContent>
    </Page>
  );
}
```

---

## Ordre d'implémentation recommandé

1. Types `adjustment.ts` + hook `useAdjustmentProposals`
2. i18n (`fr.json` + `en.json`) — namespace `performancePage`
3. Nav (`app-shell.tsx` + `messages`)
4. `page.tsx`
5. `overview-section.tsx` (utilise hook existant)
6. `calibration-section.tsx` + `weights-timeline-section.tsx` (même hook)
7. `competition-stats-section.tsx` (utilise hook existant)
8. `backtest-section.tsx` (dernier — mutation POST)
9. Typecheck + vérification visuelle
10. Commit + mise à jour `TODO-UI.md`
