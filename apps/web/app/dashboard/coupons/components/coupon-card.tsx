import { translateCountry, translateCompetition } from "@/lib/competition-i18n";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import type { CouponProposalDto } from "@/domains/ai-engine/types/coupon";
import {
  CouponCard as SharedCouponCard,
  type NormalizedCouponLeg,
} from "@/components/coupon-card";

const CANAL_COLOR: Record<string, string> = {
  EV: "var(--canal-ev)",
  SV: "var(--canal-sv)",
  CONF: "var(--canal-conf)",
  BB: "var(--canal-btts)",
  NUL: "var(--canal-draw)",
};

const CANAL_LABEL: Record<string, string> = {
  EV: "EV",
  SV: "SV",
  CONF: "VICTOIRE",
  BB: "BB",
  NUL: "NUL",
};

export function CouponCard({
  coupon,
  locale,
  isTop,
}: {
  coupon: CouponProposalDto;
  locale: string;
  isTop: boolean;
}) {
  const loc = locale === "en" ? "en" : "fr";
  const displayResult =
    coupon.result === "WON"
      ? "WON"
      : coupon.result === "LOST" || coupon.result === "PARTIAL"
        ? "LOST"
        : null;

  const legs: NormalizedCouponLeg[] = coupon.legs.map((leg) => ({
    key: leg.id,
    homeTeam: leg.homeTeam,
    awayTeam: leg.awayTeam,
    homeLogo: leg.homeLogo,
    awayLogo: leg.awayLogo,
    countryLabel: translateCountry(leg.country, locale),
    competitionLabel: translateCompetition(leg.competition, locale),
    canalColor: CANAL_COLOR[leg.canal] ?? "var(--canal-sv)",
    canalLabel: CANAL_LABEL[leg.canal] ?? leg.canal,
    marketLabel: formatMarketForDisplay(leg.market, loc),
    pickLabel: formatPickForDisplay(leg.pick, leg.market),
    odds: leg.oddsSnapshot != null ? leg.oddsSnapshot.toFixed(2) : null,
    isCorrect: leg.isCorrect,
  }));

  return (
    <SharedCouponCard
      rank={coupon.rank}
      combinedOdds={coupon.combinedOdds}
      jointProbability={coupon.jointProbability}
      signalScore={coupon.signalScore}
      isTop={isTop}
      betStatus={displayResult}
      legs={legs}
    />
  );
}
