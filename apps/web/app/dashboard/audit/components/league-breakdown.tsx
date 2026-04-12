import { formatCompactValue } from "@/helpers/number";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AuditLeagueRow } from "@/domains/audit/types/audit";

function XgBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-rose-400";
  const text =
    pct >= 80
      ? "text-emerald-600"
      : pct >= 50
        ? "text-amber-600"
        : "text-rose-500";
  return (
    <div className="flex items-center gap-2">
      <span className={`tabular-nums font-semibold ${text}`}>{pct}%</span>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function XgBarFull({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-rose-400";
  const text =
    pct >= 80
      ? "text-emerald-600"
      : pct >= 50
        ? "text-amber-600"
        : "text-rose-500";
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className={`tabular-nums font-semibold ${text}`}>{pct}%</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
        xG
      </span>
    </div>
  );
}

export function LeagueBreakdown({ rows }: { rows: AuditLeagueRow[] }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-3">
        {rows.map((league) => (
          <div
            key={league.code}
            className="rounded-[1.2rem] border border-border bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[0.7rem] text-slate-600">
                  {league.code}
                </span>
                <span className="text-sm text-slate-500">{league.name}</span>
              </div>
              <span
                className={`text-xs font-semibold ${league.isActive ? "text-emerald-600" : "text-slate-300"}`}
              >
                {league.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {(
                [
                  ["Fixtures", league.fixtures],
                  ["Terminées", league.finished],
                  ["Cotes", league.withOdds],
                  ["Stats", league.teamStats],
                ] as const
              ).map(([label, val]) => (
                <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="uppercase tracking-[0.12em] text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1 font-semibold text-slate-700">
                    {formatCompactValue(val)}
                  </p>
                </div>
              ))}
            </div>
            <XgBarFull pct={league.xgCoveragePct} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.3rem] border border-border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-slate-500">
          <tr>
            {[
              "Ligue",
              "Active",
              "Fixtures",
              "Terminées",
              "Couv. xG",
              "Cotes",
              "Stats",
            ].map((col) => (
              <th key={col} className="px-4 py-3 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {rows.map((league) => (
            <tr key={league.code} className="hover:bg-slate-50/60">
              <td className="px-4 py-3">
                <span className="font-mono text-[0.7rem] text-slate-600">
                  {league.code}
                </span>
                <span className="ml-2 text-slate-500">{league.name}</span>
              </td>
              <td className="px-4 py-3">
                {league.isActive ? (
                  <span className="text-emerald-600">✓</span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="px-4 py-3 tabular-nums text-slate-600">
                {league.fixtures.toLocaleString()}
              </td>
              <td className="px-4 py-3 tabular-nums text-slate-600">
                {league.finished.toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <XgBar pct={league.xgCoveragePct} />
              </td>
              <td className="px-4 py-3 tabular-nums text-slate-600">
                {league.withOdds.toLocaleString()}
              </td>
              <td className="px-4 py-3 tabular-nums text-slate-600">
                {league.teamStats.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
