"use client";

import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import { draftItemKey } from "@/domains/bet-slip/types/bet-slip";
import { translateCountry, translateCompetition } from "@/lib/competition-i18n";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import type { InvestmentCouponDto } from "@/domains/ai-engine/types/investment";
import {
  CouponCard as SharedCouponCard,
  CouponSlipButton,
  type NormalizedCouponLeg,
} from "@/components/coupon-card";
import { CANAL_COLOR, CANAL_LABEL } from "./canal-constants";

export function CouponCard({
  coupon,
  locale,
  isTop,
}: {
  coupon: InvestmentCouponDto;
  locale: string;
  isTop: boolean;
}) {
  const loc = locale === "en" ? "en" : "fr";
  const { clearDraft, addItem, setType, isInSlip, open } = useBetSlip();

  const isSettled = coupon.legs.some((l) => l.isCorrect !== null);
  const allInSlip = coupon.legs.every((l) =>
    isInSlip(
      draftItemKey({ fixtureId: l.fixtureId, market: l.market, pick: l.pick }),
    ),
  );

  function handlePlayCombo() {
    clearDraft();
    for (const leg of coupon.legs) {
      addItem({
        fixtureId: leg.fixtureId,
        fixture: `${leg.homeTeam} vs ${leg.awayTeam}`,
        homeLogo: leg.homeLogo,
        awayLogo: leg.awayLogo,
        competition: leg.competition,
        scheduledAt: leg.scheduledAt,
        market: leg.market,
        pick: leg.pick,
        odds: leg.oddsSnapshot != null ? leg.oddsSnapshot.toFixed(2) : null,
        ev: null,
        stakeOverride: null,
        ...(leg.betId
          ? { betId: leg.betId }
          : { modelRunId: leg.modelRunId ?? undefined }),
      });
    }
    setType("COMBO");
    open();
  }

  const legs: NormalizedCouponLeg[] = coupon.legs.map((leg) => ({
    key: `${leg.fixtureId}:${leg.canal}`,
    homeTeam: leg.homeTeam,
    awayTeam: leg.awayTeam,
    homeLogo: leg.homeLogo,
    awayLogo: leg.awayLogo,
    countryLabel: translateCountry(leg.country, locale),
    competitionLabel: translateCompetition(leg.competition, locale),
    canalColor: CANAL_COLOR[leg.canal],
    canalLabel: CANAL_LABEL[leg.canal],
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
      reasoning={coupon.reasoning}
      isTop={isTop}
      legs={legs}
      actionSlot={
        !isSettled ? (
          <CouponSlipButton allInSlip={allInSlip} onPlay={handlePlayCombo} />
        ) : null
      }
    />
  );
}
