"use client";

import { Check, ShoppingCart } from "lucide-react";
import {
  Badge,
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  StatCard,
} from "@evcore/ui";
import type { ColumnDef } from "@tanstack/react-table";
import {
  fixtureStatusLabel,
  formatCombinedPickForDisplay,
} from "@/helpers/fixture";
import { formatScore } from "@/domains/fixture/helpers/fixture";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import { draftItemKey } from "@/domains/bet-slip/types/bet-slip";
import type { BetSlipDraftItem } from "@/domains/bet-slip/types/bet-slip";
import type {
  FixtureEvaluatedPickSnapshot,
  FixtureModelFactors,
  FixtureRow,
} from "@/domains/fixture/types/fixture";
import { CanalBadge } from "@/components/canal-badge";

// ── helpers ──────────────────────────────────────────────────────────────────

type BadgeVariant = "accent" | "success" | "warning" | "destructive" | "neutral";

function fixtureStatusTone(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (s === "finished") return "neutral";
  if (s === "in_progress") return "accent";
  if (s === "postponed" || s === "cancelled") return "destructive";
  return "warning";
}

function formatEv(raw: string): string {
  const v = parseFloat(raw);
  if (Number.isNaN(v)) return raw;
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

const REJECTION_LABELS: Record<string, string> = {
  odds_below_floor: "Cote trop basse",
  odds_above_cap: "Cote trop haute",
  ev_below_threshold: "Valeur insuffisante",
  ev_above_hard_cap: "Valeur au-dessus du plafond",
  ev_above_soft_cap: "Valeur au-dessus du plafond (calibration)",
  filtered_longshot: "Grande cote écartée",
  market_suspended: "Marché suspendu",
  probability_too_low: "Probabilité insuffisante",
  quality_score_below_threshold: "Qualité insuffisante",
  under_high_lambda: "Nbre de buts élevé",
};

function rejectionLabel(reason?: string): string {
  if (!reason) return "—";
  return REJECTION_LABELS[reason] ?? reason;
}

// ── factor bars ───────────────────────────────────────────────────────────────

const FACTOR_DEFS: { key: keyof FixtureModelFactors; label: string }[] = [
  { key: "recentForm", label: "Forme récente" },
  { key: "xg", label: "Expected Goals (xG)" },
  { key: "performanceDomExt", label: "Avantage dom./ext." },
  { key: "volatiliteLigue", label: "Stabilité de la ligue" },
];

function FactorBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const pct = Math.min(Math.max(value, 0), 1) * 100;
  const color =
    pct >= 65
      ? "var(--color-success)"
      : pct >= 40
        ? "var(--canal-ev)"
        : "var(--color-destructive)";

  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-[0.72rem] text-muted-foreground">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct.toFixed(0)}%`, background: color }}
        />
      </div>
      <span
        className="w-9 shrink-0 text-right text-[0.72rem] font-semibold tabular-nums"
        style={{ color }}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// ── merged markets table ──────────────────────────────────────────────────────

function PlacePickButton({
  snap,
  fixtureId,
  alreadyInUserTicket,
  onPlace,
}: {
  snap: FixtureEvaluatedPickSnapshot;
  fixtureId: string;
  alreadyInUserTicket: boolean;
  onPlace: (snap: FixtureEvaluatedPickSnapshot) => void;
}) {
  const { isInSlip } = useBetSlip();
  const key = draftItemKey({
    fixtureId,
    market: snap.market,
    pick: snap.pick,
    comboMarket: snap.comboMarket,
    comboPick: snap.comboPick,
  });
  const inSlip = isInSlip(key);
  const disabled = alreadyInUserTicket && !inSlip;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (inSlip || alreadyInUserTicket) return;
        onPlace(snap);
      }}
      disabled={disabled}
      title={
        inSlip
          ? "Déjà dans le coupon"
          : alreadyInUserTicket
            ? "Déjà dans vos coupons"
            : "Placer ce pick"
      }
      className={`flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border text-[0.7rem] font-semibold transition-colors ${
        inSlip
          ? "border-success/20 bg-success/12 text-success"
          : disabled
            ? "cursor-not-allowed border-border bg-secondary text-muted-foreground"
            : "border-border bg-panel text-muted-foreground hover:border-accent hover:text-accent"
      }`}
    >
      {inSlip ? <Check size={13} /> : <ShoppingCart size={13} />}
    </button>
  );
}

