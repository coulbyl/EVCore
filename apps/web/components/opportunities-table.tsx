"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { TableCard } from "./table-card";
import { formatPickForDisplay, FixtureName } from "./coupon-detail";

import type { OpportunityRow } from "../types/dashboard";

function CopyFixtureId({ fixtureId }: { fixtureId: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    void navigator.clipboard.writeText(fixtureId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={fixtureId}
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.65rem] font-mono text-slate-400 hover:bg-slate-100 hover:text-slate-600"
    >
      <span>{fixtureId.slice(0, 8)}</span>
      {copied ? (
        <Check size={10} className="text-success" />
      ) : (
        <Copy size={10} />
      )}
    </button>
  );
}

function CopyPick({ row }: { row: OpportunityRow }) {
  const [copied, setCopied] = useState(false);
  const pick = formatPickForDisplay(row.pick, row.market);
  const text = `${row.fixture} · ${pick} · ${row.odds} · EV ${row.ev}`;

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={text}
      className="ml-1.5 inline-flex items-center rounded p-0.5 text-slate-300 hover:text-slate-500"
    >
      {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
    </button>
  );
}

export function OpportunitiesTable({
  rows,
  selectedId,
  onSelectAction,
}: {
  rows: OpportunityRow[];
  selectedId: string | null;
  onSelectAction: (row: OpportunityRow) => void;
}) {
  return (
    <TableCard
      title="Meilleures opportunités"
      subtitle="Candidats EV les plus élevés de la dernière fenêtre de scoring."
    >
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-slate-500">
          <tr>
            <th className="px-5 py-3.5 font-medium">Match</th>
            <th className="px-5 py-3.5 font-medium">Sélection</th>
            <th className="px-5 py-3.5 font-medium">Cote</th>
            <th className="px-5 py-3.5 font-medium">EV</th>
            <th className="px-5 py-3.5 font-medium">Qualité</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelectAction(row)}
              className={`cursor-pointer transition-colors ${selectedId === row.id ? "bg-accent/8 ring-1 ring-inset ring-accent/20" : "hover:bg-[#f5f7fb]"}`}
            >
              <td className="px-5 py-4.5">
                <FixtureName
                  fixture={row.fixture}
                  homeLogo={row.homeLogo}
                  awayLogo={row.awayLogo}
                />
                <div className="mt-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <span>
                    {row.competition} • {row.kickoff}
                  </span>
                  <CopyFixtureId fixtureId={row.fixtureId} />
                </div>
              </td>
              <td className="px-5 py-4.5">
                <div className="flex items-center">
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {formatPickForDisplay(row.pick, row.market)}
                  </span>
                  <CopyPick row={row} />
                </div>
              </td>
              <td className="px-5 py-4.5 font-medium text-slate-700">
                {row.odds}
              </td>
              <td className="px-5 py-4.5 font-semibold text-success">
                {row.ev}
              </td>
              <td className="px-5 py-4.5">
                <div className="font-semibold text-slate-800">
                  {row.quality}
                </div>
                <div className="text-xs text-slate-400">
                  Dét. {row.deterministic}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}
