import { Tooltip, TooltipContent, TooltipTrigger } from "@evcore/ui";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import { useTranslations } from "next-intl";
import type {
  ChannelDecisionMatchDecisionDto,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";
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

function ChannelChip({ channel }: { channel: StrategyChannel }) {
  const t = useTranslations("decisions");
  return (
    <span
      className="inline-flex w-fit min-w-16 shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide"
      style={{
        color: CHANNEL_COLOR[channel],
        backgroundColor: CHANNEL_COLOR_SOFT[channel],
      }}
    >
      {channelLabel(channel, t)}
    </span>
  );
}

export function ChannelRow({
  channel,
  decision,
  locale,
}: {
  channel: StrategyChannel;
  decision: ChannelDecisionMatchDecisionDto | undefined;
  locale: string;
}) {
  const loc = locale === "en" ? "en" : "fr";
  const selection =
    decision?.status === "SELECTED" ? decision.selections[0] : undefined;
  const odds = selection ? formatOdds(selection.odds) : null;
  const ev = selection ? formatEv(selection.ev) : null;

  return (
    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-2.5 py-2.5 sm:grid-cols-[4.75rem_minmax(0,1fr)] sm:gap-x-3">
      <ChannelChip channel={channel} />

      {selection ? (
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="line-clamp-2 min-w-0 text-xs font-semibold leading-snug">
              {formatPickForDisplay(selection.pick, selection.market)}
            </p>
            <ResultBadge result={selection.result} />
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
        </div>
      ) : (
        <RejectedLabel decision={decision} />
      )}
    </div>
  );
}

function RejectedLabel({
  decision,
}: {
  decision: ChannelDecisionMatchDecisionDto | undefined;
}) {
  const t = useTranslations("decisions");
  // Channel didn't run at all for this fixture.
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
