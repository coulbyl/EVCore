"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatLinePick,
  formatMarketForDisplay,
  formatPickWithTeams,
} from "@/helpers/fixture";
import { formatKickoff } from "@/domains/fixture/helpers/fixture";
import type { CouponProposalDto } from "@/domains/coupon/types/coupon";
import { couponClassMeta } from "@/domains/coupon/helpers/coupon-class";
import { couponSourceMeta } from "@/domains/coupon/helpers/coupon-source";
import type { CouponClassTrackRecord } from "@/domains/coupon/use-cases/use-coupon-track-record";
import {
  useFollowCoupon,
  useRecordCouponView,
} from "@/domains/coupon/use-cases/use-coupons";
import {
  CouponCard as SharedCouponCard,
  CouponFollowButton,
  type NormalizedCouponLeg,
} from "@/components/coupon-card";

export function CouponCard({
  coupon,
  locale,
  trackRecord = null,
}: {
  coupon: CouponProposalDto;
  locale: string;
  trackRecord?: CouponClassTrackRecord | null;
}) {
  const loc = locale === "en" ? "en" : "fr";

  // Real, verifiable "view" (CouponProposalView, upserted server-side) —
  // once per mount is enough, the backend already dedupes per user.
  const recordView = useRecordCouponView();
  const follow = useFollowCoupon();
  const viewRecorded = useRef(false);
  useEffect(() => {
    if (viewRecorded.current) return;
    viewRecorded.current = true;
    recordView.mutate(coupon.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon.id]);
  // Les quatre issues sont distinctes à l'écran : un PARTIAL est un gain
  // payé à une cote réduite, un VOID un remboursement — les lire comme
  // « Gagné » ou ne rien lire trompait sur ce qui a été payé.
  const displayResult = coupon.result;

  const reasonDetails =
    typeof coupon.reasoning?.llmReasonDetails === "string"
      ? coupon.reasoning.llmReasonDetails
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
    pickLabel:
      formatLinePick(leg.pick, leg.market, leg.line) ??
      formatPickWithTeams(leg.pick, leg.market, {
        home: leg.homeTeam,
        away: leg.awayTeam,
      }),
    probability: leg.probability,
    marketProbability: leg.marketProbability,
    odds: leg.oddsSnapshot != null ? leg.oddsSnapshot.toFixed(2) : null,
    playable:
      leg.playableOdds !== null && leg.playableBookmaker !== null
        ? {
            odds: leg.playableOdds,
            bookmaker: leg.playableBookmaker,
            margin: leg.operatorMargin,
          }
        : null,
    // `isCorrect` null + `settledAt` posé = jambe remboursée (match reporté,
    // Draw No Bet sur un nul) ; null sans `settledAt` = pas encore réglée.
    result:
      leg.isCorrect === true
        ? "WON"
        : leg.isCorrect === false
          ? "LOST"
          : leg.settledAt !== null
            ? "VOID"
            : null,
    closing:
      leg.closingOdds !== null && leg.closingLineValue !== null
        ? {
            odds: leg.closingOdds,
            bookmaker: leg.closingBookmaker,
            value: leg.closingLineValue,
          }
        : null,
  }));

  // Following and "Je l'ai joué" only make sense while the proposal itself is still
  // PENDING — once ACCEPTED/REJECTED/EXPIRED its fixtures have moved on
  // (started/finished), same signal the settlement worker already uses to
  // stop touching a proposal (persist-coupon-proposal.ts).
  const isPending = coupon.status === "PENDING";
  // Le serveur refuse de suivre (ou de cesser de suivre) un coupon dont le
  // premier match a commencé (2026-10-30) : le bouton disparaît avant.
  const [openedAt] = useState(() => Date.now());
  const canFollow =
    isPending &&
    coupon.legs.every((leg) => new Date(leg.scheduledAt).getTime() > openedAt);


  return (
    <>
      <SharedCouponCard
        locale={locale}
        combinedOdds={coupon.combinedOdds}
        realizedOdds={coupon.realizedOdds}
        jointProbability={coupon.marketJointProbability}
        signalScore={coupon.signalScore}
        couponClass={couponClassMeta(coupon.couponClass)}
        trackRecord={trackRecord}
        source={couponSourceMeta(coupon.source)}
        reasoning={reasonDetails}
        batch={coupon.batch}
        betStatus={displayResult}
        legs={legs}
        actionSlot={
          // Suivre, sans mise : la déclaration d'un coupon joué est partie
          // avec les coupons déclarés (B15).
          isPending ? (
            <div className="flex flex-col gap-2">
              {canFollow ? (
                <CouponFollowButton
                  followed={coupon.followedByMe}
                  pending={follow.isPending}
                  onToggle={() =>
                    follow.mutate({
                      id: coupon.id,
                      follow: !coupon.followedByMe,
                    })
                  }
                />
              ) : null}
            </div>
          ) : null
        }
      />
    </>
  );
}
