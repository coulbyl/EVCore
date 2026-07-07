import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import { formatKickoff } from "@/domains/fixture/helpers/fixture";
import type { CouponProposalDto } from "@/domains/coupon/types/coupon";
import {
  CouponCard as SharedCouponCard,
  type NormalizedCouponLeg,
} from "@/components/coupon-card";

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
    country: leg.country,
    competition: leg.competitionName,
    kickoff: formatKickoff(leg.scheduledAt),
    score: leg.score,
    htScore: leg.htScore,
    canal: leg.canal,
    marketLabel: formatMarketForDisplay(leg.market, loc),
    pickLabel: formatPickForDisplay(leg.pick, leg.market),
    probability: leg.probability,
    odds: leg.oddsSnapshot != null ? leg.oddsSnapshot.toFixed(2) : null,
    result:
      leg.isCorrect === true ? "WON" : leg.isCorrect === false ? "LOST" : null,
  }));

  return (
    <SharedCouponCard
      locale={locale}
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
