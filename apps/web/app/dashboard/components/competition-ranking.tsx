"use client";

import { Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CompetitionStat } from "@/domains/dashboard/types/dashboard";

function RoiChip({ roi }: { roi: string | null }) {
  if (!roi) {
    return (
      <span className="text-[0.6rem] italic text-muted-foreground">
        données insuff.
      </span>
    );
  }
  const positive = roi.startsWith("+");
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums ${
        positive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      {roi}
    </span>
  );
}

function CompetitionRow({
  stat,
  index,
}: {
  stat: CompetitionStat;
  index: number;
}) {
  const t = useTranslations("dashboard.leagueRanking");
  const pos = String(index + 1).padStart(2, "0");
  return (
    <div className="group rounded-xl px-2.5 py-2.5 transition-colors hover:bg-panel">
      <div className="flex items-center gap-2.5">
        <span className="w-5 shrink-0 text-center text-[0.6rem] font-bold tabular-nums text-muted-foreground">
          {pos}
        </span>
        <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[0.53rem] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          {stat.competitionCode}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.78rem] font-semibold text-foreground transition-colors group-hover:text-foreground">
          {stat.competitionName}
        </span>
        <span className="shrink-0 text-[0.6rem] text-muted-foreground">
          {stat.activeFixtures} match{stat.activeFixtures > 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-7">
        <span className="text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t("model")}
        </span>
        <RoiChip roi={stat.model.roi} />
        {stat.model.winRate && (
          <span className="text-[0.6rem] text-muted-foreground">
            {stat.model.winRate} victoires
          </span>
        )}
        <span className="text-[0.58rem] text-muted-foreground">
          ({stat.model.settled} joués)
        </span>
      </div>

      {stat.myPicks && (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 pl-7">
          <span className="text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-accent">
            {t("myBets")}
          </span>
          <RoiChip roi={stat.myPicks.roi} />
          <span className="text-[0.58rem] text-muted-foreground">
            ({stat.myPicks.settled} joués)
          </span>
        </div>
      )}
    </div>
  );
}

export function CompetitionRanking({ stats }: { stats: CompetitionStat[] }) {
  const t = useTranslations("dashboard.leagueRanking");
  return (
    <div className="flex flex-col rounded-[1.35rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={14} className="shrink-0 text-warning" />
        <h2 className="text-sm font-bold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <span className="ml-auto text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">
          {t("period")}
        </span>
      </div>

      {stats.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <div
          className="max-h-65 overflow-y-auto"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#cbd5e1 transparent",
          }}
        >
          <div className="flex flex-col gap-0.5">
            {stats.map((stat, i) => (
              <CompetitionRow key={stat.competitionId} stat={stat} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
