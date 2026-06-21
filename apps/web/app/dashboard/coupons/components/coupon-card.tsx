import { translateCountry, translateCompetition } from "@/lib/competition-i18n";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import type { CouponProposalDto } from "@/domains/coupon/types/coupon";
import {
  CouponCard as SharedCouponCard,
  type NormalizedCouponLeg,
} from "@/components/coupon-card";

const CANAL_COLOR: Record<string, string> = {
  VALUE: "var(--canal-ev)",
  SAFE: "var(--canal-sv)",
  DOMINANT: "var(--canal-conf)",
  BTTS: "var(--canal-btts)",
  DRAW: "var(--canal-draw)",
};

const CANAL_LABEL: Record<string, string> = {
  VALUE: "VALUE",
  SAFE: "SAFE",
  DOMINANT: "VICTOIRE",
  BTTS: "BTTS",
  DRAW: "DRAW",
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
