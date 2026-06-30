"use client";

import { TriangleAlert, Plus, Check } from "lucide-react";
import { Badge, Tooltip, TooltipContent, TooltipTrigger, cn } from "@evcore/ui";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import { useTranslations } from "next-intl";
import type {
  ChannelDecisionMatchDecisionDto,
  ChannelSelectionDto,
  ConsensusReasonDetails,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import {
  draftItemKey,
  type BetSlipDraftItem,
} from "@/domains/bet-slip/types/bet-slip";
import {
  CHANNEL_COLOR,
  CHANNEL_COLOR_SOFT,
  channelLabel,
  formatEv,
  formatOdds,
  formatPct,
  reasonLabel,
  statusLabel,
} from "./channel-constants";
import { ResultBadge } from "./result-badge";

/** Channels that produce a real pick that can be added to a slip. */
const SLIPPABLE: ReadonlySet<StrategyChannel> = new Set([
  "VALUE",
  "SAFE",
  "DOMINANT",
  "BTTS",
  "DRAW",
  "GOALS",
]);

export type SlipContext = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string | null;
  scheduledAt: string;
};

function ChannelChip({ channel }: { channel: StrategyChannel }) {
  const t = useTranslations("decisions");
  return (
    <Badge
      style={{
        color: CHANNEL_COLOR[channel],
        backgroundColor: CHANNEL_COLOR_SOFT[channel],
      }}
    >
      {channelLabel(channel, t)}
    </Badge>
  );
}

function parseConsensusChannels(raw: unknown): StrategyChannel[] {
  if (!raw || typeof raw !== "object") return [];
  const d = raw as Partial<ConsensusReasonDetails>;
  if (!Array.isArray(d.channels)) return [];
  return d.channels.filter((c): c is StrategyChannel => typeof c === "string");
}

export function ChannelRow({
  channel,
  decision,
  locale,
  avoidEdge,
  slipContext,
}: {
  channel: StrategyChannel;
  decision: ChannelDecisionMatchDecisionDto | undefined;
  locale: string;
  avoidEdge?: number;
  slipContext?: SlipContext;
}) {
  const loc = locale === "en" ? "en" : "fr";
  const selection =
    decision?.status === "SELECTED" ? decision.selections[0] : undefined;
  const odds = selection ? formatOdds(selection.odds) : null;
  const ev = selection ? formatEv(selection.ev) : null;

  const consensusChannels =
    channel === "CONSENSUS" && decision?.status === "SELECTED"
      ? parseConsensusChannels(decision.reasonDetails)
      : [];

  return (
    <div
      className={cn(
        "grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-2.5 py-2.5 sm:grid-cols-[4.75rem_minmax(0,1fr)] sm:gap-x-3",
        avoidEdge !== undefined && "opacity-60",
      )}
    >
      <ChannelChip channel={channel} />

      {selection ? (
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="line-clamp-2 min-w-0 text-xs font-semibold leading-snug">
              {formatPickForDisplay(selection.pick, selection.market)}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              {avoidEdge !== undefined && <AvoidEdgeBadge edge={avoidEdge} />}
              <ResultBadge result={selection.result} />
              {slipContext && SLIPPABLE.has(channel) && decision && (
                <SlipButton
                  channel={channel}
                  decision={decision}
                  selection={selection}
                  slipContext={slipContext}
                />
              )}
            </div>
          </div>
          <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.68rem] leading-tight text-muted-foreground">
            <span className="max-w-full truncate">
              {formatMarketForDisplay(selection.market, loc)}
            </span>
            <span className="tabular-nums">
              {formatPct(selection.probability)}
            </span>
            {odds !== null && (
              <span className="font-semibold tabular-nums text-foreground">
                {odds}
              </span>
            )}
            {ev !== null && <span className="tabular-nums">{ev}</span>}
          </p>
          {consensusChannels.length > 0 && (
            <ConsensusSourcePills channels={consensusChannels} />
          )}
        </div>
      ) : (
        <RejectedLabel decision={decision} />
      )}
    </div>
  );
}

function AvoidEdgeBadge({ edge }: { edge: number }) {
  const t = useTranslations("decisions");
  const edgePct = `+${Math.round(edge * 100)}%`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[0.6rem] font-semibold tabular-nums"
          style={{
            color: "var(--canal-avoid)",
            backgroundColor: "var(--canal-avoid-soft)",
          }}
        >
          <TriangleAlert className="size-2.5" />
          {edgePct}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {t("avoid.edgeTooltip", { pct: edgePct })}
      </TooltipContent>
    </Tooltip>
  );
}

function ConsensusSourcePills({ channels }: { channels: StrategyChannel[] }) {
  const t = useTranslations("decisions");
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {channels.map((ch) => (
        <Badge
          key={ch}
          className="border-transparent px-0 py-0 text-[0.58rem] font-semibold uppercase tracking-wide"
          style={{
            color: CHANNEL_COLOR[ch],
            backgroundColor: CHANNEL_COLOR_SOFT[ch],
          }}
        >
          {channelLabel(ch, t)}
        </Badge>
      ))}
    </div>
  );
}

function RejectedLabel({
  decision,
}: {
  decision: ChannelDecisionMatchDecisionDto | undefined;
}) {
  const t = useTranslations("decisions");
  if (decision === undefined) {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }

  const reason = reasonLabel(decision.reasonCode, t);
  const status = statusLabel(decision.status, t);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="line-clamp-2 min-w-0 text-xs leading-snug text-muted-foreground/70">
          {status}
          {reason ? ` · ${reason}` : ""}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {reason ?? status}
      </TooltipContent>
    </Tooltip>
  );
}

function SlipButton({
  channel,
  decision,
  selection,
  slipContext,
}: {
  channel: StrategyChannel;
  decision: ChannelDecisionMatchDecisionDto;
  selection: ChannelSelectionDto;
  slipContext: SlipContext;
}) {
  const { addItem, removeItem, isInSlip, open, draft } = useBetSlip();

  const item: BetSlipDraftItem = {
    modelRunId: decision.modelRunId,
    fixtureId: slipContext.fixtureId,
    fixture: slipContext.fixture,
    homeLogo: slipContext.homeLogo,
    awayLogo: slipContext.awayLogo,
    competition: slipContext.competition ?? "",
    scheduledAt: slipContext.scheduledAt,
    market: selection.market,
    pick: selection.pick,
    comboMarket: selection.comboMarket ?? undefined,
    comboPick: selection.comboPick ?? undefined,
    odds: selection.odds !== null ? String(selection.odds) : null,
    ev:
      selection.ev !== null
        ? `${selection.ev >= 0 ? "+" : ""}${(selection.ev * 100).toFixed(0)}%`
        : null,
    canal: channel,
    stakeOverride: null,
  };

  const key = draftItemKey(item);
  const inSlip = isInSlip(key);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (inSlip) {
      removeItem(key);
    } else {
      const shouldOpen = draft.items.length === 0;
      addItem(item);
      if (shouldOpen) open();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={inSlip ? "Retirer du coupon" : "Ajouter au coupon"}
      className={cn(
        "flex size-5 items-center justify-center rounded-full border transition-all",
        inSlip
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-background text-muted-foreground hover:border-accent hover:text-accent",
      )}
    >
      {inSlip ? <Check size={10} strokeWidth={3} /> : <Plus size={11} />}
    </button>
  );
}
