"use client";

import Image from "next/image";
import { useStandings } from "@/domains/fixture/use-cases/use-standings";
import type {
  StandingGroup,
  StandingTeam,
} from "@/domains/fixture/use-cases/use-standings";
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

function TeamRow({
  team,
  isQualified,
  isPlayoff,
}: {
  team: StandingTeam;
  isQualified: boolean;
  isPlayoff: boolean;
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-x-2 px-3 py-2 text-xs",
        "grid-cols-[1rem_1.25rem_1fr_auto_auto_auto_auto_auto]",
        isQualified && "bg-[#c9a84c]/5",
        isPlayoff && "bg-blue-500/5",
      )}
    >
      {/* Rank */}
      <span
        className={cn(
          "text-center font-bold tabular-nums",
          isQualified ? "text-[#c9a84c]" : "text-muted-foreground",
        )}
      >
        {team.rank}
      </span>

      {/* Logo */}
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

      {/* Name */}
      <span className="truncate font-medium text-foreground">
        {team.teamName}
      </span>

      {/* Form */}
      <FormBadges form={team.form} />

      {/* P */}
      <span className="w-5 text-center tabular-nums text-muted-foreground">
        {team.played}
      </span>

      {/* GD */}
      <span
        className={cn(
          "w-6 text-center tabular-nums",
          team.goalsDiff > 0
            ? "text-green-400"
            : team.goalsDiff < 0
              ? "text-red-400"
              : "text-muted-foreground",
        )}
      >
        {team.goalsDiff > 0 ? `+${team.goalsDiff}` : team.goalsDiff}
      </span>

      {/* Pts */}
      <span
        className={cn(
          "w-6 text-center font-bold tabular-nums",
          isQualified ? "text-[#c9a84c]" : "text-foreground",
        )}
      >
        {team.points}
      </span>
    </div>
  );
}

function GroupCard({ group }: { group: StandingGroup }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-panel">
      {/* Group header */}
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-widest text-[#c9a84c]">
          {group.name}
        </span>
        <div className="flex gap-3 pr-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="w-5 text-center">P</span>
          <span className="w-6 text-center">GD</span>
          <span className="w-6 text-center">Pts</span>
        </div>
      </div>

      {/* Teams */}
      <div className="divide-y divide-border/40">
        {group.teams.map((team, i) => (
          <TeamRow
            key={team.teamApiId}
            team={team}
            isQualified={i < 2}
            isPlayoff={i === 2}
          />
        ))}
      </div>
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
  const { data, isLoading, isError } = useStandings("WC26", 2026);

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
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {data.groups.length} groupes · Saison {data.season}
        </p>
        <div className="flex items-center gap-3 text-[0.6rem] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-sm bg-[#c9a84c]/30" />
            Qualifié
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-sm bg-blue-500/20" />
            Barrage
          </span>
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
