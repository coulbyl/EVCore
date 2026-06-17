import { Tooltip, TooltipContent, TooltipTrigger, cn } from "@evcore/ui";
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
    <span className="flex shrink-0 items-center gap-1.5">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: CHANNEL_COLOR[channel] }}
        aria-hidden
      />
      <span className="text-xs font-semibold">{CHANNEL_LABEL[channel]}</span>
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

  // Channel didn't run for this fixture.
  if (decision === undefined) {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <ChannelChip channel={channel} />
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    );
  }

  const selection =
    decision.status === "SELECTED" ? decision.selections[0] : undefined;

  if (selection) {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <ChannelChip channel={channel} />
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 text-xs">
          <span className="min-w-0 truncate font-medium">
            {formatPickForDisplay(selection.pick, selection.market)}
            <span className="ml-1.5 text-muted-foreground">
              {formatMarketForDisplay(selection.market, loc)}
            </span>
          </span>
          <span className="tabular-nums text-muted-foreground">
            {formatPct(selection.probability)}
          </span>
          {formatOdds(selection.odds) !== null && (
            <span className="tabular-nums font-semibold">
              {formatOdds(selection.odds)}
            </span>
          )}
          {formatEv(selection.ev) !== null && (
            <span className="tabular-nums text-muted-foreground">
              {formatEv(selection.ev)}
            </span>
          )}
          <ResultBadge result={selection.result} />
        </div>
      </div>
    );
  }

  // Non-selected outcome (REJECTED / DISABLED / MISSING_ODDS / …).
  const reason = reasonLabel(decision.reasonCode);
  const detail = reason ?? STATUS_LABEL[decision.status];
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 opacity-60">
      <ChannelChip channel={channel} />
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "min-w-0 truncate text-xs text-muted-foreground",
              "cursor-default",
            )}
          >
            {STATUS_LABEL[decision.status]}
            {reason ? ` · ${reason}` : ""}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          {detail}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
