"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { ShoppingCart, Check, ChevronRight } from "lucide-react";
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
// Helpers
// ---------------------------------------------------------------------------

function DecisionBadge({ decision }: { decision: "BET" | "NO_BET" | null }) {
  if (!decision) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-widest ${
        decision === "BET"
          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      {decision === "BET" ? "BET" : "NO BET"}
    </span>
  );
}

const PICK_LABEL: Record<string, string> = {
  HOME: "DOM",
  AWAY: "EXT",
  DRAW: "NUL",
};

function PredictionBadge({ pred }: { pred: FixturePrediction }) {
  const label = PICK_LABEL[pred.pick] ?? pred.pick;
  const resultClass =
    pred.correct === true
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : pred.correct === false
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-indigo-200 bg-indigo-50 text-indigo-600";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums ${resultClass}`}
    >
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
    market: sv.market,
    pick: sv.pick,
    comboMarket: sv.comboMarket ?? undefined,
    comboPick: sv.comboPick ?? undefined,
  });
  return (
    <div className="flex items-center gap-2 text-xs">
      <SVBadge />
      <span className="text-slate-600">{pickLabel}</span>
      <span className="font-semibold text-sky-600">{sv.ev}</span>
      {sv.betStatus && sv.betStatus !== "PENDING" ? (
        <BetResultBadge status={sv.betStatus} />
      ) : null}
    </div>
  );
}

function BetResultBadge({
  status,
}: {
  status: "WON" | "LOST" | "PENDING" | null;
}) {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  if (status === "PENDING")
    return <span className="text-xs text-slate-400">En attente</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-widest ${
        status === "WON"
          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {status === "WON" ? "Gagné" : "Perdu"}
    </span>
  );
}

function FixtureTeamLogos({
  homeLogo,
  awayLogo,
}: {
  homeLogo: string | null;
  awayLogo: string | null;
}) {
  return (
    <div className="flex items-center gap-1">
      {homeLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={homeLogo} alt="" className="size-5 object-contain" />
      ) : (
        <div className="size-5 rounded-full bg-slate-200" />
      )}
      {awayLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={awayLogo} alt="" className="size-5 object-contain" />
      ) : (
        <div className="size-5 rounded-full bg-slate-200" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add to slip button
// ---------------------------------------------------------------------------

function AddToSlipButton({
  row,
  variant = "icon",
}: {
  row: FixtureRow;
  variant?: "icon" | "full";
}) {
  const { draft, addItem, removeItem, isInSlip, open } = useBetSlip();
  const mr = row.modelRun;

  if (
    !mr ||
    mr.decision !== "BET" ||
    !mr.betId ||
    !mr.market ||
    !mr.pick ||
    row.status === "FINISHED"
  ) {
    return null;
  }

  const betId = mr.betId;
  const inSlip = isInSlip(betId);
  const alreadyInUserTicket = row.alreadyInUserTicket;
  const { market, pick, ev } = mr;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (inSlip) {
      removeItem(betId);
    } else if (alreadyInUserTicket) {
      return;
    } else {
      const shouldOpenTicket = draft.items.length === 0;
      const item: BetSlipDraftItem = {
        betId,
        fixtureId: row.fixtureId,
        fixture: row.fixture,
        homeLogo: row.homeLogo,
        awayLogo: row.awayLogo,
        competition: row.competition,
        scheduledAt: row.scheduledAt,
        market,
        pick,
        ev,
        stakeOverride: null,
      };
      addItem(item);
      if (shouldOpenTicket) {
        open();
      }
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
            : alreadyInUserTicket
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : "border-slate-200 bg-white text-slate-600 hover:border-accent hover:text-accent"
        }`}
        disabled={alreadyInUserTicket && !inSlip}
      >
        {inSlip ? <Check size={15} /> : <ShoppingCart size={15} />}
        {inSlip
          ? "Déjà dans le ticket"
          : alreadyInUserTicket
            ? "Déjà dans vos tickets"
            : "Placer"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        inSlip
          ? "Retirer du ticket"
          : alreadyInUserTicket
            ? "Déjà dans vos tickets"
            : "Placer"
      }
      className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border transition-colors ${
        inSlip
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : alreadyInUserTicket
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300"
            : "border-slate-200 bg-white text-slate-400 hover:border-accent hover:text-accent"
      }`}
      disabled={alreadyInUserTicket && !inSlip}
    >
      {inSlip ? <Check size={15} /> : <ShoppingCart size={15} />}
    </button>
  );
}

