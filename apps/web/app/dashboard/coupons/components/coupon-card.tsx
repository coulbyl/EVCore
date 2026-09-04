"use client";

import { useEffect, useRef } from "react";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import { formatKickoff } from "@/domains/fixture/helpers/fixture";
import type { CouponProposalDto } from "@/domains/coupon/types/coupon";
import { couponClassMeta } from "@/domains/coupon/helpers/coupon-class";
import { useRecordCouponView } from "@/domains/coupon/use-cases/use-coupons";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import {
  draftItemKey,
  type BetSlipDraftItem,
} from "@/domains/bet-slip/types/bet-slip";
import {
  CouponCard as SharedCouponCard,
  CouponSlipButton,
  type NormalizedCouponLeg,
} from "@/components/coupon-card";

export function CouponCard({
  coupon,
  locale,
}: {
  coupon: CouponProposalDto;
  locale: string;
}) {
  const {
    draft,
    addItem,
    removeItem,
    isInSlip,
    open,
    setType,
    setCouponProposalId,
  } = useBetSlip();
  const loc = locale === "en" ? "en" : "fr";

  // Real, verifiable "view" (CouponProposalView, upserted server-side) —
  // once per mount is enough, the backend already dedupes per user.
  const recordView = useRecordCouponView();
  const viewRecorded = useRef(false);
  useEffect(() => {
    if (viewRecorded.current) return;
    viewRecorded.current = true;
    recordView.mutate(coupon.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon.id]);
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
    marketLabel: formatMarketForDisplay(leg.market, loc),
    pickLabel: formatPickForDisplay(leg.pick, leg.market),
    probability: leg.probability,
    odds: leg.oddsSnapshot != null ? leg.oddsSnapshot.toFixed(2) : null,
    result:
      leg.isCorrect === true ? "WON" : leg.isCorrect === false ? "LOST" : null,
  }));

  // "Jouer ce coupon" only makes sense while the proposal itself is still
  // PENDING — once ACCEPTED/REJECTED/EXPIRED its fixtures have moved on
  // (started/finished), same signal the settlement worker already uses to
  // stop touching a proposal (persist-coupon-proposal.ts).
  const isPending = coupon.status === "PENDING";

  // Legs without a resolvable modelRunId (should be rare — see
  // CouponLegDto.modelRunId's own doc comment) simply can't be added; the
  // rest go to the bet slip as USER picks, same shape AddToSlipButton
  // (Matchs) already submits.
  const slipItems: BetSlipDraftItem[] = coupon.legs
    .filter(
      (leg): leg is typeof leg & { modelRunId: string } =>
        leg.modelRunId !== null,
    )
    .map((leg) => ({
      modelRunId: leg.modelRunId,
      fixtureId: leg.fixtureId,
      fixture: `${leg.homeTeam} vs ${leg.awayTeam}`,
      homeLogo: leg.homeLogo,
      awayLogo: leg.awayLogo,
      competition: leg.competitionName,
      scheduledAt: leg.scheduledAt,
      market: leg.market,
      pick: leg.pick,
      odds: leg.oddsSnapshot != null ? leg.oddsSnapshot.toFixed(2) : null,
      ev: null,
      canal: leg.canal,
      stakeOverride: null,
    }));

  const allInSlip =
    slipItems.length > 0 &&
    slipItems.every((item) => isInSlip(draftItemKey(item)));

  function handlePlay() {
    if (allInSlip) {
      for (const item of slipItems) removeItem(draftItemKey(item));
      setCouponProposalId(null);
      return;
    }
    const shouldOpen = draft.items.length === 0;
    for (const item of slipItems) addItem(item);
    // A coupon's legs are meant to be played together — default the slip to
    // COMBO rather than leaving it on SIMPLE (its default), same rule
    // AddToSlipButton's flow doesn't need since it only ever adds one leg
    // at a time. normalizeDraft (use-bet-slip-draft.ts) falls back to SIMPLE
    // on its own if fewer than 2 items end up in the slip.
    if (slipItems.length >= 2) setType("COMBO");
    // Submitted along with the draft (POST /bet-slips) so the backend can
    // record a real CouponProposalPlacement — see BetSlipService.create.
    setCouponProposalId(coupon.id);
    if (shouldOpen) open();
  }

  return (
    <SharedCouponCard
      locale={locale}
      combinedOdds={coupon.combinedOdds}
      jointProbability={coupon.jointProbability}
      signalScore={coupon.signalScore}
      couponClass={couponClassMeta(coupon.couponClass)}
      batch={coupon.batch}
      viewerCount={coupon.viewerCount}
      playerCount={coupon.playerCount}
      betStatus={displayResult}
      legs={legs}
      actionSlot={
        coupon.playedByMe ? (
          <CouponSlipButton allInSlip onPlay={handlePlay} playedByMe />
        ) : isPending && slipItems.length > 0 ? (
          <CouponSlipButton allInSlip={allInSlip} onPlay={handlePlay} />
        ) : null
      }
    />
  );
}
