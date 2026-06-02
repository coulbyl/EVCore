"use client";

import Image from "next/image";
import { useStandings } from "@/domains/fixture/use-cases/use-standings";
import type { StandingGroup } from "@/domains/fixture/use-cases/use-standings";
import { cn } from "@evcore/ui/lib/utils";

const FORM_COLOR: Record<string, string> = {
  W: "bg-green-500",
  D: "bg-yellow-500",
  L: "bg-red-500",
};

function FormBadges({ form }: { form: string | null }) {
  if (!form) return null;
  return (
    <div className="flex gap-0.5">
      {form.split("").map((c, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex size-3.5 items-center justify-center rounded-full text-[0.5rem] font-bold text-white",
            FORM_COLOR[c] ?? "bg-muted",
          )}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function GroupCard({ group }: { group: StandingGroup }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-panel">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/60">
            <th
              className="w-6 py-2 pl-3 text-left text-[0.6rem] font-semibold uppercase tracking-wider text-[#c9a84c] whitespace-nowrap"
              colSpan={2}
            >
              {group.name}
            </th>
            <th className="py-2 text-left" />
            <th className="hidden sm:table-cell py-2 text-left" />
            <th className="w-8 py-2 text-center text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
              MJ
            </th>
            <th className="w-6 py-2 text-center text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
              V
            </th>
            <th className="w-6 py-2 text-center text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
              N
            </th>
            <th className="w-6 py-2 text-center text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
              D
            </th>
            <th className="w-8 py-2 text-center text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
              DIFF
            </th>
            <th className="w-8 py-2 pr-3 text-center text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Pts
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {group.teams.map((team, i) => {
            const isQualified = i < 2;
            const isPlayoff = i === 2;
            return (
              <tr
                key={team.teamApiId}
                className={cn(
                  isQualified && "bg-[#c9a84c]/5",
                  isPlayoff && "bg-blue-500/5",
                )}
              >
                <td className="w-5 py-2 pl-3 text-center tabular-nums font-bold">
                  <span
                    className={
                      isQualified ? "text-[#c9a84c]" : "text-muted-foreground"
                    }
                  >
                    {team.rank}
                  </span>
                </td>
                <td className="w-6 py-2 pl-1.5">
                  <div className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-panel">
                    <Image
                      src={team.teamLogo}
                      alt={team.teamName}
                      width={18}
                      height={18}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </td>
                <td className="max-w-0 py-2 pl-1.5">
                  <span className="block truncate font-medium text-foreground">
                    {team.teamName}
                  </span>
                </td>
                <td className="hidden sm:table-cell py-2 pl-2">
                  <FormBadges form={team.form} />
                </td>
                <td className="w-8 py-2 text-center tabular-nums text-muted-foreground">
                  {team.played}
                </td>
                <td className="w-6 py-2 text-center tabular-nums text-green-400">
                  {team.win}
                </td>
                <td className="w-6 py-2 text-center tabular-nums text-yellow-400">
                  {team.draw}
                </td>
                <td className="w-6 py-2 text-center tabular-nums text-red-400">
                  {team.lose}
                </td>
                <td
                  className={cn(
                    "w-8 py-2 text-center tabular-nums",
                    team.goalsDiff > 0
                      ? "text-green-400"
                      : team.goalsDiff < 0
                        ? "text-red-400"
                        : "text-muted-foreground",
                  )}
                >
                  {team.goalsDiff > 0 ? `+${team.goalsDiff}` : team.goalsDiff}
                </td>
                <td
                  className={cn(
                    "w-8 py-2 pr-3 text-center tabular-nums font-bold",
                    isQualified ? "text-[#c9a84c]" : "text-foreground",
                  )}
                >
                  {team.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonGroup() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-panel">
      <div className="border-b border-border/60 px-3 py-2">
        <div className="h-3 w-16 animate-pulse rounded bg-border" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2.5">
          <div className="size-3.5 animate-pulse rounded bg-border" />
          <div className="size-5 animate-pulse rounded-full bg-border" />
          <div className="h-3 flex-1 animate-pulse rounded bg-border" />
          <div className="h-3 w-12 animate-pulse rounded bg-border" />
        </div>
      ))}
    </div>
  );
}

export function WC2026Groups() {
  const { data, isLoading, isError } = useStandings("WC", 2026);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonGroup key={i} />
        ))}
      </div>
    );
  }

  if (isError || !data || data.groups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-panel px-4 py-8 text-center text-sm text-muted-foreground">
        Classements non disponibles.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {data.groups.length} groupes · Saison {data.season}
        </p>
        <div className="flex flex-col gap-1 text-[0.6rem] text-muted-foreground sm:items-end">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-sm bg-[#c9a84c]/30" />
              Qualifié (2 premières places)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-sm bg-blue-500/20" />
              Barrage
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground/60">
            <span>MJ = matchs joués</span>
            <span>·</span>
            <span>V / N / D = victoire · nul · défaite</span>
            <span>·</span>
            <span>DIFF = diff. buts</span>
            <span>·</span>
            <span>Pts = points</span>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.groups.map((group) => (
          <GroupCard key={group.name} group={group} />
        ))}
      </div>
    </div>
  );
}
