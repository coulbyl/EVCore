"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@evcore/ui";
import { translateCountry } from "@/lib/competition-i18n";
import type { ChannelCompetitionStatItem } from "@/domains/dashboard/types/dashboard";
import { channelLabel } from "../../decisions/components/channel-constants";
import { orderChannels } from "../track-record-constants";
import { ChannelStatsTable, type ChannelStatRow } from "./channel-stats-table";

/** Independent from the "Par canal" summary above — same settled data, one
 * level finer (channel × compétition). A dropdown, not tabs: eighteen
 * channels don't fit as tabs without wrapping/overlapping on mobile. All
 * channels are fetched once server-side, so switching is instant (no
 * reload). */
export function ChannelCompetitionSection({
  rows,
}: {
  rows: ChannelCompetitionStatItem[];
}) {
  const locale = useLocale();
  // Les canaux viennent des données reçues, pas d'une liste locale : celle-ci
  // ne sert plus qu'à les ORDONNER (voir orderChannels).
  const channelsWithData = useMemo(() => {
    const seen = new Set(rows.map((r) => r.channel));
    return orderChannels([...seen].map((channel) => ({ channel }))).map(
      (c) => c.channel,
    );
  }, [rows]);
  // `selected` peut être vide au premier rendu si les données arrivent après
  // le montage — on retombe alors sur le premier canal disponible plutôt que
  // de filtrer sur `undefined` et d'afficher un tableau vide.
  const [selected, setSelected] =
    useState<ChannelCompetitionStatItem["channel"]>();
  const active = selected ?? channelsWithData[0];

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => r.channel === active)
        .sort((a, b) => b.sampleSize - a.sampleSize),
    [rows, active],
  );
  const filteredRows: ChannelStatRow[] = filtered.map((row) => ({
    key: row.competitionCode,
    primaryLabel: row.competitionName,
    secondaryLabel: translateCountry(row.competitionCountry, locale),
    status: row.status,
    roi: row.roi,
    hitRate: row.hitRate,
    calibrationRatio: row.calibrationRatio,
    sampleSize: row.sampleSize,
  }));

  if (channelsWithData.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Par compétition
        </h2>
        <Select
          value={active}
          onValueChange={(v) =>
            setSelected(v as ChannelCompetitionStatItem["channel"])
          }
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {channelsWithData.map((channel) => (
              <SelectItem key={channel} value={channel}>
                {channelLabel(channel, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ChannelStatsTable primaryColumnLabel="Compétition" rows={filteredRows} />
    </section>
  );
}
