"use client";

import { Medal } from "lucide-react";
import type { LeaderboardEntry } from "@/domains/dashboard/types/dashboard";

const MEDAL_COLORS = ["text-yellow-500", "text-slate-400", "text-amber-600"];

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <Medal
        size={15}
        className={MEDAL_COLORS[rank - 1] ?? "text-slate-400"}
      />
    );
  }
  return (
    <span className="w-[15px] text-center text-[0.72rem] font-bold tabular-nums text-slate-400">
      {rank}
    </span>
  );
}

export function UserLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="rounded-[1.35rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      <div className="mb-4 flex items-center gap-2">
        <Medal size={15} className="text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-800">
          Top joueurs
        </h2>
        <span className="ml-auto text-[0.65rem] text-slate-400">
          ROI · ≥ 5 picks settlés
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Pas encore assez de données pour afficher le classement.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[0.9rem] border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Joueur</th>
                <th className="px-3 py-2.5 text-right">ROI</th>
                <th className="hidden px-3 py-2.5 text-right sm:table-cell">
                  Settlés
                </th>
                <th className="hidden px-3 py-2.5 text-right sm:table-cell">
                  Gagnés
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {entries.map((entry) => {
                const positive = entry.roi.startsWith("+");
                return (
                  <tr key={entry.rank} className="align-middle">
                    <td className="px-3 py-2.5">
                      <RankBadge rank={entry.rank} />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {entry.username}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={`text-[0.78rem] font-bold tabular-nums ${
                          positive ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {entry.roi}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-slate-500 sm:table-cell">
                      {entry.settled}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-slate-500 sm:table-cell">
                      {entry.won}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
