import { formatMarketForDisplay, formatPickForDisplay } from "@/helpers/fixture";
import type { InvestmentPickDto } from "@/domains/ai-engine/types/investment";
import { PickCard as SharedPickCard } from "@/components/pick-card";
import { CANAL_COLOR } from "./canal-constants";
import { SlipButton } from "./slip-button";

export function PickCard({
  pick,
  locale,
}: {
  pick: InvestmentPickDto;
  locale: string;
}) {
  const loc = locale === "en" ? "en" : "fr";
  const betStatus =
    pick.isCorrect === true
      ? "WON"
      : pick.isCorrect === false
        ? "LOST"
        : null;

  return (
    <SharedPickCard
      homeTeam={pick.homeTeam}
      awayTeam={pick.awayTeam}
      homeLogo={pick.homeLogo}
      awayLogo={pick.awayLogo}
      competition={pick.competition}
      country={pick.country}
      locale={locale}
      scheduledAt={pick.scheduledAt}
      canalColor={CANAL_COLOR[pick.canal]}
      marketLabel={formatMarketForDisplay(pick.market, loc)}
      pickLabel={formatPickForDisplay(pick.pick, pick.market)}
      probabilityPct={`${(pick.probability * 100).toFixed(1)}%`}
      odds={pick.oddsSnapshot != null ? pick.oddsSnapshot.toFixed(2) : null}
      score={pick.score}
      htScore={pick.htScore}
      betStatus={betStatus}
      reasoning={pick.reasoning}
      actionSlot={<SlipButton pick={pick} />}
    />
  );
}
