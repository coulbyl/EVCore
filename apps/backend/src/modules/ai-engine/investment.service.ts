import { Injectable } from '@nestjs/common';
import { createLogger } from '@utils/logger';
import { formatDateUtc } from '@utils/date.utils';
import { CacheService } from '@common/redis/cache.service';
import {
  INVESTMENT_PARAMS,
  MAX_INVESTMENT_SELECTIONS,
  VIRTUAL_INVESTMENT_RULES,
  VIRTUAL_INVESTMENT_TOP_LIMITS,
  type VirtualInvestmentCanal,
} from './investment.constants';
import { SignalWindowService } from './signal-window.service';
import {
  CouponComposerService,
  calibratedLegProbability,
} from './coupon-composer.service';
import type {
  Canal,
  ScoredPick,
  VirtualScoredPick,
} from './signal-window.service';
import type {
  InvestmentDayDto,
  InvestmentPickDto,
} from './dto/investment-day.dto';

const CACHE_TTL_PAST_SECONDS = 90 * 24 * 60 * 60; // 90 days
const CACHE_TTL_TODAY_SECONDS = 2 * 60 * 60; // 2 hours

const logger = createLogger('investment');

const MAX_SELECTIONS = MAX_INVESTMENT_SELECTIONS;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class InvestmentService {
  constructor(
    private readonly signalWindow: SignalWindowService,
    private readonly composer: CouponComposerService,
    private readonly cache: CacheService,
  ) {}

  // v7: invalidates the AI-curated entries left over from the Claude era.
  private cacheKey(date: string): string {
    return `investment:v7:${date}`;
  }

  private cacheTtl(date: string): number | null {
    const today = formatDateUtc(new Date());
    if (date < today) return CACHE_TTL_PAST_SECONDS;
    if (date === today) return CACHE_TTL_TODAY_SECONDS;
    return null; // future — no cache
  }

  private async getFromCache(date: string): Promise<InvestmentDayDto | null> {
    return this.cache.get<InvestmentDayDto>(this.cacheKey(date));
  }

  private async setCache(date: string, data: InvestmentDayDto): Promise<void> {
    const ttl = this.cacheTtl(date);
    if (ttl === null) return;
    await this.cache.set(this.cacheKey(date), data, ttl);
  }

  async getInvestmentDay(
    date: string,
    windowDays: number = INVESTMENT_PARAMS.windowDays,
  ): Promise<InvestmentDayDto> {
    const cached = await this.getFromCache(date);
    if (cached) {
      const today = formatDateUtc(new Date());
      // Today/future is stale-prone — always recompute; past days are settled.
      if (date < today) {
        logger.debug({ date }, 'Investment day served from cache');
        return cached;
      }
    }

    const [window, rawPicks] = await Promise.all([
      this.signalWindow.computeSignalWindow(windowDays),
      this.signalWindow.getTodayPool(date),
    ]);

    const scoredPicks = this.composer.scorePicks(rawPicks, window, date);
    const virtualPicks = this.buildVirtualPicks(scoredPicks);
    const totalCandidates = scoredPicks.length;

    if (totalCandidates === 0) {
      const empty = this.buildEmptyDay(date, windowDays);
      await this.setCache(date, empty);
      return empty;
    }

    const result = this.buildDeterministicDay(
      date,
      windowDays,
      totalCandidates,
      scoredPicks,
      virtualPicks,
    );

    await this.setCache(date, result);
    return result;
  }

  // ─── Response builders ─────────────────────────────────────────────────────

  // eslint-disable-next-line max-params
  private buildDeterministicDay(
    date: string,
    windowDays: number,
    totalCandidates: number,
    picks: ScoredPick[],
    virtualPicks: VirtualScoredPick[],
  ): InvestmentDayDto {
    // Sort by calibratedHitRate × signalScore desc. Both factors are
    // (canal, day)-level rates — constant across same-canal picks — so the
    // blended pick probability tie-break decides the per-canal selection
    // instead of DB insertion order.
    const ranked = [...picks].sort((a, b) => {
      const keyA = a.calibratedHitRate * a.signalScore;
      const keyB = b.calibratedHitRate * b.signalScore;
      if (keyB !== keyA) return keyB - keyA;
      return calibratedLegProbability(b) - calibratedLegProbability(a);
    });

    const selections: Record<Canal, InvestmentPickDto[]> = {
      SV: [],
      BB: [],
      CONF: [],
      NUL: [],
      EV: [],
    };

    for (const pick of ranked) {
      const bucket = selections[pick.canal];
      if (bucket.length < MAX_SELECTIONS[pick.canal]) {
        bucket.push(this.toPickDto(pick, null));
      }
    }

    const coupons = this.composer.compose(picks).map((c) => ({
      rank: c.rank,
      legs: c.legs.map((l) => ({
        fixtureId: l.fixtureId,
        homeTeam: l.homeTeam,
        awayTeam: l.awayTeam,
        homeLogo: l.homeLogo,
        awayLogo: l.awayLogo,
        competition: l.competition,
        country: l.country,
        scheduledAt: l.scheduledAt.toISOString(),
        canal: l.canal,
        market: l.market,
        pick: l.pick,
        oddsSnapshot: l.oddsSnapshot,
        isCorrect: l.isCorrect,
        calibratedHitRate: l.calibratedHitRate,
        betId: l.betId,
        modelRunId: l.modelRunId,
      })),
      combinedOdds: c.combinedOdds,
      jointProbability: c.jointProbability,
      signalScore: c.signalScore,
      reasoning: null,
    }));

    return {
      date,
      windowDays,
      isAiCurated: false,
      totalCandidates,
      selections,
      ...this.buildVirtualOutput(virtualPicks),
      coupons,
    };
  }

  private buildEmptyDay(date: string, windowDays: number): InvestmentDayDto {
    return {
      date,
      windowDays,
      isAiCurated: false,
      totalCandidates: 0,
      selections: { SV: [], BB: [], CONF: [], NUL: [], EV: [] },
      ...this.buildVirtualOutput([]),
      coupons: [],
    };
  }

  private buildVirtualOutput(
    virtualPicks: VirtualScoredPick[],
  ): Pick<
    InvestmentDayDto,
    'virtualSelections' | 'virtualTop5' | 'virtualTop10'
  > {
    const virtualSelections = {} as Record<
      VirtualInvestmentCanal,
      InvestmentPickDto[]
    >;
    for (const rule of VIRTUAL_INVESTMENT_RULES) {
      virtualSelections[rule.canal] = [];
    }

    const ranked = [...virtualPicks].sort(
      (a, b) => b.signalScore - a.signalScore,
    );

    for (const pick of ranked) {
      virtualSelections[pick.canal].push(
        this.toPickDto(
          pick,
          `Canal virtuel ${pick.virtualLabel} — score ${(pick.signalScore * 100).toFixed(0)}%.`,
        ),
      );
    }

    return {
      virtualSelections,
      virtualTop5: this.selectVirtualTop(
        ranked,
        VIRTUAL_INVESTMENT_TOP_LIMITS.top5,
      ).map((pick) => this.toPickDto(pick, null)),
      virtualTop10: this.selectVirtualTop(
        ranked,
        VIRTUAL_INVESTMENT_TOP_LIMITS.top10,
      ).map((pick) => this.toPickDto(pick, null)),
    };
  }

  private selectVirtualTop(
    picks: VirtualScoredPick[],
    limit: number,
  ): VirtualScoredPick[] {
    const selected: VirtualScoredPick[] = [];
    const fixtureIds = new Set<string>();
    const channelCounts = new Map<VirtualInvestmentCanal, number>();
    const isTop5 = limit <= VIRTUAL_INVESTMENT_TOP_LIMITS.top5;
    const globalCap = isTop5
      ? VIRTUAL_INVESTMENT_TOP_LIMITS.channelCapTop5
      : VIRTUAL_INVESTMENT_TOP_LIMITS.channelCapTop10;

    const ruleIndex = new Map(
      VIRTUAL_INVESTMENT_RULES.map((r) => [r.canal, r]),
    );

    for (const pick of picks) {
      if (selected.length >= limit) break;
      if (fixtureIds.has(pick.fixtureId)) continue;

      const rule = ruleIndex.get(pick.canal);
      const channelCap = isTop5
        ? (rule?.channelCapTop5 ?? globalCap)
        : (rule?.channelCapTop10 ?? globalCap);

      const count = channelCounts.get(pick.canal) ?? 0;
      if (count >= channelCap) continue;

      selected.push(pick);
      fixtureIds.add(pick.fixtureId);
      channelCounts.set(pick.canal, count + 1);
    }

    return selected;
  }

  private buildVirtualPicks(picks: ScoredPick[]): VirtualScoredPick[] {
    const virtualPicks: VirtualScoredPick[] = [];

    for (const pick of picks) {
      const rule =
        VIRTUAL_INVESTMENT_RULES.find((candidate) => {
          if (
            candidate.market !== pick.market ||
            candidate.pick !== pick.pick
          ) {
            return false;
          }
          const competitionCode =
            typeof pick.featureSnapshot['competitionCode'] === 'string'
              ? pick.featureSnapshot['competitionCode']
              : null;
          if (
            competitionCode !== null &&
            candidate.excludedLeagues?.includes(competitionCode)
          ) {
            return false;
          }
          if (pick.probability < candidate.minProbability) return false;
          if (pick.probability >= candidate.maxProbability) return false;
          if (
            candidate.excludedProbabilityRanges?.some(
              ([min, max]) => pick.probability >= min && pick.probability < max,
            )
          ) {
            return false;
          }
          if (!candidate.allowMissingOdds && pick.oddsSnapshot === null) {
            return false;
          }
          if (
            pick.oddsSnapshot !== null &&
            candidate.minOdds !== undefined &&
            pick.oddsSnapshot < candidate.minOdds
          ) {
            return false;
          }
          if (
            pick.oddsSnapshot !== null &&
            candidate.maxOdds !== undefined &&
            pick.oddsSnapshot >= candidate.maxOdds
          ) {
            return false;
          }
          if (
            candidate.minEvMargin !== undefined &&
            (pick.oddsSnapshot === null ||
              pick.probability - 1 / pick.oddsSnapshot < candidate.minEvMargin)
          ) {
            return false;
          }
          if (candidate.minLambda !== undefined) {
            const lambda =
              pick.lambdaHome !== null && pick.lambdaAway !== null
                ? pick.lambdaHome + pick.lambdaAway
                : null;
            if (lambda === null || lambda < candidate.minLambda) return false;
          }
          return true;
        }) ?? null;

      if (!rule) continue;

      const competitionCode =
        typeof pick.featureSnapshot['competitionCode'] === 'string'
          ? pick.featureSnapshot['competitionCode']
          : null;
      const leagueBoost =
        competitionCode !== null
          ? (rule.leagueBoosts?.[competitionCode] ?? 0)
          : 0;
      const oddsPenalty =
        pick.oddsSnapshot === null
          ? 0
          : Math.max(0, pick.oddsSnapshot - 1.4) * 0.02;
      const signalScore =
        rule.prior + leagueBoost + pick.probability * 0.08 - oddsPenalty;
      const calibratedHitRate = Math.min(
        INVESTMENT_PARAMS.capMax,
        Math.max(INVESTMENT_PARAMS.capMin, rule.prior + leagueBoost),
      );

      virtualPicks.push({
        ...pick,
        canal: rule.canal,
        virtualLabel: rule.label,
        calibratedHitRate,
        signalScore,
        featureSnapshot: {
          ...pick.featureSnapshot,
          virtualRule: rule.canal,
          virtualLabel: rule.label,
        },
      });
    }

    const selected: VirtualScoredPick[] = [];
    const counts = new Map<VirtualInvestmentCanal, number>();
    const seenFixturesByCanal = new Set<string>();

    for (const pick of virtualPicks.sort(
      (a, b) => b.signalScore - a.signalScore,
    )) {
      const count = counts.get(pick.canal) ?? 0;
      if (count >= 5) continue;

      const uniqueKey = `${pick.canal}:${pick.fixtureId}`;
      if (seenFixturesByCanal.has(uniqueKey)) continue;

      selected.push(pick);
      counts.set(pick.canal, count + 1);
      seenFixturesByCanal.add(uniqueKey);
    }

    return selected;
  }

  private toPickDto(
    pick: ScoredPick | VirtualScoredPick,
    reasoning: string | null,
  ): InvestmentPickDto {
    return {
      fixtureId: pick.fixtureId,
      homeTeam: pick.homeTeam,
      awayTeam: pick.awayTeam,
      homeLogo: pick.homeLogo,
      awayLogo: pick.awayLogo,
      competition: pick.competition,
      country: pick.country,
      scheduledAt: pick.scheduledAt.toISOString(),
      canal: pick.canal,
      market: pick.market,
      pick: pick.pick,
      probability: pick.probability,
      calibratedHitRate: pick.calibratedHitRate,
      oddsSnapshot: pick.oddsSnapshot,
      isCorrect: pick.isCorrect,
      signalScore: pick.signalScore,
      reasoning,
      betId: pick.betId,
      modelRunId: pick.modelRunId,
      score:
        pick.homeScore !== null && pick.awayScore !== null
          ? `${pick.homeScore} - ${pick.awayScore}`
          : null,
      htScore:
        pick.homeHtScore !== null && pick.awayHtScore !== null
          ? `${pick.homeHtScore} - ${pick.awayHtScore}`
          : null,
    };
  }
}
