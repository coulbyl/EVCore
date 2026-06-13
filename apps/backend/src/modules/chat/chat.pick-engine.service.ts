import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { formatDateUtc } from '@utils/date.utils';
import {
  SignalWindowService,
  type ScoredPick,
} from '@modules/ai-engine/signal-window.service';
import { CouponComposerService } from '@modules/ai-engine/coupon-composer.service';
import { CHAT_RANK_WEIGHTS } from './chat.constants';
import { round } from './chat.math';
import { simulateLadder } from './simulate-ladder';

type PickWithOdds = ScoredPick & { oddsSnapshot: number };

@Injectable()
export class ChatPickEngineService {
  constructor(
    private readonly signalWindow: SignalWindowService,
    private readonly composer: CouponComposerService,
  ) {}

  async getTopPicks(input: {
    from: string;
    to: string;
    perDay: number;
    profile?: 'fiable' | 'value';
  }) {
    const days = datesBetween(input.from, input.to).slice(0, 14);
    const window = await this.signalWindow.computeSignalWindow(30);
    const byDay: Array<{
      date: string;
      picks: ReturnType<typeof toCompactPick>[];
    }> = [];
    const allSelected: ScoredPick[] = [];

    for (const date of days) {
      const raw = await this.signalWindow.getTodayPool(date);
      const scored = this.composer
        .scorePicks(raw, window, date)
        .sort((a, b) => pickRank(b, input.profile) - pickRank(a, input.profile))
        .slice(0, input.perDay);
      allSelected.push(...scored);
      byDay.push({ date, picks: scored.map(toCompactPick) });
    }

    return {
      asOf: new Date().toISOString(),
      profile: input.profile ?? 'fiable',
      days: byDay,
      combined: summarizeCombined(allSelected),
    };
  }

  async getUpcomingPicks(input: {
    date?: string;
    canal?: string;
    limit: number;
  }) {
    const date = input.date ?? formatDateUtc(new Date());
    const window = await this.signalWindow.computeSignalWindow(30);
    const picks = this.composer
      .scorePicks(await this.signalWindow.getTodayPool(date), window, date)
      .filter((pick) => pick.scheduledAt.getTime() >= Date.now())
      .filter((pick) => !input.canal || pick.canal === input.canal)
      .sort((a, b) => pickRank(b, 'fiable') - pickRank(a, 'fiable'))
      .slice(0, input.limit);

    return {
      asOf: new Date().toISOString(),
      date,
      picks: picks.map(toCompactPick),
    };
  }

  // Whole montante in one deterministic call: the backend picks the legs and
  // computes the ladder — the LLM only narrates the result.
  async planLadder(input: {
    date?: string;
    stake: string;
    steps: number;
    canal?: string;
  }) {
    const date = input.date ?? formatDateUtc(new Date());
    const window = await this.signalWindow.computeSignalWindow(30);
    const candidates = this.composer
      .scorePicks(await this.signalWindow.getTodayPool(date), window, date)
      .filter((pick): pick is PickWithOdds => pick.oddsSnapshot !== null)
      .filter((pick) => pick.scheduledAt.getTime() >= Date.now())
      .filter((pick) => !input.canal || pick.canal === input.canal)
      .sort((a, b) => pickRank(b, 'fiable') - pickRank(a, 'fiable'));

    // One pick per fixture, most reliable first, then played in kickoff order.
    const seenFixtures = new Set<string>();
    const selected: PickWithOdds[] = [];
    for (const pick of candidates) {
      if (seenFixtures.has(pick.fixtureId)) continue;
      seenFixtures.add(pick.fixtureId);
      selected.push(pick);
      if (selected.length === input.steps) break;
    }

    if (selected.length === 0) {
      return {
        asOf: new Date().toISOString(),
        date,
        error: 'Aucun pick moteur avec cote disponible pour cette date.',
      };
    }

    const ordered = [...selected].sort(
      (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
    );
    const simulation = simulateLadder({
      stake: input.stake,
      steps: ordered.map((pick) => ({
        combinedOdds: String(pick.oddsSnapshot),
        jointProbability: String(round(pick.probability)),
      })),
    });

    return {
      asOf: new Date().toISOString(),
      date,
      requestedSteps: input.steps,
      availableSteps: ordered.length,
      picks: ordered.map(toCompactPick),
      simulation,
    };
  }

  async composeSelection(input: {
    date: string;
    targetOddsMin: number;
    targetOddsMax: number;
  }) {
    const window = await this.signalWindow.computeSignalWindow(30);
    const scored = this.composer.scorePicks(
      await this.signalWindow.getTodayPool(input.date),
      window,
      input.date,
    );
    const withOdds = scored.filter((pick) => pick.oddsSnapshot !== null);
    const coupon =
      this.composer
        .compose(withOdds)
        .find(
          (candidate) =>
            candidate.combinedOdds >= input.targetOddsMin &&
            candidate.combinedOdds <= input.targetOddsMax,
        ) ?? null;

    return {
      asOf: new Date().toISOString(),
      date: input.date,
      targetOddsMin: input.targetOddsMin,
      targetOddsMax: input.targetOddsMax,
      selection: coupon
        ? {
            combinedOdds: round(coupon.combinedOdds),
            jointProbability: round(coupon.jointProbability),
            signalScore: round(coupon.signalScore),
            legs: coupon.legs.map(toCompactPick),
          }
        : null,
    };
  }
}

function datesBetween(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const out: string[] = [];
  for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
    out.push(formatDateUtc(d));
  }
  return out;
}

function pickRank(pick: ScoredPick, profile: string | undefined): number {
  if (profile === 'value') {
    return new Decimal(pick.signalScore)
      .mul(CHAT_RANK_WEIGHTS.value.signalScore)
      .add(
        new Decimal(pick.probability).mul(CHAT_RANK_WEIGHTS.value.probability),
      )
      .toNumber();
  }
  return new Decimal(pick.probability).mul(pick.calibratedHitRate).toNumber();
}

export type CompactPick = ReturnType<typeof toCompactPick>;

function toCompactPick(pick: ScoredPick) {
  return {
    fixtureId: pick.fixtureId,
    date: pick.scheduledAt.toISOString(),
    match: `${pick.homeTeam} - ${pick.awayTeam}`,
    competition: pick.competition,
    country: pick.country,
    canal: pick.canal,
    market: pick.market,
    pick: pick.pick,
    probability: round(pick.probability),
    odds: pick.oddsSnapshot,
    reliability: round(pick.calibratedHitRate),
    signalScore: round(pick.signalScore),
  };
}

function summarizeCombined(picks: ScoredPick[]) {
  if (picks.length === 0) {
    return { count: 0, combinedOdds: null, jointProbability: null };
  }
  const odds = picks.some((pick) => pick.oddsSnapshot === null)
    ? null
    : product(picks.map((pick) => pick.oddsSnapshot ?? 1));
  return {
    count: picks.length,
    combinedOdds: odds === null ? null : round(odds),
    jointProbability: round(product(picks.map((pick) => pick.probability))),
  };
}

// Odds/probability math goes through decimal.js (EVCore hard rule).
function product(values: number[]): Decimal {
  return values.reduce((acc, value) => acc.mul(value), new Decimal(1));
}
