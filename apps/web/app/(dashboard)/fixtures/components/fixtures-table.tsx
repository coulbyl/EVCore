"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { FixtureDetailPanel } from "@/components/fixture-detail-panel";
import { formatScore, formatKickoff, toFixturePanel } from "@/domains/fixture/helpers/fixture";
import { useIsMobile } from "@/hooks/use-mobile";
import type { FixtureRow } from "@/domains/fixture/types/fixture";

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

function BetResultBadge({ status }: { status: "WON" | "LOST" | "PENDING" | null }) {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  if (status === "PENDING") return <span className="text-xs text-slate-400">En attente</span>;
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
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[1.2rem] border p-4 text-left transition-colors ${
        selected
          ? "border-accent bg-accent/5"
          : "border-border bg-panel-strong hover:bg-slate-50"
      }`}
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
        <DecisionBadge decision={mr?.decision ?? null} />
      </div>

      {mr?.decision === "BET" && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">
              Sélection
            </p>
            <p className="truncate text-sm font-bold text-white">
              {mr.pick ?? "—"}{mr.market ? ` · ${mr.market}` : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">EV</p>
            <p className="text-sm font-bold text-emerald-400">{mr.ev ?? "—"}</p>
          </div>
          {mr.betStatus && mr.betStatus !== "PENDING" && (
            <BetResultBadge status={mr.betStatus} />
          )}
        </div>
      )}
    </button>
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

export function FixturesTable({ rows }: { rows: FixtureRow[] }) {
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedRow = rows.find((r) => r.fixtureId === selectedId) ?? null;
  const fixturePanel = selectedRow ? toFixturePanel(selectedRow) : null;

  function handleSelect(row: FixtureRow) {
    setSelectedId(row.fixtureId);
    if (isMobile) setDrawerOpen(true);
  }

  if (rows.length === 0) return <EmptyState />;

  return (
    <>
      {/* Mobile : cards */}
      {isMobile ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <FixtureMobileCard
              key={row.fixtureId}
              row={row}
              selected={selectedId === row.fixtureId}
              onSelect={() => handleSelect(row)}
            />
          ))}

          {/* Drawer mobile */}
          <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
              <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[1.6rem] bg-white focus:outline-none">
                <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-slate-300" />
                <div className="overflow-y-auto p-4 pb-10">
                  {fixturePanel && (
                    <FixtureDetailPanel fixture={fixturePanel} />
                  )}
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </div>
      ) : (
        /* Desktop : table + side panel */
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          <div className="overflow-hidden rounded-[1.3rem] border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-slate-50/80">
                  {["Match", "Score", "Compétition", "Heure", "Décision", "Pick", "Cote", "EV", "Résultat"].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500"
                      >
                        {col}
                      </th>
                    ),
                  )}
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
            </table>
          </div>

          {/* Side panel */}
          <div className="hidden xl:block">
            {fixturePanel ? (
              <FixtureDetailPanel fixture={fixturePanel} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-[1.7rem] border border-border bg-panel-strong p-6 text-center">
                <p className="text-sm text-slate-400">
                  Sélectionnez un match pour voir le détail.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