function makeMarketsColumns(
  fixtureId: string,
  alreadyInUserTicket: boolean,
  onPlace: (snap: FixtureEvaluatedPickSnapshot) => void,
  fixtureStatus: string,
): ColumnDef<FixtureEvaluatedPickSnapshot>[] {
  return [
    {
      id: "market",
      header: "Marché",
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {formatCombinedPickForDisplay(row.original)}
        </span>
      ),
    },
    {
      id: "prob",
      header: "Prob.",
      accessorFn: (row) => `${(Number(row.probability) * 100).toFixed(1)}%`,
      meta: { align: "right" },
    },
    {
      id: "odds",
      header: "Cote",
      accessorKey: "odds",
      meta: { align: "right" },
    },
    {
      id: "ev",
      header: "Valeur",
      cell: ({ row }) => {
        const v = parseFloat(row.original.ev);
        return (
          <span
            className={`tabular-nums font-semibold ${v >= 0 ? "text-success" : "text-danger"}`}
          >
            {formatEv(row.original.ev)}
          </span>
        );
      },
      meta: { align: "right" },
    },
    {
      id: "status",
      header: "Statut",
      cell: ({ row }) =>
        row.original.status === "viable" ? (
          <Badge variant="success">Viable</Badge>
        ) : (
          <Badge variant="neutral">{rejectionLabel(row.original.rejectionReason)}</Badge>
        ),
    },
    {
      id: "action",
      header: "",
      cell: ({ row }) =>
        fixtureStatus === "FINISHED" ? null : (
          <PlacePickButton
            snap={row.original}
            fixtureId={fixtureId}
            alreadyInUserTicket={alreadyInUserTicket}
            onPlace={onPlace}
          />
        ),
    },
  ];
}

// ── main component ────────────────────────────────────────────────────────────

