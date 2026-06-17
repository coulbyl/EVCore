import { Tooltip, TooltipContent, TooltipTrigger } from "@evcore/ui";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import type {
  ChannelDecisionDto,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";
import {
  CHANNEL_COLOR,
  CHANNEL_COLOR_SOFT,
  CHANNEL_LABEL,
  STATUS_LABEL,
  formatEv,
  formatOdds,
  formatPct,
  reasonLabel,
} from "./channel-constants";
import { ResultBadge } from "./result-badge";

function ChannelChip({ channel }: { channel: StrategyChannel }) {
  return (
    <span
      className="inline-flex w-16 shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide"
      style={{
        color: CHANNEL_COLOR[channel],
        backgroundColor: CHANNEL_COLOR_SOFT[channel],
      }}
    >
      {CHANNEL_LABEL[channel]}
    </span>
  );
}

export function ChannelRow({
  channel,
  decision,
  locale,
}: {
  channel: StrategyChannel;
  decision: ChannelDecisionDto | undefined;
  locale: string;
}) {
  const loc = locale === "en" ? "en" : "fr";
  const selection =
    decision?.status === "SELECTED" ? decision.selections[0] : undefined;

  return (
    <div className="flex items-center gap-3 py-2">
      <ChannelChip channel={channel} />

      {selection ? (
        <>
          <span className="min-w-0 flex-1 truncate text-xs font-medium">
            {formatPickForDisplay(selection.pick, selection.market)}
            <span className="ml-1.5 font-normal text-muted-foreground">
              {formatMarketForDisplay(selection.market, loc)}
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-2.5 text-xs tabular-nums">
            <span className="text-muted-foreground">
              {formatPct(selection.probability)}
            </span>
            {formatOdds(selection.odds) !== null && (
              <span className="font-semibold">
                {formatOdds(selection.odds)}
              </span>
            )}
            {formatEv(selection.ev) !== null && (
              <span className="text-muted-foreground">
                {formatEv(selection.ev)}
              </span>
            )}
            <ResultBadge result={selection.result} />
          </div>
        </>
      ) : (
        <RejectedLabel decision={decision} />
      )}
    </div>
  );
}

function RejectedLabel({
  decision,
}: {
  decision: ChannelDecisionDto | undefined;
}) {
  // Channel didn't run at all for this fixture.
  if (decision === undefined) {
    return <span className="flex-1 text-xs text-muted-foreground/60">—</span>;
  }

  const reason = reasonLabel(decision.reasonCode);
  const status = STATUS_LABEL[decision.status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/70">
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
