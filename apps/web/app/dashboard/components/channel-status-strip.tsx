"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useChannelHealth } from "@/domains/dashboard/use-cases/get-channel-health";
import { channelLabel } from "@/app/dashboard/decisions/components/channel-constants";
import type {
  ChannelHealthItem,
  ChannelStatus,
} from "@/domains/dashboard/types/dashboard";

const STATUS_DOT: Record<ChannelStatus, string> = {
  GREEN: "bg-success",
  ORANGE: "bg-warning",
  RED: "bg-danger",
  INACTIVE: "bg-muted-foreground/30",
  INSUFFICIENT_DATA: "bg-muted-foreground/50",
};

// Sous-ensemble VOLONTAIRE : ce bandeau est un coup d'œil, pas un suivi. La
// liste complète des canaux est sur Track Record, qui n'en filtre plus aucun.
//
// La composition a été revue le 2026-08-22 : c'étaient les six canaux
// historiques, écrits avant l'ouverture des autres, et il en manquait
// DOUBLE_CHANCE — le mieux mesuré du système. Les deux canaux assumés
// ouvrent désormais le bandeau.
const CHANNEL_ORDER = [
  "DOUBLE_CHANCE",
  "DRAW",
  "VALUE",
  "DOMINANT",
  "TEAM_TOTAL",
  "BTTS",
  "GOALS",
] as const satisfies readonly ChannelHealthItem["channel"][];

/** At-a-glance channel health for the admin dashboard — just the status dot,
 * no metrics. Full ROI/hitRate/drawdown breakdown lives on /dashboard/performance
 * (ChannelAnalysisSection), which reads channel_selection directly and is the
 * source of truth for depth; duplicating it here caused scale/period bugs. */
export function ChannelStatusStrip({ from, to }: { from: string; to: string }) {
  const locale = useLocale();
  const { data: healthItems = [], isLoading } = useChannelHealth(from, to);

  const byChannel = new Map(healthItems.map((h) => [h.channel, h]));

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Santé des canaux
        </p>
        <Link
          href="/dashboard/performance"
          className="shrink-0 text-[0.65rem] font-medium text-accent hover:underline"
        >
          Voir le détail →
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {CHANNEL_ORDER.map((channel) => {
          const item = byChannel.get(channel);
          const dotClass =
            isLoading || !item
              ? "animate-pulse bg-muted-foreground/30"
              : STATUS_DOT[item.status];
          return (
            <span
              key={channel}
              className="flex items-center gap-1.5 rounded-full border border-border/60 bg-panel px-3 py-1.5"
            >
              <span className={`size-2 shrink-0 rounded-full ${dotClass}`} />
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-foreground">
                {channelLabel(channel, locale)}
              </span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
