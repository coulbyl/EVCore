import { ArrowUpRight } from "lucide-react";
import { Separator, cn } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { FixtureCard } from "@/components/fixture-card";
import { ResultBadge } from "@/components/result-badge";
import { OddsPair } from "@/components/odds-pair";
import { formatMarketForDisplay, formatPickWithTeams } from "@/helpers/fixture";
import { frequencyOf } from "@/lib/frequency";
import { CHANNEL_COLOR_SOFT } from "../../decisions/components/channel-constants";
import {
  citationDomain,
  formatDecidedAt,
  isGated,
  parseArbitrageReasonDetails,
  stripGateLead,
  verdictOf,
  type ArbitrageEntry,
} from "./arbitrage-constants";

/**
 * Un avis IA, lu comme un pari de Décisions : nommé avec les équipes, en
 * fréquence, cote jouable d'abord, note par cote quand nos pourcentages ont
 * été optimistes à cette cote. Plus de badge de fiabilité par championnat
 * (retiré de Décisions pour la même raison : il ne persiste pas d'une période
 * à l'autre). Sous l'avis, ce que dit Notre sélection sur le même match :
 * c'est la question du joueur sur cet écran (revue UX du 2026-10-27).
 */
export function ArbitrageCard({
  entry,
  locale,
}: {
  entry: ArbitrageEntry;
  locale: string;
}) {
  const t = useTranslations("arbitrage");
  const tDecisions = useTranslations("decisions");
  const loc = locale === "en" ? "en" : "fr";
  const teams = { home: entry.homeTeam, away: entry.awayTeam };
  const verdict = verdictOf(entry);
  const isPlay = verdict === "play";
  const gated = !isPlay && isGated(entry);
  const selection = entry.selections[0];
  const details = parseArbitrageReasonDetails(entry.reasonDetails);
  const text = details
    ? gated
      ? stripGateLead(details.text)
      : details.text
    : null;
  // L'IA ne porte pas toujours sa propre cote (avant le 2026-09-04, ou sur
  // un marché non couvert) : displayOdds reprend celle d'une lecture sœur.
  const priced = selection ? { ...selection, odds: entry.displayOdds } : null;
  const ours = entry.ourPick;
  const samePick =
    ours !== null &&
    selection !== undefined &&
    ours.market === selection.market &&
    ours.pick === selection.pick;

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
      className={cn(isPlay && "border-[color:var(--canal-vantage)]/30")}
      bodyClassName="flex flex-col gap-3 py-3.5"
    >
      <p
        data-testid="ai-verdict"
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.08em]",
          isPlay
            ? "text-[color:var(--canal-vantage)]"
            : "text-muted-foreground",
        )}
      >
        {isPlay
          ? t("verdict.play")
          : gated && entry.reasonCode
            ? tDecisions(`reasons.${entry.reasonCode}`)
            : t("verdict.noPlay")}
      </p>

      {isPlay && selection && priced && (
        <div className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-snug text-foreground">
              {formatPickWithTeams(selection.pick, selection.market, teams)}
            </p>
            <ResultBadge
              result={selection.result}
              finished={entry.fixtureStatus === "FINISHED"}
            />
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-snug text-muted-foreground">
            {selection.market !== "CORRECT_SCORE" && (
              <span>{formatMarketForDisplay(selection.market, loc)}</span>
            )}
            {/* Fréquence du marché, marge retirée (2026-10-28), comme en
                Décisions ; empruntée avec la cote quand l'IA n'en a pas. */}
            {entry.displayMarketProbability !== null ? (
              <span className="tabular-nums">
                {tDecisions(
                  "chances",
                  frequencyOf(entry.displayMarketProbability),
                )}
              </span>
            ) : null}
            <OddsPair selection={priced} locale={locale} />
          </p>
        </div>
      )}

      {isPlay && (
        <p
          data-testid="ai-vs-our-pick"
          className="rounded-xl bg-secondary/60 px-3 py-2 text-xs leading-snug text-muted-foreground"
        >
          {ours ? (
            <>
              {t("ourPick.label")}{" "}
              <span className="font-semibold text-foreground">
                {formatPickWithTeams(ours.pick, ours.market, teams)}
              </span>
              {ours.marketProbability !== null ? (
                <>
                  {", "}
                  {tDecisions("chances", frequencyOf(ours.marketProbability))}
                </>
              ) : null}
              {" · "}
              <span className="font-medium text-foreground">
                {samePick ? t("ourPick.same") : t("ourPick.different")}
              </span>
            </>
          ) : (
            t("ourPick.none")
          )}
        </p>
      )}

      <Separator />

      {text ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {t("reasoningLabel")}
          </span>
          <p className="text-sm leading-relaxed text-foreground">{text}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("noPlay")}</p>
      )}

      {details &&
        details.researchCitations &&
        details.researchCitations.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {t("sourcesLabel")}
            </span>
            {details.researchCitations.map((c) => (
              <a
                key={c.url}
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs"
                style={{ backgroundColor: CHANNEL_COLOR_SOFT.VANTAGE }}
              >
                {citationDomain(c.url)}
                <ArrowUpRight className="size-3" />
              </a>
            ))}
          </div>
        )}

      <p className="text-xs text-muted-foreground">
        {t("decidedAt", { date: formatDecidedAt(entry.decidedAt, locale) })}
      </p>
    </FixtureCard>
  );
}
