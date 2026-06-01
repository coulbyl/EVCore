import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type Redis from 'ioredis';
import { z } from 'zod';
import { createLogger } from '@utils/logger';
import { formatDateUtc } from '@utils/date.utils';
import { REDIS_CLIENT } from '@common/redis/redis.module';
import {
  INVESTMENT_PARAMS,
  MAX_INVESTMENT_SELECTIONS,
  VIRTUAL_INVESTMENT_RULES,
  VIRTUAL_INVESTMENT_TOP_LIMITS,
  type VirtualInvestmentCanal,
} from './investment.constants';
import { SignalWindowService } from './signal-window.service';
import { CouponComposerService } from './coupon-composer.service';
import type {
  Canal,
  ScoredPick,
  VirtualScoredPick,
} from './signal-window.service';
import type {
  InvestmentDayDto,
  InvestmentPickDto,
  InvestmentCouponDto,
  InvestmentLegDto,
} from './dto/investment-day.dto';

const CACHE_TTL_PAST_SECONDS = 90 * 24 * 60 * 60; // 90 days
const CACHE_TTL_TODAY_SECONDS = 2 * 60 * 60; // 2 hours

const logger = createLogger('investment');

const MAX_SELECTIONS = MAX_INVESTMENT_SELECTIONS;

// ─── Claude I/O types ────────────────────────────────────────────────────────

type InvestmentFixtureInput = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  scheduledAt: string;
  model: {
    lambdaHome: number | null;
    lambdaAway: number | null;
    probHome: number | null;
    probDraw: number | null;
    probAway: number | null;
    probBttsYes: number | null;
    probOver25: number | null;
    recentForm: number | null;
  };
  candidatePicks: {
    canal: Canal;
    market: string;
    pick: string;
    probability: number;
    calibratedHitRate: number;
    oddsSnapshot: number | null;
  }[];
  calibration: {
    calibratedHitRateCanal: number;
    signalScore: number;
  };
};

const ClaudeSelectionItemSchema = z.object({
  fixtureId: z.string(),
  reasoning: z.string(),
});

const CanalSchema = z.enum(['EV', 'SV', 'BB', 'NUL', 'CONF']);

const ClaudeLegSchema = z.object({
  fixtureId: z.string(),
  canal: CanalSchema,
});

const ClaudeCouponSchema = z.object({
  rank: z.number().int().min(1).max(3),
  legs: z.array(ClaudeLegSchema).min(2).max(3),
  reasoning: z.string(),
});

const ClaudeOutputSchema = z.object({
  selections: z.object({
    SV: z.array(ClaudeSelectionItemSchema),
    BB: z.array(ClaudeSelectionItemSchema),
    CONF: z.array(ClaudeSelectionItemSchema),
    NUL: z.array(ClaudeSelectionItemSchema),
    EV: z.array(ClaudeSelectionItemSchema),
  }),
  coupons: z.array(ClaudeCouponSchema).max(3),
});

