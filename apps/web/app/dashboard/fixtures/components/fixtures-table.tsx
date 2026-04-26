"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { ShoppingCart, Check, ChevronRight } from "lucide-react";
import { DataTable, type ColumnDef } from "@evcore/ui";
import { SettleFixtureDialog } from "@/components/settle-fixture-dialog";
import { formatScore, formatKickoff } from "@/domains/fixture/helpers/fixture";
import {
  fixtureStatusBadgeClass,
  fixtureStatusLabel,
  formatCombinedPickForDisplay,
} from "@/helpers/fixture";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import type {
  FixtureRow,
  FixtureSvBet,
  FixturePrediction,
} from "@/domains/fixture/types/fixture";
import type { BetSlipDraftItem } from "@/domains/bet-slip/types/bet-slip";
import { FixtureDiagnostics } from "./fixture-diagnostics";

// ---------------------------------------------------------------------------
// Cell badge helpers
// ---------------------------------------------------------------------------

function DecisionBadge({ decision }: { decision: "BET" | "NO_BET" | null }) {
  if (!decision) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-widest ${
        decision === "BET"
          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border border-border bg-secondary text-muted-foreground"
      }`}
    >
      {decision === "BET" ? "BET" : "NO BET"}
    </span>
  );
}

const PICK_LABEL: Record<string, string> = { HOME: "DOM", AWAY: "EXT", DRAW: "NUL" };

function PredictionBadge({ pred }: { pred: FixturePrediction }) {
  const label = PICK_LABEL[pred.pick] ?? pred.pick;
  const cls =
    pred.correct === true
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : pred.correct === false
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-indigo-200 bg-indigo-50 text-indigo-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums ${cls}`}>
      → {label} {pred.probability}
    </span>
  );
}

function SVBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-widest text-sky-600">
      Safe
    </span>
  );
}

function SVRow({ sv }: { sv: FixtureSvBet }) {
  const pickLabel = formatCombinedPickForDisplay({
    market: sv.market, pick: sv.pick,
    comboMarket: sv.comboMarket ?? undefined,
    comboPick: sv.comboPick ?? undefined,
  });
  return (
    <div className="flex items-center gap-2 text-xs">
      <SVBadge />
      <span className="text-muted-foreground">{pickLabel}</span>
      <span className="font-semibold text-sky-600">{sv.ev}</span>
      {sv.betStatus && sv.betStatus !== "PENDING" && <BetResultBadge status={sv.betStatus} />}
    </div>
  );
}

