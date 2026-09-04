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
export const LEGACY_SIGNAL_WINDOW_DAYS = 38;

/**
 * Discriminant du batch intraday (`run-coupon-generation.ts`'s
 * `runIntradayCouponGeneration`) — même colonne que ci-dessus, valeur
 * distincte pour que le batch intraday coexiste avec celui du soir sur la
 * même `forDate`/classe/`rank` au lieu de l'écraser. Exportée pour que le
 * seul autre fichier qui en a besoin (`run-coupon-generation.ts`) n'ait pas
 * à réinventer un nombre magique.
 */
export const INTRADAY_SIGNAL_WINDOW_DAYS = 39;

/**
 * Une seule proposition par classe par jour (par passage) dans ce pipeline —
 * le LLM produit un coupon par appel, pas un classement de plusieurs.
 * `rank` reste une donnée (colonne NOT NULL, composante de la clé unique)
 * plutôt qu'une constante figée à 1 : si un futur besoin de plusieurs
 * coupons par classe apparaît, seul l'appelant change, pas ce fichier.
 *
 * `signalWindowDays` — même colonne, même rôle de discriminant hérité sans
 * signification propre (voir LEGACY_SIGNAL_WINDOW_DAYS) — sert aussi à
 * distinguer le batch du soir (38, valeur historique) du batch intraday
 * (39, `run-coupon-generation.ts`'s `runIntradayCouponGeneration`) sur la
 * même `forDate`/classe/`rank` : sans ça, le batch intraday écraserait
 * silencieusement le batch du soir au lieu de coexister avec lui.
 */
export async function persistCouponProposal(
  forDate: Date,
  couponClass: CouponClass,
  coupon: ComposedCoupon,
  reasonDetails: string,
  opts: { rank?: number; signalWindowDays?: number } = {},
): Promise<void> {
  const rank = opts.rank ?? 1;
  const signalWindowDays = opts.signalWindowDays ?? LEGACY_SIGNAL_WINDOW_DAYS;
  const toDecimal = (n: number) => new Prisma.Decimal(n);
  const toJson = (v: unknown) => v as Prisma.InputJsonValue;

  const where = {
    forDate_signalWindowDays_targetOddsMin_targetOddsMax_rank: {
      forDate,
      signalWindowDays,
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
    // $transaction: a crash between the deleteMany and the update would
    // otherwise leave a CouponProposal with zero legs, silently — the
    // original apps/backend upsertProposal this mirrors had the same two
    // separate calls (verified: no $transaction anywhere in that history
    // either), a pre-existing gap fixed here rather than carried forward
    // into new code.
    await prisma.$transaction([
      prisma.couponProposalLeg.deleteMany({
        where: { couponProposalId: existing.id },
      }),
      prisma.couponProposal.update({
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
      }),
    ]);
    return;
  }

  await prisma.couponProposal.create({
    data: {
      forDate,
      rank,
      signalWindowDays,
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
