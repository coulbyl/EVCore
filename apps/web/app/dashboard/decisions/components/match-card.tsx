import { Ban, Sparkles } from "lucide-react";
import { Card, Separator, cn } from "@evcore/ui";
import { useTranslations } from "next-intl";
import type { ChannelDecisionMatchDto } from "@/domains/channel-decision/types/channel-decision";
import { reasonLabel } from "./channel-constants";
import {
  avoidFlag,
  evaluatedRest,
  hasConsensus,
  selectedPicks,
} from "./decision-helpers";
import { ChannelRow } from "./channel-row";
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

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden border-border/70 p-0 transition-colors hover:border-border",
        avoid && "border-[color:var(--canal-avoid)]/40",
      )}
    >
      {avoid && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold"
          style={{
            color: "var(--canal-avoid)",
            backgroundColor: "var(--canal-avoid-soft)",
          }}
        >
          <Ban className="size-3.5 shrink-0" />
          <span className="truncate">
            {t("avoid.banner")}
            {reasonLabel(avoid.reasonCode, t)
              ? ` · ${reasonLabel(avoid.reasonCode, t)}`
              : ""}
          </span>
        </div>
      )}

      <div className={cn("flex flex-col gap-3 p-4", avoid && "opacity-60")}>
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

        <Separator />

        {/* Pick-first: the retained selections lead, prominently. */}
        {picks.length > 0 ? (
          <div className="flex flex-col divide-y divide-border/50">
            {picks.map((decision) => (
              <ChannelRow
                key={decision.id}
                channel={decision.channel}
                decision={decision}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <p className="py-1 text-xs text-muted-foreground/70">
            {t("noPick")}
          </p>
        )}

        {/* Evaluated-but-not-selected channels, collapsed (the noise). */}
        {rest.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none text-[0.7rem] text-muted-foreground/60 transition-colors hover:text-muted-foreground">
              {t("evaluatedCount", { count: rest.length })}
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
      </div>
    </Card>
  );
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
      )}
      <span className="text-[0.65rem] font-semibold tabular-nums text-foreground">
        {t("pickCount", { count: pickCount })}
      </span>
    </span>
  );
}