export function FixtureDiagnostics({ row }: { row: FixtureRow }) {
  const mr = row.modelRun;
  const score = formatScore(row.score, row.htScore);
  const { draft, addItem, open } = useBetSlip();

  function handlePlacePick(snap: FixtureEvaluatedPickSnapshot) {
    if (!mr) return;
    const shouldOpen = draft.items.length === 0;

    const sv = row.safeValueBet;
    const matchesSv =
      sv?.market === snap.market &&
      sv?.pick === snap.pick &&
      (sv?.comboMarket ?? null) === (snap.comboMarket ?? null) &&
      (sv?.comboPick ?? null) === (snap.comboPick ?? null);

    const base = {
      fixtureId: row.fixtureId,
      fixture: row.fixture,
      homeLogo: row.homeLogo,
      awayLogo: row.awayLogo,
      competition: row.competition,
      scheduledAt: row.scheduledAt,
      market: snap.market,
      pick: snap.pick,
      odds: snap.odds,
      comboMarket: snap.comboMarket,
      comboPick: snap.comboPick,
      ev: snap.ev,
      stakeOverride: null,
    };

    const item: BetSlipDraftItem =
      matchesSv && sv
        ? { ...base, betId: sv.betId }
        : { ...base, modelRunId: mr.modelRunId };

    addItem(item);
    if (shouldOpen) open();
  }

  if (!mr) {
    return (
      <div className="rounded-[1.7rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
        <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
          <EmptyHeader>
            <EmptyTitle>Aucun diagnostic</EmptyTitle>
            <EmptyDescription>
              Pas de ModelRun disponible pour cette fixture.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const alreadyInUserTicket = false;
  const marketsColumns = makeMarketsColumns(
    row.fixtureId,
    alreadyInUserTicket,
    handlePlacePick,
    row.status,
  );

  const hasFactors =
    mr.factors && Object.values(mr.factors).some((v) => v !== null);

  const viableCount = mr.evaluatedPicks.filter((p) => p.status === "viable").length;
  const totalCount = mr.evaluatedPicks.length;

  return (
    <div className="rounded-[1.35rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-base font-semibold leading-tight text-foreground sm:text-lg">
            {row.fixture}
          </p>
          {score && (
            <p className="mt-1 text-sm font-medium text-foreground">{score}</p>
          )}
        </div>
        <Badge variant={fixtureStatusTone(row.status)} className="shrink-0">
          {fixtureStatusLabel(row.status)}
        </Badge>
      </div>

      {/* Pick retenu */}
      {mr.decision === "BET" && mr.market && mr.pick && (
        <div className="mt-4 flex items-center gap-3 rounded-[1rem] border border-border bg-panel p-3">
          <CanalBadge canal="EV" />
          <span className="flex-1 text-sm font-semibold text-foreground">
            {formatCombinedPickForDisplay({
              market: mr.market,
              pick: mr.pick,
              comboMarket: mr.comboMarket ?? undefined,
              comboPick: mr.comboPick ?? undefined,
            })}
          </span>
          {mr.ev && (
            <span
              className="tabular-nums text-sm font-bold"
              style={{ color: "var(--canal-ev)" }}
            >
              {mr.ev}
            </span>
          )}
          {mr.probEstimated && (
            <span className="text-xs text-muted-foreground">
              {mr.probEstimated}
            </span>
          )}
        </div>
      )}

      {mr.decision === "NO_BET" && (
        <div className="mt-4 rounded-[1rem] border border-dashed border-border bg-panel/60 px-3 py-2.5 text-sm text-muted-foreground">
          Aucun marché ne répond aux critères — décision{" "}
          <span className="font-semibold text-foreground">NO_BET</span>
        </div>
      )}

      {/* Pourquoi ce pick ? */}
      {hasFactors && mr.factors && (
        <div className="mt-5">
          <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Pourquoi ce pick ?
          </p>
          <div className="flex flex-col gap-2">
            {FACTOR_DEFS.map((f) => (
              <FactorBar
                key={f.key}
                label={f.label}
                value={mr.factors![f.key]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Prédiction modèle */}
      <div className="mt-5">
        <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Prédiction modèle
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard compact tone="neutral" label="Prob. estimée" value={mr.probEstimated ?? "—"} />
          <StatCard
            compact
            tone={mr.ev && parseFloat(mr.ev) >= 0 ? "success" : "danger"}
            label="Valeur (EV)"
            value={mr.ev ? formatEv(mr.ev) : "—"}
          />
          {(mr.lambdaHome !== null || mr.lambdaAway !== null) ? (
            <div className="col-span-2 flex items-center rounded-[1.15rem] border border-border bg-panel-strong px-3 py-2.5">
              <p className="text-[0.72rem] leading-snug text-muted-foreground">
                Le modèle prédit{" "}
                <span className="font-semibold text-foreground">
                  ~{mr.lambdaHome ?? "?"} buts
                </span>{" "}
                dom. ·{" "}
                <span className="font-semibold text-foreground">
                  ~{mr.lambdaAway ?? "?"} buts
                </span>{" "}
                ext.
                {mr.expectedTotalGoals && (
                  <>
                    {" "}→{" "}
                    <span className="font-semibold text-foreground">
                      {mr.expectedTotalGoals} attendus
                    </span>
                  </>
                )}
              </p>
            </div>
          ) : (
            <>
              <StatCard compact tone="neutral" label="λ Dom." value={mr.lambdaHome ?? "—"} />
              <StatCard compact tone="neutral" label="λ Ext." value={mr.lambdaAway ?? "—"} />
            </>
          )}
        </div>
      </div>

      {/* Marchés analysés */}
      {mr.evaluatedPicks.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-baseline gap-2">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Marchés analysés
            </p>
            <span className="text-[0.72rem] text-muted-foreground">
              {totalCount} marché{totalCount > 1 ? "s" : ""} ·{" "}
              <span className="text-success font-medium">{viableCount} viable{viableCount > 1 ? "s" : ""}</span>
              {totalCount - viableCount > 0 && (
                <> · <span className="text-danger font-medium">{totalCount - viableCount} écarté{totalCount - viableCount > 1 ? "s" : ""}</span></>
              )}
            </span>
          </div>
          <DataTable columns={marketsColumns} data={mr.evaluatedPicks} />
        </div>
      )}
    </div>
  );
}
