import { ArrowUpRight } from "lucide-react";
import { Separator, cn } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { FixtureCard } from "@/components/fixture-card";
import { ResultBadge } from "@/components/result-badge";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import {
  CHANNEL_COLOR,
  CHANNEL_COLOR_SOFT,
  formatPct,
  formatOdds,
} from "../../decisions/components/channel-constants";
import {
  citationDomain,
  formatDecidedAtTime,
  parseArbitrageReasonDetails,
  verdictOf,
  type ArbitrageEntry,
} from "./arbitrage-constants";

export function ArbitrageCard({
  entry,
  locale,
}: {
  entry: ArbitrageEntry;
  locale: string;
}) {
  const t = useTranslations("arbitrage");
  const loc = locale === "en" ? "en" : "fr";
  const verdict = verdictOf(entry);
  const isPlay = verdict === "play";
  const selection = entry.selections[0];
  const details = parseArbitrageReasonDetails(entry.reasonDetails);
  const odds = formatOdds(entry.borrowedOdds);

  return (
    <FixtureCard
      fixture={`${entry.homeTeam} vs ${entry.awayTeam}`}
      homeLogo={entry.homeLogo}
      awayLogo={entry.awayLogo}
      competition={entry.competitionName}
      country={entry.country}
      kickoff={entry.kickoff}
      score={entry.score}
      htScore={entry.htScore}
      status={entry.fixtureStatus}
      locale={locale}
      className={cn(
        isPlay ? "border-[color:var(--canal-vantage)]/30" : undefined,
      )}
      bodyClassName="flex flex-col gap-3 py-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide",
              isPlay
                ? "text-[color:var(--background)]"
                : "border text-muted-foreground",
            )}
            style={
              isPlay
                ? { backgroundColor: CHANNEL_COLOR.VANTAGE }
                : { borderColor: "var(--border)" }
            }
          >
            {isPlay ? t("filters.play") : t("filters.noPlay")}
          </span>
          {isPlay && selection && (
            <span className="text-sm font-semibold text-foreground">
              {formatMarketForDisplay(selection.market, loc)} ·{" "}
              {formatPickForDisplay(selection.pick, selection.market)}
            </span>
          )}
          {isPlay && selection && (
            <ResultBadge
              result={selection.result}
              market={selection.market}
              finished={entry.fixtureStatus === "FINISHED"}
            />
          )}
        </div>
        {isPlay && selection && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {formatPct(selection.probability)}
            </span>
            {odds !== null && (
              <span className="rounded-md bg-secondary/60 px-2 py-0.5 font-semibold tabular-nums text-foreground">
                {odds}
              </span>
            )}
          </div>
        )}
      </div>

      <Separator />

      {details ? (
        <div className="flex flex-col gap-1.5">
          <span
            className="text-[0.62rem] font-bold uppercase tracking-wide"
            style={{ color: CHANNEL_COLOR.VANTAGE }}
          >
            {t("reasoningLabel")}
          </span>
          <p className="text-sm leading-relaxed text-foreground">
            {details.text}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/70">{t("noPlay")}</p>
      )}

      {details &&
        details.researchCitations &&
        details.researchCitations.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[0.68rem] text-muted-foreground">
              {t("sourcesLabel")}
            </span>
            {details.researchCitations.map((c) => (
              <a
                key={c.url}
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.68rem]"
                style={{ backgroundColor: CHANNEL_COLOR_SOFT.VANTAGE }}
              >
                {citationDomain(c.url)}
                <ArrowUpRight className="size-2.5" />
              </a>
            ))}
          </div>
        )}

      <p className="text-[0.66rem] text-muted-foreground/60">
        {t("decidedAt", { time: formatDecidedAtTime(entry.decidedAt, locale) })}
      </p>
    </FixtureCard>
  );
}
