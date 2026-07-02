"use client";

import { AlertCircle, Flame } from "lucide-react";
import type { LeaderboardEntry } from "@/domains/dashboard/types/dashboard";

type PodiumStyle = {
  row: string;
  rankBg: string;
  rankText: string;
  icon: string;
};

const PODIUM: [PodiumStyle, PodiumStyle, PodiumStyle] = [
  {
    row: "bg-warning/10 border border-warning/30",
    rankBg: "bg-warning",
    rankText: "text-accent-foreground",
    icon: "🥇",
  },
  {
    row: "bg-secondary border border-border",
    rankBg: "bg-muted",
    rankText: "text-accent-foreground",
    icon: "🥈",
  },
  {
    row: "bg-accent-soft border border-accent/20",
    rankBg: "bg-accent",
    rankText: "text-accent-foreground",
    icon: "🥉",
  },
];

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const positive = entry.roi.startsWith("+");
  const podium = entry.rank <= 3 ? PODIUM[entry.rank - 1] : null;

  if (podium) {
    return (
      <div
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${podium.row}`}
      >
        <span className="text-base leading-none">{podium.icon}</span>
        <span className="min-w-0 flex-1 truncate text-[0.8rem] font-bold text-foreground">
          {entry.username}
        </span>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="hidden text-[0.62rem] tabular-nums text-muted-foreground sm:block">
            {entry.settled} coupon{entry.settled > 1 ? "s" : ""} joué
            {entry.settled > 1 ? "s" : ""}
          </span>
          <span
            className={`text-[0.85rem] font-extrabold tabular-nums ${
              positive ? "text-success" : "text-danger"
            }`}
          >
            {entry.roi}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors hover:bg-panel">
      <span className="w-5 shrink-0 text-center text-[0.62rem] font-bold tabular-nums text-muted-foreground">
        {String(entry.rank).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.78rem] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
        {entry.username}
      </span>
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="hidden text-[0.62rem] tabular-nums text-muted-foreground sm:block">
          {entry.settled}
        </span>
        <span
          className={`text-[0.78rem] font-bold tabular-nums ${
            positive ? "text-success" : "text-danger"
          }`}
        >
          {entry.roi}
        </span>
      </div>
    </div>
  );
}

function SkeletonRow({ wide }: { wide?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5">
      <div className="bento-skeleton h-4 w-5 rounded-md" />
      <div
        className={`bento-skeleton h-3 rounded-md ${wide ? "flex-1" : "w-28"}`}
      />
      <div className="ml-auto bento-skeleton h-4 w-12 rounded-md" />
    </div>
  );
}

export function UserLeaderboard({
  entries,
  isLoading,
  isError,
}: {
  entries: LeaderboardEntry[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-[1.35rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      <div className="mb-3 flex items-center gap-2">
        <Flame size={14} className="shrink-0 text-accent" />
        <h2 className="text-sm font-bold tracking-tight text-foreground">
          Top joueurs
        </h2>
        <span className="ml-auto text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">
          ROI · ≥ 5 coupons joués
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-1.5 py-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} wide={i > 2} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-6 text-center">
          <AlertCircle size={28} className="text-danger opacity-60" />
          <p className="text-sm font-semibold text-foreground">
            Impossible de charger le classement
          </p>
          <p className="text-xs text-muted-foreground">
            Vérifiez votre connexion et réessayez.
          </p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Flame size={32} className="text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">
            Pas encore assez de données.
          </p>
        </div>
      ) : (
        <div
          className="max-h-65 overflow-y-auto"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "var(--border) transparent",
          }}
        >
          <div className="flex flex-col gap-1.5">
            {entries.map((entry) => (
              <LeaderboardRow key={entry.rank} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