type ClaudeOutput = z.infer<typeof ClaudeOutputSchema>;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class InvestmentService {
  private readonly client: Anthropic;
  private readonly model: string;

  // eslint-disable-next-line max-params
  constructor(
    private readonly signalWindow: SignalWindowService,
    private readonly composer: CouponComposerService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.client = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY', ''),
    });
    this.model = this.config.get<string>(
      'AI_MODEL',
      'claude-haiku-4-5-20251001',
    );
  }

  private cacheKey(date: string): string {
    return `investment:v4:${date}`;
  }

  private cacheTtl(date: string): number | null {
    const today = formatDateUtc(new Date());
    if (date < today) return CACHE_TTL_PAST_SECONDS;
    if (date === today) return CACHE_TTL_TODAY_SECONDS;
    return null; // future — no cache
  }

  private async getFromCache(date: string): Promise<InvestmentDayDto | null> {
    try {
      const raw = await this.redis.get(this.cacheKey(date));
      if (!raw) return null;
      return JSON.parse(raw) as InvestmentDayDto;
    } catch {
      return null;
    }
  }

  private async setCache(date: string, data: InvestmentDayDto): Promise<void> {
    const ttl = this.cacheTtl(date);
    if (ttl === null) return;
    try {
      await this.redis.set(
        this.cacheKey(date),
        JSON.stringify(data),
        'EX',
        ttl,
      );
    } catch {
      // cache write failure is non-blocking
    }
  }

  async getInvestmentDay(
    date: string,
    windowDays: number = INVESTMENT_PARAMS.windowDays,
  ): Promise<InvestmentDayDto> {
    const cached = await this.getFromCache(date);
    if (cached) {
      const today = formatDateUtc(new Date());
      // Deterministic cache for today/future is stale-prone — always recompute.
      // AI-curated cache is expensive to produce and stable enough to serve.
      const serveFromCache = date < today || cached.isAiCurated;
      if (serveFromCache) {
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

    // Try Claude — fallback to deterministic on any failure
    let claudeOutput: ClaudeOutput | null = null;
    try {
      claudeOutput = await this.callClaude(scoredPicks, date);
      claudeOutput = this.validateInvariants(claudeOutput, scoredPicks);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        { date, err: msg },
        'Claude call failed — using deterministic fallback',
      );
      claudeOutput = null;
    }

    const result =
      claudeOutput !== null
        ? this.buildAiCuratedDay(
            date,
            windowDays,
            totalCandidates,
            scoredPicks,
            virtualPicks,
            claudeOutput,
          )
        : this.buildDeterministicDay(
            date,
            windowDays,
            totalCandidates,
            scoredPicks,
            virtualPicks,
          );

    await this.setCache(date, result);
    return result;
  }

  // ─── Claude call ───────────────────────────────────────────────────────────

  private async callClaude(
    picks: ScoredPick[],
    date: string,
  ): Promise<ClaudeOutput> {
    const fixtures = this.buildFixtureInputs(picks);

    const systemPrompt = `You are a sports data analyst evaluating statistical predictions for football matches.
Your task is to assess the statistical quality of model predictions and identify the most reliable selections based on calibrated hit rates and signal scores.
You work with structured probability data — not betting advice. Focus on minimizing statistical uncertainty.`;

    const userPrompt = `Date: ${date}

Evaluate the following fixture predictions and select the highest-quality combinations.

Rules:
- Select at most: SV=5, BB=5, CONF=5, NUL=2, EV=2 picks per canal
- Compose exactly 3 coupons with 2-3 legs each (max combinedOdds = ${INVESTMENT_PARAMS.maxCombinedOdds})
- No two legs from the same fixtureId in a coupon
- No two legs with the same canal+market in a coupon
- Prioritize diversity of competitions across coupon legs
- Exclude picks with low calibratedHitRate, incoherent lambdas, or poor recentForm
- Respond ONLY with valid JSON matching the schema

Schema:
{
  "selections": {
    "SV": [{ "fixtureId": "...", "reasoning": "short statistical rationale" }],
    "BB": [...], "CONF": [...], "NUL": [...], "EV": [...]
  },
  "coupons": [
    { "rank": 1, "legs": [{ "fixtureId": "...", "canal": "SV" }], "reasoning": "..." },
    ...
  ]
}

Fixtures:
${JSON.stringify(fixtures, null, 2)}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text block');
    }

    const raw = textBlock.text.trim();
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Claude response contains no JSON object');
    }

    const parsed: unknown = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    return ClaudeOutputSchema.parse(parsed);
  }

  // ─── Business invariant validation ─────────────────────────────────────────

  private validateInvariants(
    output: ClaudeOutput,
    picks: ScoredPick[],
  ): ClaudeOutput {
    const pickIndex = new Map<string, ScoredPick>();
    for (const p of picks) {
      pickIndex.set(`${p.fixtureId}:${p.canal}`, p);
    }
    const fixtureIds = new Set(picks.map((p) => p.fixtureId));

    // Validate selections: only real fixtureIds, only real canals present in pool
    for (const canal of ['SV', 'BB', 'CONF', 'NUL', 'EV'] as Canal[]) {
      const items = output.selections[canal];
      for (const item of items) {
        if (!fixtureIds.has(item.fixtureId)) {
          throw new Error(
            `Selection invariant: unknown fixtureId ${item.fixtureId} for canal ${canal}`,
          );
        }
        if (!pickIndex.has(`${item.fixtureId}:${canal}`)) {
          throw new Error(
            `Selection invariant: no ${canal} pick for fixture ${item.fixtureId}`,
          );
        }
      }
      // Enforce max per canal
      output.selections[canal] = items.slice(0, MAX_SELECTIONS[canal]);
    }

    // Validate coupons
    for (const coupon of output.coupons) {
      const legFixtures = new Set<string>();
      const canalMarkets = new Set<string>();

      for (const leg of coupon.legs) {
        if (!fixtureIds.has(leg.fixtureId)) {
          throw new Error(
            `Coupon invariant: unknown fixtureId ${leg.fixtureId}`,
          );
        }
        if (legFixtures.has(leg.fixtureId)) {
          throw new Error(
            `Coupon invariant: duplicate fixtureId ${leg.fixtureId}`,
          );
        }
        legFixtures.add(leg.fixtureId);

        // Resolve market from pool
        const pick = pickIndex.get(`${leg.fixtureId}:${leg.canal}`);
        if (!pick) {
          throw new Error(
            `Coupon invariant: no ${leg.canal} pick for fixture ${leg.fixtureId}`,
          );
        }
        const cmKey = `${leg.canal}:${pick.market}`;
        if (canalMarkets.has(cmKey)) {
          throw new Error(`Coupon invariant: duplicate canal+market ${cmKey}`);
        }
        canalMarkets.add(cmKey);
      }

      // Recompute combinedOdds server-side — never trust Claude's value
      const combinedOdds = coupon.legs.reduce((acc, leg) => {
        const pick = pickIndex.get(`${leg.fixtureId}:${leg.canal}`);
        const odds = pick?.oddsSnapshot ?? null;
        return acc * (odds ?? 1.0);
      }, 1);
      if (combinedOdds > INVESTMENT_PARAMS.maxCombinedOdds) {
        throw new Error(
          `Coupon invariant: recomputed combinedOdds ${combinedOdds.toFixed(2)} exceeds max`,
        );
      }
    }

    return output;
  }

  // ─── Response builders ─────────────────────────────────────────────────────

  // eslint-disable-next-line max-params
  private buildAiCuratedDay(
    date: string,
    windowDays: number,
    totalCandidates: number,
    picks: ScoredPick[],
    virtualPicks: VirtualScoredPick[],
    output: ClaudeOutput,
  ): InvestmentDayDto {
    const pickIndex = new Map<string, ScoredPick>();
    for (const p of picks) {
      pickIndex.set(`${p.fixtureId}:${p.canal}`, p);
    }

    const reasoningMap = new Map<string, string>();
    for (const canal of ['SV', 'BB', 'CONF', 'NUL', 'EV'] as Canal[]) {
      for (const item of output.selections[canal]) {
        reasoningMap.set(`${item.fixtureId}:${canal}`, item.reasoning);
      }
    }

    const selections: Record<Canal, InvestmentPickDto[]> = {
      SV: [],
      BB: [],
      CONF: [],
      NUL: [],
      EV: [],
    };

    for (const canal of ['SV', 'BB', 'CONF', 'NUL', 'EV'] as Canal[]) {
      for (const item of output.selections[canal]) {
        const pick = pickIndex.get(`${item.fixtureId}:${canal}`);
        if (!pick) continue;
        selections[canal].push(this.toPickDto(pick, item.reasoning));
      }
    }

    const coupons: InvestmentCouponDto[] = output.coupons.map((c) => {
      const legPicks = c.legs
        .map((l) => pickIndex.get(`${l.fixtureId}:${l.canal}`))
        .filter((p): p is ScoredPick => p !== undefined);

      const combinedOdds = legPicks.reduce(
        (acc, p) => acc * (p.oddsSnapshot ?? 1.0),
        1,
      );
      const jointProbability = legPicks.reduce(
        (acc, p) => acc * p.calibratedHitRate,
        1,
      );
      const signalScore =
        legPicks.reduce((acc, p) => acc + p.signalScore, 0) /
        Math.max(1, legPicks.length);

      const legs: InvestmentLegDto[] = legPicks.map((p) => ({
        fixtureId: p.fixtureId,
        homeTeam: p.homeTeam,
        awayTeam: p.awayTeam,
        homeLogo: p.homeLogo,
        awayLogo: p.awayLogo,
        competition: p.competition,
        country: p.country,
        scheduledAt: p.scheduledAt.toISOString(),
        canal: p.canal,
        market: p.market,
        pick: p.pick,
        oddsSnapshot: p.oddsSnapshot,
        isCorrect: p.isCorrect,
        calibratedHitRate: p.calibratedHitRate,
        betId: p.betId,
        modelRunId: p.modelRunId,
      }));

      return {
        rank: c.rank,
        legs,
        combinedOdds,
        jointProbability,
        signalScore,
        reasoning: c.reasoning,
      };
    });

    return {
      date,
      windowDays,
      isAiCurated: true,
      totalCandidates,
      selections,
      ...this.buildVirtualOutput(virtualPicks),
      coupons,
    };
  }

  // eslint-disable-next-line max-params
  private buildDeterministicDay(
    date: string,
    windowDays: number,
    totalCandidates: number,
    picks: ScoredPick[],
    virtualPicks: VirtualScoredPick[],
  ): InvestmentDayDto {
    // Sort by calibratedHitRate × signalScore desc
    const ranked = [...picks].sort(
      (a, b) =>
        b.calibratedHitRate * b.signalScore -
        a.calibratedHitRate * a.signalScore,
    );

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

  private buildVirtualOutput(virtualPicks: VirtualScoredPick[]): Pick<
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
      virtualTop5: this.selectVirtualTop(ranked, VIRTUAL_INVESTMENT_TOP_LIMITS.top5).map(
        (pick) => this.toPickDto(pick, null),
      ),
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
    const channelCap =
      limit <= VIRTUAL_INVESTMENT_TOP_LIMITS.top5
        ? VIRTUAL_INVESTMENT_TOP_LIMITS.channelCapTop5
        : VIRTUAL_INVESTMENT_TOP_LIMITS.channelCapTop10;

    for (const pick of picks) {
      if (selected.length >= limit) break;
      if (fixtureIds.has(pick.fixtureId)) continue;

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
          if (candidate.market !== pick.market || candidate.pick !== pick.pick) {
            return false;
          }
          if (pick.probability < candidate.minProbability) return false;
          if (pick.probability >= candidate.maxProbability) return false;
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
          return true;
        }) ?? null;

      if (!rule) continue;

      const competitionCode =
        typeof pick.featureSnapshot['competitionCode'] === 'string'
          ? (pick.featureSnapshot['competitionCode'] as string)
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

  // ─── Build Claude input ────────────────────────────────────────────────────

  private buildFixtureInputs(picks: ScoredPick[]): InvestmentFixtureInput[] {
    const byFixture = new Map<string, ScoredPick[]>();
    for (const pick of picks) {
      const bucket = byFixture.get(pick.fixtureId) ?? [];
      bucket.push(pick);
      byFixture.set(pick.fixtureId, bucket);
    }

    const fixtures: InvestmentFixtureInput[] = [];
    for (const [fixtureId, fixturePicks] of byFixture) {
      const ref = fixturePicks[0];
      const probs = ref.modelProbabilities;

      fixtures.push({
        fixtureId,
        homeTeam: ref.homeTeam,
        awayTeam: ref.awayTeam,
        competition: ref.competition,
        scheduledAt: ref.scheduledAt.toISOString(),
        model: {
          lambdaHome: ref.lambdaHome,
          lambdaAway: ref.lambdaAway,
          probHome: probs['home'] ?? null,
          probDraw: probs['draw'] ?? null,
          probAway: probs['away'] ?? null,
          probBttsYes: probs['bttsYes'] ?? null,
          probOver25: probs['over25'] ?? null,
          recentForm: ref.recentForm,
        },
        candidatePicks: fixturePicks.map((p) => ({
          canal: p.canal,
          market: p.market,
          pick: p.pick,
          probability: p.probability,
          calibratedHitRate: p.calibratedHitRate,
          oddsSnapshot: p.oddsSnapshot,
        })),
        calibration: {
          calibratedHitRateCanal: ref.calibratedHitRate,
          signalScore: ref.signalScore,
        },
      });
    }

    return fixtures;
  }
}
