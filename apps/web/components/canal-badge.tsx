"use client";

import { useTranslations } from "next-intl";
import {
  CHANNEL_COLOR,
  CHANNEL_COLOR_SOFT,
  channelLabel,
} from "@/app/dashboard/decisions/components/channel-constants";
import type { StrategyChannel } from "@/domains/channel-decision/types/channel-decision";

// Was its own parallel color/label map (STYLES/LABEL_KEY, "picks" i18n
// namespace) — drifted from decisions.channels.<CODE>.label (the real
// source, docs/vantage-centric-redesign-2026-09-01.md §2quater): VALUE/SAFE
// had no entry at all and fell back to the raw technical code, DOMINANT was
// hardcoded to "VICT". Delegates to channel-constants.ts now, same source
// every other canal display in the app already uses.
export type Canal = StrategyChannel;

export function CanalBadge({ canal }: { canal: Canal }) {
  const t = useTranslations("decisions");
  const color = CHANNEL_COLOR[canal];
  const soft = CHANNEL_COLOR_SOFT[canal];
  const label = channelLabel(canal, t);

  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em]"
      style={{
        color,
        background: soft,
        border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}