function ResultAction({ row, isAdmin }: { row: FixtureRow; isAdmin: boolean }) {
  const isBet = row.modelRun?.decision === "BET";
  const settled =
    row.modelRun?.betStatus === "WON" || row.modelRun?.betStatus === "LOST";
  if (!isAdmin || !isBet || settled) return null;

  return (
    <SettleFixtureDialog
      fixtureId={row.fixtureId}
      fixtureName={row.fixture}
      triggerSize="xs"
    />
  );
}

// ---------------------------------------------------------------------------
// Mobile card
// ---------------------------------------------------------------------------

function FixtureMobileCard({
  row,
  isAdmin,
  selected,
  onSelect,
}: {
  row: FixtureRow;
  isAdmin: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const mr = row.modelRun;
  const score = formatScore(row.score, row.htScore);
  const pickLabel =
    mr?.market && mr?.pick
      ? formatCombinedPickForDisplay({
          market: mr.market,
          pick: mr.pick,
          comboMarket: mr.comboMarket ?? undefined,
          comboPick: mr.comboPick ?? undefined,
        })
      : null;

  return (
    <div
      className={`rounded-[1.2rem] border p-4 transition-colors ${
        selected ? "border-accent bg-accent/5" : "border-border bg-panel-strong"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full cursor-pointer text-left"
      >
        <div className="space-y-2.5">
          {/* Row 1 : logos + fixture name + status badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <FixtureTeamLogos
                homeLogo={row.homeLogo}
                awayLogo={row.awayLogo}
              />
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
                {row.fixture}
              </p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${fixtureStatusBadgeClass(row.status)}`}
            >
              {fixtureStatusLabel(row.status)}
            </span>
          </div>

          {/* Row 2 : pick + score */}
          <div className="flex items-center gap-2 text-sm">
            {pickLabel ? (
              <span className="font-medium text-slate-700">{pickLabel}</span>
            ) : (
              <span className="text-slate-400">Sans sélection</span>
            )}
            {score ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-semibold tabular-nums text-slate-600">
                  {score}
                </span>
              </>
            ) : null}
          </div>

          {/* Row 3 : competition · heure · EV · décision · prédiction */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-400">
              <span className="font-medium text-slate-500">
                {row.competition}
              </span>
              <span className="mx-1.5">·</span>
              {formatKickoff(row.scheduledAt)}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {mr?.decision === "BET" && mr.ev ? (
                <span className="text-sm font-bold text-emerald-600">
                  {mr.ev}
                </span>
              ) : null}
              {row.prediction ? (
                <PredictionBadge pred={row.prediction} />
              ) : null}
              <DecisionBadge decision={mr?.decision ?? null} />
              <ChevronRight size={14} className="text-slate-300" />
            </div>
          </div>

          {/* Row 4 : résultat EV (si bet settled) */}
          {mr?.decision === "BET" &&
          mr.betStatus &&
          mr.betStatus !== "PENDING" ? (
            <div className="flex items-center gap-2">
              <BetResultBadge status={mr.betStatus} />
            </div>
          ) : null}

          {/* Row 5 : Safe Value bet (si présent) */}
          {row.safeValueBet ? <SVRow sv={row.safeValueBet} /> : null}
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
// Desktop table row
// ---------------------------------------------------------------------------

function FixtureTableRow({
  row,
  isAdmin,
  selected,
  onSelect,
}: {
  row: FixtureRow;
  isAdmin: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const mr = row.modelRun;
  const score = formatScore(row.score, row.htScore);

  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-border transition-colors last:border-0 ${
        selected ? "bg-accent/5" : "hover:bg-slate-50"
      }`}
    >
      {/* Match */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <FixtureTeamLogos homeLogo={row.homeLogo} awayLogo={row.awayLogo} />
          <span className="text-sm font-semibold text-slate-900">
            {row.fixture}
          </span>
        </div>
      </td>
      {/* Score */}
      <td className="px-4 py-3 text-sm font-mono text-slate-700">
        {score ?? <span className="text-slate-400">—</span>}
      </td>
      {/* Compétition */}
      <td className="px-4 py-3 text-xs text-slate-500">{row.competition}</td>
      {/* Heure */}
      <td className="px-4 py-3 text-sm tabular-nums text-slate-600">
        {formatKickoff(row.scheduledAt)}
      </td>
      {/* Décision */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <DecisionBadge decision={mr?.decision ?? null} />
          {row.prediction ? <PredictionBadge pred={row.prediction} /> : null}
        </div>
      </td>
      {/* Pick */}
      <td className="px-4 py-3 text-sm text-slate-700">
        <div className="space-y-1">
          {mr?.market && mr?.pick ? (
            <div>
              {formatCombinedPickForDisplay({
                market: mr.market,
                pick: mr.pick,
                comboMarket: mr.comboMarket ?? undefined,
                comboPick: mr.comboPick ?? undefined,
              })}
            </div>
          ) : (
            <span className="text-slate-400">—</span>
          )}
          {row.safeValueBet ? (
            <div className="flex items-center gap-1.5">
              <SVBadge />
              <span className="text-xs text-slate-600">
                {formatCombinedPickForDisplay({
                  market: row.safeValueBet.market,
                  pick: row.safeValueBet.pick,
                  comboMarket: row.safeValueBet.comboMarket ?? undefined,
                  comboPick: row.safeValueBet.comboPick ?? undefined,
                })}
              </span>
            </div>
          ) : null}
        </div>
      </td>
      {/* Cote */}
      <td className="px-4 py-3 text-sm tabular-nums font-medium text-slate-700">
        {mr?.market && mr?.pick
          ? (mr.evaluatedPicks.find(
              (p) => p.market === mr.market && p.pick === mr.pick,
            )?.odds ?? <span className="text-slate-400">—</span>)
          : <span className="text-slate-400">—</span>}
      </td>
      {/* EV */}
      <td className="px-4 py-3 text-sm tabular-nums font-semibold">
        <div className="space-y-1">
          {mr?.ev ? (
            <div className="text-emerald-600">{mr.ev}</div>
          ) : (
            <span className="text-slate-400">—</span>
          )}
          {row.safeValueBet ? (
            <div className="text-sky-600">{row.safeValueBet.ev}</div>
          ) : null}
        </div>
      </td>
      {/* Résultat */}
      <td className="px-4 py-3">
        <div className="space-y-1">
          <BetResultBadge status={mr?.betStatus ?? null} />
          {row.safeValueBet?.betStatus &&
          row.safeValueBet.betStatus !== "PENDING" ? (
            <BetResultBadge status={row.safeValueBet.betStatus} />
          ) : null}
        </div>
      </td>
      {/* Actions */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-2">
          <ResultAction row={row} isAdmin={isAdmin} />
          <AddToSlipButton row={row} />
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-2xl">🎯</p>
      <p className="font-semibold text-slate-700">Aucun match trouvé</p>
      <p className="text-sm text-slate-500">
        Ajustez les filtres ou changez de date.
      </p>
    </div>
  );
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

  function handleSelect(row: FixtureRow) {
    setSelectedId(row.fixtureId);
    setDrawerOpen(true);
  }

  if (rows.length === 0) return <EmptyState />;

  return (
    <div className="h-full lg:flex lg:min-h-0 lg:flex-col">
      <div className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <FixtureMobileCard
            key={row.fixtureId}
            row={row}
            isAdmin={isAdmin}
            selected={selectedId === row.fixtureId}
            onSelect={() => handleSelect(row)}
          />
        ))}
        <p className="pt-1 text-center text-xs text-slate-400">
          {rows.length} / {total} fixture{total > 1 ? "s" : ""}
        </p>
      </div>

      <div className="hidden min-h-0 flex-1 overflow-y-auto rounded-[1.3rem] border border-border lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-slate-50/80">
              {[
                "Match",
                "Score",
                "Compétition",
                "Heure",
                "Décision",
                "Pick",
                "Cote",
                "EV",
                "Résultat",
                "",
              ].map((col, i) => (
                <th
                  key={i}
                  className="sticky top-0 z-10 bg-slate-50/95 px-4 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500 backdrop-blur"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <FixtureTableRow
                key={row.fixtureId}
                row={row}
                isAdmin={isAdmin}
                selected={selectedId === row.fixtureId}
                onSelect={() => handleSelect(row)}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-slate-50/60">
              <td colSpan={10} className="px-4 py-2.5 text-xs text-slate-400">
                {rows.length} / {total} fixture{total > 1 ? "s" : ""}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px]" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[1.6rem] bg-[#fcfcfd] focus:outline-none sm:inset-y-3 sm:right-3 sm:left-auto sm:w-[min(760px,calc(100vw-1.5rem))] sm:max-h-none sm:rounded-[1.6rem] sm:border sm:border-border sm:shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <Drawer.Title className="sr-only">Diagnostic fixture</Drawer.Title>
            <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-slate-300 sm:hidden" />
            <div className="overflow-y-auto p-4 pb-10 sm:p-5">
              {selectedRow ? (
                <FixtureDiagnostics row={selectedRow} />
              ) : (
                <div className="flex min-h-80 items-center justify-center rounded-[1.7rem] border border-border bg-panel-strong p-6 text-center">
                  <p className="text-sm text-slate-400">
                    Sélectionnez un match pour voir le diagnostic.
                  </p>
                </div>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
