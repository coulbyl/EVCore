import { Ban, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, Separator, cn } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { InfoTooltip } from "@/components/info-tooltip";
import type {
  ChannelDecisionMatchDto,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";
import { channelLabel, reasonLabel } from "./channel-constants";
import {
  avoidFlag,
  evaluatedRest,
  hasConsensus,
  selectedPicks,
  type AvoidFlag,
} from "./decision-helpers";
import { ChannelRow, type SlipContext } from "./channel-row";
import { FixtureHeading } from "./fixture-heading";

export type MatchGroup = ChannelDecisionMatchDto;

export function MatchCard({
  group,
  locale,
}: {
  group: MatchGroup;
  locale: string;
}) {
  const t = useTranslations("decisions");
  const avoid = avoidFlag(group);
  const picks = selectedPicks(group);
  const rest = evaluatedRest(group);
  const consensus = hasConsensus(group);

  const avoidEdgeByChannel = new Map<StrategyChannel, number>(
    avoid?.offenders.map((o) => [o.channel, o.edge]) ?? [],
  );

  // Pariable uniquement avant le coup d'envoi : pas de match en cours ni terminé.
  const isUpcoming =
    group.score === null && new Date(group.scheduledAt).getTime() > Date.now();

  const slipContext: SlipContext | undefined = isUpcoming
    ? {
        fixtureId: group.fixtureId,
        fixture: `${group.homeTeam} vs ${group.awayTeam}`,
        homeLogo: group.homeLogo,
        awayLogo: group.awayLogo,
        competition: group.competition,
        scheduledAt: group.scheduledAt,
      }
    : undefined;

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden border-border/70 p-0 transition-colors hover:border-border",
        avoid && "border-[color:var(--canal-avoid)]/40",
      )}
    >
      {avoid && (
        <div
          className="mx-3 mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
          style={{
            color: "var(--canal-avoid)",
            backgroundColor: "var(--canal-avoid-soft)",
            borderColor:
              "color-mix(in srgb, var(--canal-avoid) 35%, transparent)",
          }}
        >
          <Ban className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t("avoid.banner")}</span>
            <AvoidOffenderLine avoid={avoid} />
          </span>
          <InfoTooltip
            label={t("avoid.tooltipLabel")}
            description={t("avoid.tooltipDetail")}
            side="left"
          />
        </div>
      )}

      <div>
        <CardHeader className="gap-3 px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <FixtureHeading
              homeTeam={group.homeTeam}
              awayTeam={group.awayTeam}
              homeLogo={group.homeLogo}
              awayLogo={group.awayLogo}
              competition={group.competition}
              country={group.country}
              locale={locale}
              score={group.score}
              htScore={group.htScore}
            />
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-xs tabular-nums text-muted-foreground">
                {group.kickoff}
              </span>
              <ConvictionBadge pickCount={picks.length} consensus={consensus} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 px-4 pb-4">
          <Separator />

          {picks.length > 0 ? (
            <div className="flex flex-col divide-y divide-border/50">
              {picks.map((decision) => (
                <ChannelRow
                  key={decision.id}
                  channel={decision.channel}
                  decision={decision}
                  locale={locale}
                  avoidEdge={avoidEdgeByChannel.get(decision.channel)}
                  slipContext={slipContext}
                />
              ))}
            </div>
          ) : (
            <p className="py-1 text-xs text-muted-foreground/70">
              {t("noPick")}
            </p>
          )}

          {rest.length > 0 && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-1 text-[0.72rem] text-muted-foreground/70 transition-colors hover:text-muted-foreground">
                <span>{t("evaluatedCount", { count: rest.length })}</span>
                <span className="text-sm leading-none text-muted-foreground/50 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="mt-1 flex flex-col divide-y divide-border/40 opacity-80">
                {rest.map((decision) => (
                  <ChannelRow
                    key={decision.id}
                    channel={decision.channel}
                    decision={decision}
                    locale={locale}
                  />
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </div>
    </Card>
  );
}

function AvoidOffenderLine({ avoid }: { avoid: AvoidFlag }) {
  const t = useTranslations("decisions");
  const first = avoid.offenders[0];
  if (first) {
    const edgePct = `+${Math.round(first.edge * 100)}%`;
    return (
      <span className="block leading-snug opacity-90">
        {channelLabel(first.channel, t)} · {t("avoid.edge")} {edgePct}
      </span>
    );
  }
  const fallback = reasonLabel(avoid.reasonCode, t);
  return fallback ? (
    <span className="block leading-snug opacity-90">{fallback}</span>
  ) : null;
}

function ConvictionBadge({
  pickCount,
  consensus,
}: {
  pickCount: number;
  consensus: boolean;
}) {
  const t = useTranslations("decisions");
  if (pickCount === 0) {
    return (
      <span className="text-[0.65rem] font-medium text-muted-foreground/60">
        {t("noPickShort")}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      {consensus && (
        <span className="flex items-center gap-1">
          <span
            className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide"
            style={{
              color: "var(--canal-consensus)",
              backgroundColor: "var(--canal-consensus-soft)",
            }}
          >
            <Sparkles className="size-2.5" />
            {t("channels.CONSENSUS.label")}
          </span>
          <InfoTooltip
            label={t("consensus.tooltipLabel")}
            description={t("consensus.tooltipDetail")}
            side="left"
          />
        </span>
      )}
      <span className="text-[0.65rem] font-semibold tabular-nums text-foreground">
        {t("pickCount", { count: pickCount })}
      </span>
    </span>
  );
}
