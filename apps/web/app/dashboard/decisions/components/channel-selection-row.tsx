import { Badge, cn } from "@evcore/ui";
import { useTranslations } from "next-intl";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import type {
  AvoidOffender,
  AvoidReasonDetails,
  ChannelDecisionDto,
} from "@/domains/channel-decision/types/channel-decision";
import {
  CHANNEL_COLOR,
  CHANNEL_COLOR_SOFT,
  channelLabel,
  reasonLabel,
} from "./channel-constants";
import { FixtureCard } from "@/components/fixture-card";
import { ResultBadge } from "@/components/result-badge";
import { ChannelRow, type SlipContext } from "./channel-row";

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
  const avoidOffenders = isAvoid
    ? parseAvoidOffenders(decision.reasonDetails)
    : [];

  // Pariable uniquement avant le coup d'envoi : pas de match en cours ni terminé.
  const isUpcoming =
    decision.score === null &&
    new Date(decision.scheduledAt).getTime() > Date.now();

  const slipContext: SlipContext | undefined = isUpcoming
    ? {
        fixtureId: decision.fixtureId,
        fixture: `${decision.homeTeam} vs ${decision.awayTeam}`,
        homeLogo: decision.homeLogo,
        awayLogo: decision.awayLogo,
        competition: decision.competition,
        scheduledAt: decision.scheduledAt,
      }
    : undefined;

  return (
    <FixtureCard
      fixture={`${decision.homeTeam} vs ${decision.awayTeam}`}
      homeLogo={decision.homeLogo}
      awayLogo={decision.awayLogo}
      competition={decision.competitionName}
      country={decision.country}
      kickoff={decision.kickoff}
      score={decision.score}
      htScore={decision.htScore}
      locale={locale}
      className={cn(
        "transition-colors hover:border-border",
        isAvoid && "border-[color:var(--canal-avoid)]/40",
      )}
      bodyClassName="py-2"
    >
      {selection === undefined ? (
        <AvoidDetail
          offenders={avoidOffenders}
          fallback={reasonLabel(decision.reasonCode, t)}
          locale={loc}
        />
      ) : (
        <ChannelRow
          channel={decision.channel}
          decision={decision}
          locale={locale}
          slipContext={slipContext}
        />
      )}
    </FixtureCard>
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
          {o.result !== undefined && <ResultBadge result={o.result} />}
        </div>
      ))}
    </div>
  );
}
