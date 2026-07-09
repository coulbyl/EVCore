import Decimal from 'decimal.js';
import { z } from 'zod';
import { EV_THRESHOLD } from '@modules/betting-engine/ev.constants';
import { pickLabel } from '@utils/pick-labels.utils';
import { ANALYSIS_SHEET_COUPONS } from './analysis-sheet.constants';
import type {
  AnalysisSheetJson,
  AnalysisSheetJsonFixture,
  AnalysisSheetJsonPick,
} from './analysis-sheet.render';

// Eva proposes coupons as a fenced ```evcore-coupons``` JSON block at the end
// of her markdown answer, referencing legs ONLY by fixtureId + channel. The
// backend resolves every leg against the sheet it built itself: odds,
// probabilities, EV, eligibility and all arithmetic come from here — never
// from the LLM. A coupon with a single invalid leg is dropped entirely (a
// coupon minus one leg is a different bet, silently repricing it would lie).

const couponBlockSchema = z.object({
  coupons: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        legs: z
          .array(
            z.object({
              fixtureId: z.string().min(1),
              channel: z.string().min(1),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .max(8),
});

export type EvaCouponLeg = {
  fixtureId: string;
  match: string;
  competition: string;
  kickoff: string;
  channel: string;
  market: string;
  pick: string;
  pickLabel: string;
  probability: number;
  odds: number;
  ev: number;
};

export type EvaCoupon = {
  label: string;
  legs: EvaCouponLeg[];
  totalOdds: number;
  // All three are null when the user gave no target win amount.
  stake: number | null;
  potentialPayout: number | null;
  netGain: number | null;
};

export type DroppedEvaCoupon = {
  label: string;
  reasonCode:
    | 'unknown_fixture'
    | 'fixture_settled'
    | 'fixture_flagged'
    | 'unknown_pick'
    | 'observation_only'
    | 'missing_odds'
    | 'insufficient_history'
    | 'ev_below_threshold'
    | 'duplicate_fixture'
    | 'leg_count_out_of_bounds';
};

export type ResolvedEvaCoupons = {
  // The raw analysis with every ```evcore-coupons``` block stripped out.
  analysis: string;
  coupons: EvaCoupon[];
  droppedCoupons: DroppedEvaCoupon[];
};

const COUPON_BLOCK_PATTERN = /```evcore-coupons\s*([\s\S]*?)```/g;

export function resolveEvaCoupons(input: {
  rawAnalysis: string;
  sheet: AnalysisSheetJson;
  targetWinAmount?: number;
}): ResolvedEvaCoupons {
  const { rawAnalysis, sheet, targetWinAmount } = input;
  const blocks = [...rawAnalysis.matchAll(COUPON_BLOCK_PATTERN)];
  const analysis = rawAnalysis.replace(COUPON_BLOCK_PATTERN, '').trimEnd();

  const firstBlock = blocks[0]?.[1];
  if (firstBlock === undefined) {
    return { analysis, coupons: [], droppedCoupons: [] };
  }

  const parsed = parseCouponBlock(firstBlock);
  if (parsed === null) {
    return { analysis, coupons: [], droppedCoupons: [] };
  }

  const coupons: EvaCoupon[] = [];
  const droppedCoupons: DroppedEvaCoupon[] = [];
  for (const proposal of parsed.coupons) {
    if (coupons.length >= ANALYSIS_SHEET_COUPONS.maxCoupons) break;
    const outcome = resolveCoupon(proposal, sheet);
    if ('reasonCode' in outcome) {
      droppedCoupons.push({
        label: proposal.label,
        reasonCode: outcome.reasonCode,
      });
      continue;
    }
    coupons.push(priceCoupon(proposal.label, outcome.legs, targetWinAmount));
  }

  return { analysis, coupons, droppedCoupons };
}

function parseCouponBlock(
  block: string,
): z.infer<typeof couponBlockSchema> | null {
  try {
    return couponBlockSchema.parse(JSON.parse(block));
  } catch {
    return null;
  }
}

type CouponProposal = z.infer<typeof couponBlockSchema>['coupons'][number];

function resolveCoupon(
  proposal: CouponProposal,
  sheet: AnalysisSheetJson,
): { legs: EvaCouponLeg[] } | { reasonCode: DroppedEvaCoupon['reasonCode'] } {
  const { minLegs, maxLegs } = ANALYSIS_SHEET_COUPONS;
  if (proposal.legs.length < minLegs || proposal.legs.length > maxLegs) {
    return { reasonCode: 'leg_count_out_of_bounds' };
  }
  const seenFixtures = new Set<string>();
  const legs: EvaCouponLeg[] = [];
  for (const ref of proposal.legs) {
    if (seenFixtures.has(ref.fixtureId)) {
      return { reasonCode: 'duplicate_fixture' };
    }
    seenFixtures.add(ref.fixtureId);

    const fixture = sheet.fixtures.find((f) => f.fixtureId === ref.fixtureId);
    if (!fixture) return { reasonCode: 'unknown_fixture' };
    const legOutcome = resolveLeg(fixture, ref.channel);
    if ('reasonCode' in legOutcome) return legOutcome;
    legs.push(legOutcome.leg);
  }
  return { legs };
}

function resolveLeg(
  fixture: AnalysisSheetJsonFixture,
  channel: string,
): { leg: EvaCouponLeg } | { reasonCode: DroppedEvaCoupon['reasonCode'] } {
  if (fixture.score !== null) return { reasonCode: 'fixture_settled' };
  if (fixture.avoidFlag !== null || fixture.calibrationAlert !== null) {
    return { reasonCode: 'fixture_flagged' };
  }
  const pick = fixture.selectedPicks.find((p) => p.channel === channel);
  if (!pick) return { reasonCode: 'unknown_pick' };
  if (pick.observationOnly) return { reasonCode: 'observation_only' };
  if (pick.odds === null) return { reasonCode: 'missing_odds' };
  if (pick.history.length < ANALYSIS_SHEET_COUPONS.minHistorySnapshots) {
    return { reasonCode: 'insufficient_history' };
  }
  if (new Decimal(pick.ev).lessThan(EV_THRESHOLD)) {
    return { reasonCode: 'ev_below_threshold' };
  }
  return { leg: toLeg(fixture, pick, pick.odds) };
}

function toLeg(
  fixture: AnalysisSheetJsonFixture,
  pick: AnalysisSheetJsonPick,
  odds: number,
): EvaCouponLeg {
  return {
    fixtureId: fixture.fixtureId,
    match: fixture.match,
    competition: fixture.competition,
    kickoff: fixture.kickoff,
    channel: pick.channel,
    market: pick.market,
    pick: pick.pick,
    pickLabel: pickLabel({
      market: pick.market,
      pick: pick.pick,
      comboMarket: pick.comboMarket,
      comboPick: pick.comboPick,
    }),
    probability: pick.probability,
    odds,
    ev: pick.ev,
  };
}

// stake = target / (totalOdds − 1), rounded UP to the stake unit so the net
// gain always covers the target. decimal.js everywhere — CLAUDE.md forbids
// native-number odds/bankroll arithmetic.
function priceCoupon(
  label: string,
  legs: EvaCouponLeg[],
  targetWinAmount?: number,
): EvaCoupon {
  const totalOdds = legs
    .reduce((acc, leg) => acc.mul(new Decimal(leg.odds)), new Decimal(1))
    .toDecimalPlaces(2, Decimal.ROUND_DOWN);

  if (targetWinAmount === undefined || totalOdds.lessThanOrEqualTo(1)) {
    return {
      label,
      legs,
      totalOdds: totalOdds.toNumber(),
      stake: null,
      potentialPayout: null,
      netGain: null,
    };
  }

  const unit = new Decimal(ANALYSIS_SHEET_COUPONS.stakeRoundingUnit);
  const stake = new Decimal(targetWinAmount)
    .div(totalOdds.minus(1))
    .div(unit)
    .toDecimalPlaces(0, Decimal.ROUND_UP)
    .mul(unit);
  const payout = stake.mul(totalOdds).toDecimalPlaces(0, Decimal.ROUND_DOWN);

  return {
    label,
    legs,
    totalOdds: totalOdds.toNumber(),
    stake: stake.toNumber(),
    potentialPayout: payout.toNumber(),
    netGain: payout.minus(stake).toNumber(),
  };
}
