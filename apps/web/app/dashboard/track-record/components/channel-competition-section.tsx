"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@evcore/ui";
import { translateCountry } from "@/lib/competition-i18n";
import type { ChannelCompetitionStatItem } from "@/domains/dashboard/types/dashboard";
import {
  CHANNEL_DISPLAY_ORDER,
  CHANNEL_LABELS,
  formatHitRate,
  formatRoi,
} from "../track-record-constants";
import { ChannelStatusBadge } from "./channel-status-badge";

/** Independent from the "Par canal" summary above — same settled data, one
 * level finer (channel × compétition). A dropdown, not tabs: 10 channels
 * don't fit as tabs without wrapping/overlapping on mobile. All channels are
 * fetched once server-side, so switching is instant (no reload). */
export function ChannelCompetitionSection({
  rows,
}: {
  rows: ChannelCompetitionStatItem[];
}) {
  const locale = useLocale();
  const channelsWithData = useMemo(
    () =>
      CHANNEL_DISPLAY_ORDER.filter((channel) =>
        rows.some((r) => r.channel === channel),
      ),
    [rows],
  );
  const [selected, setSelected] = useState(
    channelsWithData[0] ?? CHANNEL_DISPLAY_ORDER[0],
  );

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => r.channel === selected)
        .sort((a, b) => b.sampleSize - a.sampleSize),
    [rows, selected],
  );

  if (channelsWithData.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Par compétition
        </h2>
        <Select
          value={selected}
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
                {CHANNEL_LABELS[channel]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compétition</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">ROI</TableHead>
              <TableHead className="text-right">Taux de réussite</TableHead>
              <TableHead className="text-right">Échantillon</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.competitionCode}>
                <TableCell className="font-medium text-foreground">
                  {row.competitionName}
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    · {translateCountry(row.competitionCountry, locale)}
                  </span>
                </TableCell>
                <TableCell>
                  <ChannelStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRoi(row.roi)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatHitRate(row.hitRate)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  n={row.sampleSize}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