function BetResultBadge({ status }: { status: "WON" | "LOST" | "PENDING" | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  if (status === "PENDING") return <span className="text-xs text-muted-foreground">En attente</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-widest ${
      status === "WON"
        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border border-rose-200 bg-rose-50 text-rose-700"
    }`}>
      {status === "WON" ? "Gagné" : "Perdu"}
    </span>
  );
}

function FixtureTeamLogos({ homeLogo, awayLogo }: { homeLogo: string | null; awayLogo: string | null }) {
  return (
    <div className="flex items-center gap-1">
      {homeLogo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={homeLogo} alt="" className="size-5 object-contain" />
        : <div className="size-5 rounded-full bg-secondary" />}
      {awayLogo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={awayLogo} alt="" className="size-5 object-contain" />
        : <div className="size-5 rounded-full bg-secondary" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add to slip button
// ---------------------------------------------------------------------------

function AddToSlipButton({ row, variant = "icon" }: { row: FixtureRow; variant?: "icon" | "full" }) {
  const { draft, addItem, removeItem, isInSlip, open } = useBetSlip();
  const mr = row.modelRun;

  if (!mr || mr.decision !== "BET" || !mr.betId || !mr.market || !mr.pick || row.status === "FINISHED") {
    return null;
  }

  const betId = mr.betId;
  const { market, pick, ev, evaluatedPicks, comboMarket, comboPick } = mr;
  const inSlip = isInSlip(betId);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (inSlip) {
      removeItem(betId);
    } else {
      const shouldOpenCoupon = draft.items.length === 0;
      const odds = evaluatedPicks.find(
        (p) => p.market === market && p.pick === pick &&
          (p.comboMarket ?? null) === (comboMarket ?? null) &&
          (p.comboPick ?? null) === (comboPick ?? null),
      )?.odds ?? null;
      const item: BetSlipDraftItem = {
        betId, fixtureId: row.fixtureId, fixture: row.fixture,
        homeLogo: row.homeLogo, awayLogo: row.awayLogo,
        competition: row.competition, scheduledAt: row.scheduledAt,
        market, pick, odds, ev, stakeOverride: null,
      };
      addItem(item);
      if (shouldOpenCoupon) open();
    }
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors ${
          inSlip
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-border bg-panel-strong text-foreground hover:border-accent hover:text-accent"
        }`}
      >
        {inSlip ? <Check size={15} /> : <ShoppingCart size={15} />}
        {inSlip ? "Déjà dans le coupon" : "Placer"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={inSlip ? "Retirer du coupon" : "Placer"}
      className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border transition-colors ${
        inSlip
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-border bg-panel-strong text-muted-foreground hover:border-accent hover:text-accent"
      }`}
    >
      {inSlip ? <Check size={15} /> : <ShoppingCart size={15} />}
    </button>
  );
}

function ResultAction({ row, isAdmin }: { row: FixtureRow; isAdmin: boolean }) {
  const isBet = row.modelRun?.decision === "BET";
  const settled = row.modelRun?.betStatus === "WON" || row.modelRun?.betStatus === "LOST";
  if (!isAdmin || !isBet || settled) return null;
  return <SettleFixtureDialog fixtureId={row.fixtureId} fixtureName={row.fixture} triggerSize="xs" />;
}

// ---------------------------------------------------------------------------
// Mobile card
// ---------------------------------------------------------------------------

function FixtureMobileCard({
  row, isAdmin, selected, onSelect,
}: { row: FixtureRow; isAdmin: boolean; selected: boolean; onSelect: () => void }) {
  const mr = row.modelRun;
  const score = formatScore(row.score, row.htScore);
  const pickLabel = mr?.market && mr?.pick
    ? formatCombinedPickForDisplay({ market: mr.market, pick: mr.pick, comboMarket: mr.comboMarket ?? undefined, comboPick: mr.comboPick ?? undefined })
    : null;

  return (
    <div className={`rounded-[1.2rem] border p-4 transition-colors ${selected ? "border-accent bg-accent/5" : "border-border bg-panel-strong"}`}>
      <button type="button" onClick={onSelect} className="w-full cursor-pointer text-left">
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <FixtureTeamLogos homeLogo={row.homeLogo} awayLogo={row.awayLogo} />
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">{row.fixture}</p>
            </div>
            <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${fixtureStatusBadgeClass(row.status)}`}>
              {fixtureStatusLabel(row.status)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {pickLabel
              ? <span className="font-medium text-foreground">{pickLabel}</span>
              : <span className="text-muted-foreground">Sans sélection</span>}
            {score && <><span className="text-border">·</span><span className="font-semibold tabular-nums text-muted-foreground">{score}</span></>}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{row.competition}</span>
              <span className="mx-1.5">·</span>
              {formatKickoff(row.scheduledAt)}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {mr?.decision === "BET" && mr.ev && <span className="text-sm font-bold text-emerald-600">{mr.ev}</span>}
              {row.prediction && <PredictionBadge pred={row.prediction} />}
              <DecisionBadge decision={mr?.decision ?? null} />
              <ChevronRight size={14} className="text-muted-foreground" />
            </div>
          </div>

          {mr?.decision === "BET" && mr.betStatus && mr.betStatus !== "PENDING" && (
            <div className="flex items-center gap-2"><BetResultBadge status={mr.betStatus} /></div>
          )}
          {row.safeValueBet && <SVRow sv={row.safeValueBet} />}
        </div>
      </button>

      {mr?.decision === "BET" && (
        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <ResultAction row={row} isAdmin={isAdmin} />
          <AddToSlipButton row={row} variant="full" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function makeColumns(isAdmin: boolean): ColumnDef<FixtureRow>[] {
  return [
    {
      id: "fixture",
      header: "Match",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <FixtureTeamLogos homeLogo={row.original.homeLogo} awayLogo={row.original.awayLogo} />
          <span className="text-sm font-semibold text-foreground">{row.original.fixture}</span>
        </div>
      ),
    },
    {
      id: "score",
      header: "Score",
      cell: ({ row }) => {
        const score = formatScore(row.original.score, row.original.htScore);
        return <span className="font-mono text-sm text-foreground">{score ?? <span className="text-muted-foreground">—</span>}</span>;
      },
    },
    {
      id: "competition",
      header: "Compétition",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.competition}</span>,
    },
    {
      id: "scheduledAt",
      header: "Heure",
      cell: ({ row }) => <span className="tabular-nums text-sm text-foreground">{formatKickoff(row.original.scheduledAt)}</span>,
    },
    {
      id: "decision",
      header: "Décision",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <DecisionBadge decision={row.original.modelRun?.decision ?? null} />
          {row.original.prediction && <PredictionBadge pred={row.original.prediction} />}
        </div>
      ),
    },
    {
      id: "pick",
      header: "Pick",
      cell: ({ row }) => {
        const mr = row.original.modelRun;
        return (
          <div className="space-y-1 text-sm text-foreground">
            {mr?.market && mr?.pick ? (
              <div>{formatCombinedPickForDisplay({ market: mr.market, pick: mr.pick, comboMarket: mr.comboMarket ?? undefined, comboPick: mr.comboPick ?? undefined })}</div>
            ) : <span className="text-muted-foreground">—</span>}
            {row.original.safeValueBet && (
              <div className="flex items-center gap-1.5">
                <SVBadge />
                <span className="text-xs text-muted-foreground">
                  {formatCombinedPickForDisplay({ market: row.original.safeValueBet.market, pick: row.original.safeValueBet.pick, comboMarket: row.original.safeValueBet.comboMarket ?? undefined, comboPick: row.original.safeValueBet.comboPick ?? undefined })}
                </span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "odds",
      header: "Cote",
      cell: ({ row }) => {
        const mr = row.original.modelRun;
        const odds = mr?.market && mr?.pick
          ? (mr.evaluatedPicks.find((p) => p.market === mr.market && p.pick === mr.pick)?.odds ?? null)
          : null;
        return <span className="tabular-nums text-sm font-medium text-foreground">{odds ?? <span className="text-muted-foreground">—</span>}</span>;
      },
    },
    {
      id: "ev",
      header: "EV",
      cell: ({ row }) => {
        const mr = row.original.modelRun;
        return (
          <div className="space-y-1 tabular-nums text-sm font-semibold">
            {mr?.ev ? <div className="text-emerald-600">{mr.ev}</div> : <span className="text-muted-foreground">—</span>}
            {row.original.safeValueBet && <div className="text-sky-600">{row.original.safeValueBet.ev}</div>}
          </div>
        );
      },
    },
    {
      id: "result",
      header: "Résultat",
      cell: ({ row }) => {
        const mr = row.original.modelRun;
        return (
          <div className="space-y-1">
            <BetResultBadge status={mr?.betStatus ?? null} />
            {row.original.safeValueBet?.betStatus && row.original.safeValueBet.betStatus !== "PENDING" && (
              <BetResultBadge status={row.original.safeValueBet.betStatus} />
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {isAdmin && <ResultAction row={row.original} isAdmin={isAdmin} />}
          <AddToSlipButton row={row.original} />
        </div>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FixturesTable({
  rows,
  total,
  isAdmin,
}: {
  rows: FixtureRow[];
  total: number;
  isAdmin: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedRow = rows.find((r) => r.fixtureId === selectedId) ?? null;
  const columns = makeColumns(isAdmin);

  function handleRowClick(row: FixtureRow) {
    setSelectedId(row.fixtureId);
    setDrawerOpen(true);
  }

  return (
    <div className="h-full lg:flex lg:min-h-0 lg:flex-col">
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={handleRowClick}
        emptyState={
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-2xl">🎯</p>
            <p className="font-semibold text-foreground">Aucun match trouvé</p>
            <p className="text-sm text-muted-foreground">Ajustez les filtres ou changez de date.</p>
          </div>
        }
        mobileCard={(row) => (
          <FixtureMobileCard
            key={row.fixtureId}
            row={row}
            isAdmin={isAdmin}
            selected={selectedId === row.fixtureId}
            onSelect={() => handleRowClick(row)}
          />
        )}
        className="lg:flex-1 lg:overflow-y-auto"
      />

      {rows.length > 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground sm:hidden">
          {rows.length} / {total} fixture{total > 1 ? "s" : ""}
        </p>
      )}

      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px]" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[1.6rem] bg-panel-strong focus:outline-none sm:inset-y-3 sm:right-3 sm:left-auto sm:w-[min(760px,calc(100vw-1.5rem))] sm:max-h-none sm:rounded-[1.6rem] sm:border sm:border-border sm:shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <Drawer.Title className="sr-only">Diagnostic fixture</Drawer.Title>
            <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />
            <div className="overflow-y-auto p-4 pb-10 sm:p-5">
              {selectedRow ? (
                <FixtureDiagnostics row={selectedRow} />
              ) : (
                <div className="flex min-h-80 items-center justify-center rounded-[1.7rem] border border-border bg-panel p-6 text-center">
                  <p className="text-sm text-muted-foreground">Sélectionnez un match pour voir le diagnostic.</p>
                </div>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
