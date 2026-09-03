import { prisma, Prisma, CouponProposalStatus } from "@evcore/db";
import type { Market } from "@evcore/analysis-core";
import type { CouponClass } from "@evcore/analysis-core";
import type { ComposedCoupon } from "./validate-coupon-selection";

// Mirrors apps/backend's CouponRepository.upsertProposal (coupon.repository.ts)
// — same unique key, same "leave a human decision (ACCEPTED/REJECTED/EXPIRED)
// alone" guard, same deleteMany+recreate for legs on update — but writing
// through `@evcore/db`'s `prisma` client directly instead of going through
// apps/backend's NestJS PrismaService, same pattern as persist-decision.ts.
// See docs/vantage-centric-redesign-2026-09-01.md §9bis (Phase C):
// apps/vantage-worker owns CouponProposal/CouponProposalLeg persistence
// end to end now — apps/backend keeps only the read/display/rollback side.

/**
 * `coupon_proposal.signalWindowDays` — colonne NOT NULL et composante de la
 * clé unique, héritée de l'ancienne fenêtre glissante de 38 jours supprimée
 * le 2026-08-22 (voir CouponPoolService.computeLegCalibration). Ne décrit
 * plus rien : un discriminant constant, conservé pour ne pas exiger de
 * migration. Copié depuis apps/backend/src/modules/coupon/coupon.constants.ts's
 * COUPON_PARAMS.legacySignalWindowDays plutôt qu'importé — ce champ legacy
 * n'a aucune raison de vivre dans analysis-core, et apps/vantage-worker ne
 * dépend pas d'apps/backend.
 */
const LEGACY_SIGNAL_WINDOW_DAYS = 38;

/**
 * Une seule proposition par classe par jour dans ce pipeline — le LLM
 * produit un coupon par appel, pas un classement de plusieurs. `rank` reste
 * un paramètre (colonne NOT NULL, composante de la clé unique) plutôt qu'une
 * constante figée à 1 : si un futur besoin de plusieurs coupons par classe
 * apparaît, seul l'appelant change, pas ce fichier.
 */
export async function persistCouponProposal(
  forDate: Date,
  couponClass: CouponClass,
  coupon: ComposedCoupon,
  reasonDetails: string,
  rank = 1,
): Promise<void> {
  const toDecimal = (n: number) => new Prisma.Decimal(n);
  const toJson = (v: unknown) => v as Prisma.InputJsonValue;

  const where = {
    forDate_signalWindowDays_targetOddsMin_targetOddsMax_rank: {
      forDate,
      signalWindowDays: LEGACY_SIGNAL_WINDOW_DAYS,
      targetOddsMin: toDecimal(couponClass.targetOddsMin),
      targetOddsMax: toDecimal(couponClass.targetOddsMax),
      rank,
    },
  };

  const existing = await prisma.couponProposal.findUnique({
    where,
    select: { id: true, status: true },
  });

  // Preserve a human decision (ACCEPTED/REJECTED) or an already-EXPIRED
  // proposal — never silently overwrite it with a fresh LLM run.
  if (existing && existing.status !== CouponProposalStatus.PENDING) {
    return;
  }

  const lastFixtureScheduledAt = coupon.legs.reduce(
    (latest, leg) =>
      leg.candidate.scheduledAt > latest ? leg.candidate.scheduledAt : latest,
    coupon.legs[0]?.candidate.scheduledAt ?? forDate,
  );

  // signalScore's original meaning (a 38-day rolling hit-rate blend) is gone
  // since 2026-08-22 — the column now carries each leg's own calibrated
  // probability, and at coupon level, their mean. Same repurposing the
  // retired CouponComposerService already did (see its own doc comment,
  // preserved in coupon-composer.service.ts's git history).
  const meanCalibratedProbability =
    coupon.legs.reduce((sum, l) => sum + l.candidate.calibratedProbability, 0) /
    coupon.legs.length;

  const legData = coupon.legs.map((leg) => ({
    fixtureId: leg.candidate.fixtureId,
    canal: leg.candidate.canal,
    market: leg.candidate.market as Market,
    pick: leg.candidate.pick,
    probability: leg.candidate.calibratedProbability,
    oddsSnapshot: leg.candidate.oddsSnapshot,
    signalScore: leg.candidate.calibratedProbability,
    featureSnapshot: toJson({
      ...leg.candidate.featureSnapshot,
      calibratedProbability: leg.candidate.calibratedProbability,
      legEV: leg.candidate.legEV,
      edge: leg.candidate.edge,
      // The LLM's own qualitative note for this specific leg, in this
      // specific mix — never a number it computed, see selection-schema.ts.
      llmReasoning: leg.reasoning,
    }),
  }));

  const reasoning = toJson({
    couponClass: couponClass.name,
    legs: coupon.legs.map((leg) => ({
      fixture: `${leg.candidate.homeTeam} vs ${leg.candidate.awayTeam}`,
      canal: leg.candidate.canal,
      pick: `${leg.candidate.market}/${leg.candidate.pick}`,
      calibratedProbability: leg.candidate.calibratedProbability,
      oddsSnapshot: leg.candidate.oddsSnapshot,
      llmReasoning: leg.reasoning,
    })),
    combinedOdds: coupon.combinedOdds,
    rawJointProbability: coupon.rawJointProbability,
    jointProbability: coupon.jointProbability,
    couponEV: coupon.couponEV,
    llmReasonDetails: reasonDetails,
  });

  if (existing) {
    await prisma.couponProposalLeg.deleteMany({
      where: { couponProposalId: existing.id },
    });
    await prisma.couponProposal.update({
      where: { id: existing.id },
      data: {
        combinedOdds: toDecimal(coupon.combinedOdds),
        jointProbability: toDecimal(coupon.jointProbability),
        signalScore: toDecimal(meanCalibratedProbability),
        lastFixtureScheduledAt,
        reasoning,
        generatedAt: new Date(),
        legs: { create: legData },
      },
    });
    return;
  }

  await prisma.couponProposal.create({
    data: {
      forDate,
      rank,
      signalWindowDays: LEGACY_SIGNAL_WINDOW_DAYS,
      targetOddsMin: toDecimal(couponClass.targetOddsMin),
      targetOddsMax: toDecimal(couponClass.targetOddsMax),
      combinedOdds: toDecimal(coupon.combinedOdds),
      jointProbability: toDecimal(coupon.jointProbability),
      signalScore: toDecimal(meanCalibratedProbability),
      lastFixtureScheduledAt,
      reasoning,
      legs: { create: legData },
    },
  });
}
