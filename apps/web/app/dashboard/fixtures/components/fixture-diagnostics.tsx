"use client";

import { Check, ShoppingCart } from "lucide-react";
import {
  Badge,
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  ResponsiveGrid,
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
  FixturePickSnapshot,
  FixtureRow,
} from "@/domains/fixture/types/fixture";

type BadgeVariant =
  | "accent"
  | "success"
  | "warning"
  | "destructive"
  | "neutral";

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
  under_high_lambda: "Nbre de but élevé",
};

function rejectionReasonLabel(reason?: string): string {
  if (!reason) return "--";
  return REJECTION_LABELS[reason] ?? reason;
}

const CANDIDATE_COLUMNS: ColumnDef<FixturePickSnapshot>[] = [
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
    header: "Prob. %",
    accessorFn: (row) => `${(Number(row.probability) * 100).toFixed(2)}`,
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
    id: "quality",
    header: "Qualité",
    cell: ({ row }) => {
      const v = parseFloat(row.original.qualityScore);
      return (
        <span
          className={`tabular-nums font-semibold ${v >= 0 ? "text-success" : "text-danger"}`}
        >
          {row.original.qualityScore}
        </span>
      );
    },
    meta: { align: "right" },
  },
];

function makeEvaluatedColumns(
  fixtureId: string,
  alreadyInUserTicket: boolean,
  onPlace: (snap: FixtureEvaluatedPickSnapshot) => void,
): ColumnDef<FixtureEvaluatedPickSnapshot>[] {
  return [
    ...(CANDIDATE_COLUMNS as unknown as ColumnDef<FixtureEvaluatedPickSnapshot>[]),
    {
      id: "status",
      header: "Statut",
      cell: ({ row }) =>
        row.original.status === "viable" ? (
          <Badge variant="success">Viable</Badge>
        ) : (
          <Badge variant="destructive">Rejeté</Badge>
        ),
    },
    {
      id: "reason",
      header: "Raison",
      cell: ({ row }) => (
        <span className="text-[0.82rem] text-muted-foreground">
          {rejectionReasonLabel(row.original.rejectionReason)}
        </span>
      ),
    },
    {
      id: "action",
      header: "",
      cell: ({ row }) => (
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

export function FixtureDiagnostics({ row }: { row: FixtureRow }) {
  const mr = row.modelRun;
  const score = formatScore(row.score, row.htScore);
  const { draft, addItem, open } = useBetSlip();

  function handlePlacePick(snap: FixtureEvaluatedPickSnapshot) {
    if (!mr) return;
    const shouldOpen = draft.items.length === 0;

    // If the chosen pick matches the SV bet, reuse its betId so the slip
    // item inherits isSafeValue=true and shows the SV canal badge.
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
  const evaluatedColumns = makeEvaluatedColumns(
    row.fixtureId,
    alreadyInUserTicket,
    handlePlacePick,
  );

  return (
    <div className="rounded-[1.35rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-base font-semibold leading-tight text-foreground sm:text-lg">
            {row.fixture}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {mr.pick && mr.market ? (
              <span className="font-medium text-foreground">
                {formatCombinedPickForDisplay({
                  market: mr.market,
                  pick: mr.pick,
                })}
              </span>
            ) : (
              "Sélection non disponible"
            )}
            {score && (
              <>
                {" · "}
                <span className="font-medium text-foreground">{score}</span>
              </>
            )}
          </p>
        </div>
        <Badge variant={fixtureStatusTone(row.status)} className="shrink-0">
          {fixtureStatusLabel(row.status)}
        </Badge>
      </div>

      <div className="mt-5">
        <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Entrées modèle
        </p>
        <ResponsiveGrid cols={{ base: 2, sm: 4 }} gap="sm">
          <StatCard
            compact
            tone="neutral"
            label="Prob. estimée"
            value={mr.probEstimated ?? "—"}
          />
          <StatCard
            compact
            tone="neutral"
            label="λ Dom."
            value={mr.lambdaHome ?? "—"}
          />
          <StatCard
            compact
            tone="neutral"
            label="λ Ext."
            value={mr.lambdaAway ?? "—"}
          />
          <StatCard
            compact
            tone="neutral"
            label="Buts attendus"
            value={mr.expectedTotalGoals ?? "—"}
          />
        </ResponsiveGrid>
      </div>

      {mr.candidatePicks.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Sélections candidates ({mr.candidatePicks.length})
          </p>
          <DataTable columns={CANDIDATE_COLUMNS} data={mr.candidatePicks} />
        </div>
      )}

      {mr.evaluatedPicks.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Sélections évaluées ({mr.evaluatedPicks.length})
          </p>
          <DataTable columns={evaluatedColumns} data={mr.evaluatedPicks} />
        </div>
      )}
    </div>
  );
}
