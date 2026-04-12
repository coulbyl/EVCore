"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { ShoppingCart, Check, ChevronRight } from "lucide-react";
import { SettleFixtureDialog } from "@/components/settle-fixture-dialog";
import { formatScore, formatKickoff } from "@/domains/fixture/helpers/fixture";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import type { FixtureRow } from "@/domains/fixture/types/fixture";
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
  const { addItem, removeItem, isInSlip, open } = useBetSlip();
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
  const { market, pick, ev } = mr;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (inSlip) {
      removeItem(betId);
    } else {
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
      open();
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
            : "border-slate-200 bg-white text-slate-600 hover:border-accent hover:text-accent"
        }`}
      >
        {inSlip ? <Check size={15} /> : <ShoppingCart size={15} />}
        {inSlip ? "Dans le panier" : "Ajouter au panier"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={inSlip ? "Retirer du panier" : "Ajouter au panier"}
      className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border transition-colors ${
        inSlip
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-400 hover:border-accent hover:text-accent"
      }`}
    >
      {inSlip ? <Check size={15} /> : <ShoppingCart size={15} />}
    </button>
  );
}

function ResultAction({ row }: { row: FixtureRow }) {
  const isBet = row.modelRun?.decision === "BET";
  const settled =
    row.modelRun?.betStatus === "WON" || row.modelRun?.betStatus === "LOST";
  if (!isBet || settled) return null;

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
  selected,
  onSelect,
}: {
  row: FixtureRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const mr = row.modelRun;
  const score = formatScore(row.score, row.htScore);
  const isFinished = row.status === "FINISHED";

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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <FixtureTeamLogos
                homeLogo={row.homeLogo}
                awayLogo={row.awayLogo}
              />
              <p className="truncate text-sm font-semibold text-slate-900">
                {row.fixture}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {row.competition} · {formatKickoff(row.scheduledAt)}
              {isFinished && score ? ` · ${score}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <DecisionBadge decision={mr?.decision ?? null} />
            <ChevronRight size={15} className="text-slate-300" />
          </div>
        </div>

        {mr?.decision === "BET" && (
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">
                  Sélection
                </p>
                <p className="truncate text-sm font-bold text-white">
                  {mr.pick ?? "—"}
                  {mr.market ? ` · ${mr.market}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">
                  EV
                </p>
                <p className="text-sm font-bold text-emerald-400">
                  {mr.ev ?? "—"}
                </p>
              </div>
              {mr.betStatus && mr.betStatus !== "PENDING" && (
                <BetResultBadge status={mr.betStatus} />
              )}
            </div>
          </div>
        )}
      </button>

      {mr?.decision === "BET" && (
        <div className="mt-2 flex gap-2">
          <ResultAction row={row} />
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
  selected,
  onSelect,
}: {
  row: FixtureRow;
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
        <DecisionBadge decision={mr?.decision ?? null} />
      </td>
      {/* Pick */}
      <td className="px-4 py-3 text-sm text-slate-700">
        {mr?.pick ?? <span className="text-slate-400">—</span>}
      </td>
      {/* Cote */}
      <td className="px-4 py-3 text-sm tabular-nums font-medium text-slate-700">
        —
      </td>
      {/* EV */}
      <td className="px-4 py-3 text-sm tabular-nums font-semibold">
        {mr?.ev ? (
          <span className="text-emerald-600">{mr.ev}</span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      {/* Résultat */}
      <td className="px-4 py-3">
        <BetResultBadge status={mr?.betStatus ?? null} />
      </td>
      {/* Actions */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-2">
          <ResultAction row={row} />
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
}: {
  rows: FixtureRow[];
  total: number;
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
    <>
      <div className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <FixtureMobileCard
            key={row.fixtureId}
            row={row}
            selected={selectedId === row.fixtureId}
            onSelect={() => handleSelect(row)}
          />
        ))}
        <p className="pt-1 text-center text-xs text-slate-400">
          {rows.length} / {total} fixture{total > 1 ? "s" : ""}
        </p>
      </div>

      <div className="hidden overflow-hidden rounded-[1.3rem] border border-border lg:block">
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
                  className="px-4 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500"
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
    </>
  );
}
