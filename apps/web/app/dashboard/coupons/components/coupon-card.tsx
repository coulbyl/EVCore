"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@evcore/ui";
import { formatMarketForDisplay, formatPickWithTeams } from "@/helpers/fixture";
import { formatKickoff } from "@/domains/fixture/helpers/fixture";
import type { CouponProposalDto } from "@/domains/coupon/types/coupon";
import { couponClassMeta } from "@/domains/coupon/helpers/coupon-class";
import { couponSourceMeta } from "@/domains/coupon/helpers/coupon-source";
import type { CouponClassTrackRecord } from "@/domains/coupon/use-cases/use-coupon-track-record";
import {
  useFollowCoupon,
  useRecordCouponView,
} from "@/domains/coupon/use-cases/use-coupons";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import {
  draftItemKey,
  type BetSlipDraftItem,
} from "@/domains/bet-slip/types/bet-slip";
import {
  CouponCard as SharedCouponCard,
  CouponFollowButton,
  CouponSlipButton,
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
  const {
    draft,
    removeItem,
    isInSlip,
    open,
    setCouponProposalId,
    replaceWithCoupon,
  } = useBetSlip();
  const t = useTranslations("couponCard");
  const [confirmReplace, setConfirmReplace] = useState(false);
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
    pickLabel: formatPickWithTeams(leg.pick, leg.market, {
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
      // Le prix 1xBet quand il est connu : c'est celui que le ticket paiera.
      odds:
        leg.playableOdds !== null
          ? leg.playableOdds.toFixed(2)
          : leg.oddsSnapshot != null
            ? leg.oddsSnapshot.toFixed(2)
            : null,
      ev: null,
      canal: leg.canal,
      stakeOverride: null,
    }));

  const allInSlip =
    slipItems.length > 0 &&
    slipItems.every((item) => isInSlip(draftItemKey(item)));

  // Sélections du ticket qui ne viennent pas de ce coupon : les écraser sans
  // prévenir ferait perdre au joueur ce qu'il était en train de composer.
  const couponKeys = new Set(slipItems.map(draftItemKey));
  const otherItems = draft.items.filter(
    (item) => !couponKeys.has(draftItemKey(item)),
  ).length;

  function playCoupon() {
    // Le ticket ne contient que ce coupon, en combiné dès 2 jambes ; l'id
    // part avec le ticket (POST /bet-slips) pour que le backend enregistre
    // un vrai CouponProposalPlacement (BetSlipService.create).
    replaceWithCoupon({ items: slipItems, couponProposalId: coupon.id });
    open();
  }

  function handlePlay() {
    if (allInSlip) {
      for (const item of slipItems) removeItem(draftItemKey(item));
      setCouponProposalId(null);
      return;
    }
    if (otherItems > 0) {
      setConfirmReplace(true);
      return;
    }
    playCoupon();
  }

  return (
    <>
      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("replaceTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("replaceDescription", { count: otherItems })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("replaceCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={playCoupon}>
              {t("replaceConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
          // Suivre d'abord (sans mise), puis déclarer qu'on l'a joué : la
          // saisie de coupon reste, en second (2026-10-28).
          isPending || coupon.playedByMe ? (
            <div className="flex flex-col gap-2">
              {isPending ? (
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
              {coupon.playedByMe ? (
                <CouponSlipButton allInSlip onPlay={handlePlay} playedByMe />
              ) : slipItems.length > 0 ? (
                <CouponSlipButton allInSlip={allInSlip} onPlay={handlePlay} />
              ) : null}
            </div>
          ) : null
        }
      />
    </>
  );
}
