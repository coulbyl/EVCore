import { Badge, Card } from "@evcore/ui";
import { useTranslations } from "next-intl";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import type {
  AvoidOffender,
  AvoidReasonDetails,
  ChannelDecisionDto,
  ConsensusReasonDetails,
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
} from "./channel-constants";
import { FixtureHeading } from "./fixture-heading";
import { ResultBadge } from "./result-badge";

function parseAvoidOffenders(raw: unknown): AvoidOffender[] {
  if (!raw || typeof raw !== "object") return [];
  const d = raw as Partial<AvoidReasonDetails>;
  if (!Array.isArray(d.offenders)) return [];
  return d.offenders.filter(
    (o): o is AvoidOffender =>
      typeof o === "object" &&
      o !== null &&
      typeof o.channel === "string" &&
      typeof o.edge === "number",
  );
}

function parseConsensusChannels(raw: unknown): StrategyChannel[] {
  if (!raw || typeof raw !== "object") return [];
  const d = raw as Partial<ConsensusReasonDetails>;
  if (!Array.isArray(d.channels)) return [];
  return d.channels.filter((c): c is StrategyChannel => typeof c === "string");
}

// One SELECTED decision rendered fixture-first (used by the "Par canal" lens).
export function ChannelSelectionRow({
  decision,
  locale,
}: {
  decision: ChannelDecisionDto;
  locale: string;
}) {
  const loc = locale === "en" ? "en" : "fr";
  const t = useTranslations("decisions");
  const selection = decision.selections[0];

  const isAvoid = decision.channel === "AVOID";
  const isConsensus = decision.channel === "CONSENSUS";
  const avoidOffenders = isAvoid
    ? parseAvoidOffenders(decision.reasonDetails)
    : [];
  const consensusChannels = isConsensus
    ? parseConsensusChannels(decision.reasonDetails)
    : [];

  return (
    <Card className="relative flex-col items-stretch gap-2 overflow-hidden border-border/70 p-3 pl-4 transition-colors hover:border-border sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: CHANNEL_COLOR[decision.channel] }}
        aria-hidden
      />
      <FixtureHeading
        homeTeam={decision.homeTeam}
        awayTeam={decision.awayTeam}
        homeLogo={decision.homeLogo}
        awayLogo={decision.awayLogo}
        competition={decision.competition}
        country={decision.country}
        locale={locale}
        kickoff={decision.kickoff}
        score={decision.score}
        htScore={decision.htScore}
      />

      {selection === undefined ? (
        <AvoidDetail
          offenders={avoidOffenders}
          fallback={reasonLabel(decision.reasonCode, t)}
          locale={loc}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:shrink-0 sm:justify-end">
          <span className="min-w-0 font-medium">
            {formatPickForDisplay(selection.pick, selection.market)}
            <span className="ml-1.5 font-normal text-muted-foreground">
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
          {consensusChannels.length > 0 && (
            <ConsensusSourcePills channels={consensusChannels} />
          )}
          <ResultBadge result={selection.result} />
        </div>
      )}
    </Card>
  );
}

function AvoidDetail({
  offenders,
  fallback,
  locale,
}: {
  offenders: AvoidOffender[];
  fallback: string | null;
  locale: "en" | "fr";
}) {
  const t = useTranslations("decisions");
  if (offenders.length === 0) {
    return (
      <span className="text-xs text-muted-foreground sm:shrink-0">
        {fallback ?? "—"}
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-1 sm:shrink-0 sm:items-end">
      {offenders.map((o, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
        >
          <Badge
            className="px-0 py-0"
            style={{
              color: CHANNEL_COLOR[o.channel],
              backgroundColor: CHANNEL_COLOR_SOFT[o.channel],
            }}
          >
            {channelLabel(o.channel, t)}
          </Badge>
          <span className="font-medium">
            {formatPickForDisplay(o.pick, o.market)}
          </span>
          <span className="text-muted-foreground">
            {formatMarketForDisplay(o.market, locale)}
          </span>
          <span
            className="font-semibold tabular-nums"
            style={{ color: "var(--canal-avoid)" }}
          >
            {t("avoid.edge")} +{Math.round(o.edge * 100)}%
          </span>
          {o.result !== undefined && o.result !== null && (
            <ResultBadge result={o.result} />
          )}
        </div>
      ))}
    </div>
  );
}

function ConsensusSourcePills({ channels }: { channels: StrategyChannel[] }) {
  const t = useTranslations("decisions");
  return (
    <span className="flex flex-wrap gap-1">
      {channels.map((ch) => (
        <Badge
          key={ch}
          className="px-0 py-0"
          style={{
            color: CHANNEL_COLOR[ch],
            backgroundColor: CHANNEL_COLOR_SOFT[ch],
          }}
        >
          {channelLabel(ch, t)}
        </Badge>
      ))}
    </span>
  );
}
