"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useChannelHealth } from "@/domains/dashboard/use-cases/get-channel-health";
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

const CHANNEL_ORDER: ChannelHealthItem["channel"][] = [
  "VALUE",
  "SAFE",
  "DOMINANT",
  "BTTS",
  "DRAW",
  "GOALS",
];

/** At-a-glance channel health for the admin dashboard — just the status dot,
 * no metrics. Full ROI/hitRate/drawdown breakdown lives on /dashboard/performance
 * (ChannelAnalysisSection), which reads channel_selection directly and is the
 * source of truth for depth; duplicating it here caused scale/period bugs. */
export function ChannelStatusStrip({ from, to }: { from: string; to: string }) {
  const tPicks = useTranslations("picks");
  const { data: healthItems = [], isLoading } = useChannelHealth(from, to);

  const byChannel = new Map(healthItems.map((h) => [h.channel, h]));

  const CHANNEL_LABEL: Record<ChannelHealthItem["channel"], string> = {
    VALUE: tPicks("evChannel"),
    SAFE: tPicks("safeValue"),
    DOMINANT: tPicks("confidence"),
    BTTS: tPicks("btts"),
    DRAW: tPicks("matchNull"),
    GOALS: tPicks("goals"),
  };

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
                {CHANNEL_LABEL[channel]}
              </span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
