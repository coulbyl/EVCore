import { Ban, Sparkles, TriangleAlert } from "lucide-react";
import { Separator, cn } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { InfoTooltip } from "@/components/info-tooltip";
import { FixtureCard } from "@/components/fixture-card";
import { LegConnector } from "@/components/leg-connector";
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
  const calibrationAlert = group.decisions.some((d) => d.calibrationAlert);

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

  const banners = (avoid || calibrationAlert) && (
    <div className="flex flex-col gap-2 px-3 pt-3">
      {avoid && (
        <div
          className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
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

      {calibrationAlert && (
        <div
          className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
          style={{
            color: "var(--canal-avoid)",
            backgroundColor: "var(--canal-avoid-soft)",
            borderColor:
              "color-mix(in srgb, var(--canal-avoid) 35%, transparent)",
          }}
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {t("calibration.banner")}
            </span>
          </span>
          <InfoTooltip
            label={t("calibration.tooltipLabel")}
            description={t("calibration.tooltipDetail")}
            side="left"
          />
        </div>
      )}
    </div>
  );

  return (
    <FixtureCard
      fixture={`${group.homeTeam} vs ${group.awayTeam}`}
      homeLogo={group.homeLogo}
      awayLogo={group.awayLogo}
      competition={group.competitionName}
      country={group.country}
      kickoff={group.kickoff}
      score={group.score}
      htScore={group.htScore}
      locale={locale}
      className={cn(
        "transition-colors hover:border-border",
        avoid && "border-[color:var(--canal-avoid)]/40",
      )}
      beforeHeader={banners}
      headerExtra={
        <ConvictionBadge pickCount={picks.length} consensus={consensus} />
      }
      bodyClassName="flex flex-col gap-2 py-3"
    >
      <Separator />

      {picks.length > 0 ? (
        <div className="flex flex-col">
          {picks.map((decision, idx) => (
            <div key={decision.id} className="flex">
              {picks.length > 1 && (
                <LegConnector isLast={idx === picks.length - 1} />
              )}
              <div className="min-w-0 flex-1 border-t border-border/50 first:border-t-0">
                <ChannelRow
                  channel={decision.channel}
                  decision={decision}
                  locale={locale}
                  avoidEdge={avoidEdgeByChannel.get(decision.channel)}
                  slipContext={slipContext}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-1 text-xs text-muted-foreground/70">{t("noPick")}</p>
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
    </FixtureCard>
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
