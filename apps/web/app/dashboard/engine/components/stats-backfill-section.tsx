"use client";

import { Badge, Button, ProgressBar, Skeleton, StatCard } from "@evcore/ui";
import { BarChart3, Clock, Pause, Play, StepForward } from "lucide-react";
import {
  useStatsBackfillAction,
  useStatsBackfillStatus,
} from "@/domains/etl/use-cases/use-etl";
import type { StatsBackfillStatus } from "@/domains/etl/types/etl";
import { formatCount } from "./stats-backfill-constants";
import { StatsBackfillSeasonsTable } from "./stats-backfill-seasons-table";

export function StatsBackfillSection() {
  const { data, isLoading, error } = useStatsBackfillStatus();
  const action = useStatsBackfillAction();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <BarChart3 size={14} className="text-accent" />
        <p className="text-[0.72rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Backfill statistiques
        </p>
        <span className="ml-auto flex items-center gap-1 text-[0.6rem] text-muted-foreground/50">
          <Clock size={10} />
          auto-refresh 30s
        </span>
      </div>

      {isLoading && <Skeleton className="h-48 rounded-[1.1rem]" />}

      {error && (
        <p className="text-xs text-danger">
          {error instanceof Error ? error.message : "Statut indisponible"}
        </p>
      )}

      {data && (
        <div className="bento-cell flex flex-col gap-5 p-5">
          <StatsBackfillOverview status={data} />

          <div className="flex flex-wrap items-center gap-2">
            {data.paused ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => action.mutate("resume")}
                disabled={action.isPending}
              >
                <Play data-icon="inline-start" />
                Reprendre
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => action.mutate("pause")}
                disabled={action.isPending}
              >
                <Pause data-icon="inline-start" />
                Mettre en pause
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => action.mutate("run")}
              disabled={action.isPending || data.paused}
            >
              <StepForward data-icon="inline-start" />
              Lancer un passage
            </Button>
            {action.error && (
              <p className="text-xs text-danger">
                {action.error instanceof Error
                  ? action.error.message
                  : "Action refusée"}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Prochaines saisons
            </p>
            <StatsBackfillSeasonsTable seasons={data.next} />
          </div>

          {data.parked.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Écartées — statistiques non couvertes par API-Football
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.parked.map((season) => (
                  <Badge
                    key={`${season.competitionCode}-${season.seasonName}`}
                    variant="warning"
                    className="font-mono text-[0.6rem]"
                  >
                    {season.competitionCode} {season.seasonName}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function StatsBackfillOverview({ status }: { status: StatsBackfillStatus }) {
  const { quota, totals } = status;
  const state = !status.scheduled
    ? { label: "Désactivé", tone: "neutral" as const }
    : status.paused
      ? { label: "En pause", tone: "warning" as const }
      : { label: "Actif", tone: "success" as const };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard compact label="État" value={state.label} tone={state.tone} />
        <StatCard
          compact
          label="Quota du jour"
          value={
            quota
              ? `${formatCount(quota.current)} / ${formatCount(quota.limitDay)}`
              : "Illisible"
          }
          tone={quota ? "accent" : "danger"}
        />
        <StatCard
          compact
          label="Budget backfill"
          value={quota ? formatCount(quota.budget) : "—"}
          delta={
            <span className="text-[0.62rem] text-muted-foreground">
              réserve {formatCount(status.reserve)}
            </span>
          }
          tone={quota && quota.budget > 0 ? "success" : "warning"}
        />
        <StatCard
          compact
          label="Matchs en attente"
          value={formatCount(totals.pending)}
          delta={
            <span className="text-[0.62rem] text-muted-foreground">
              {formatCount(totals.synced)} synchro ·{" "}
              {formatCount(totals.unavailable)} indispo
            </span>
          }
          tone="neutral"
        />
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[0.68rem] text-muted-foreground">
          {formatCount(totals.completedSeasons)} saisons terminées sur{" "}
          {formatCount(totals.seasons)}
        </p>
        <ProgressBar
          value={totals.completedSeasons}
          max={Math.max(totals.seasons, 1)}
        />
      </div>
    </div>
  );
}
