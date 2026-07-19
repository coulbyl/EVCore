import { describe, expect, it, vi } from 'vitest';
import { AnalysisSheetService } from './analysis-sheet.service';
import type { AnalysisSheetRepository } from './analysis-sheet.repository';
import type { AnalysisSheetRateLimitService } from './analysis-sheet.rate-limit.service';
import type { LlmClient } from './groq/groq-llm.types';
import { ANALYSIS_SHEET_LIMITS } from './analysis-sheet.constants';

function daysFromTodayIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function buildService(overrides?: {
  fixtures?: unknown[];
  usageRequests?: number;
  llmContent?: string;
}) {
  const repository = {
    getFixturesInRange: vi.fn().mockResolvedValue(overrides?.fixtures ?? []),
  } satisfies Partial<AnalysisSheetRepository>;

  const rateLimit = {
    getUsageRequests: vi.fn().mockResolvedValue(overrides?.usageRequests ?? 0),
    incrementUsage: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<AnalysisSheetRateLimitService>;

  const llm = {
    complete: vi.fn().mockResolvedValue({
      content: overrides?.llmContent ?? 'Analyse Eva',
      model: 'openai/gpt-oss-120b',
      usage: { inputTokens: 100, outputTokens: 50 },
    }),
  } satisfies LlmClient;

  const service = new AnalysisSheetService(
    repository as unknown as AnalysisSheetRepository,
    rateLimit as unknown as AnalysisSheetRateLimitService,
    llm,
  );

  return { service, repository, rateLimit, llm };
}

describe('AnalysisSheetService', () => {
  it('exportJson/exportTxt delegate to the correct renderer', async () => {
    const { service } = buildService();
    const input = { from: daysFromTodayIso(0), to: daysFromTodayIso(7) };

    const json = await service.exportJson(input);
    expect(json.range).toEqual(input);

    const txt = await service.exportTxt(input);
    expect(txt).toContain("FICHE D'ANALYSE EVCORE");
  });

  it('rejects a date range wider than the configured cap before touching the repository', async () => {
    const { service, repository } = buildService();
    const from = daysFromTodayIso(0);
    const to = new Date(
      Date.parse(from) + (ANALYSIS_SHEET_LIMITS.maxRangeDays + 1) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);

    await expect(service.exportJson({ from, to })).rejects.toThrow();
    expect(repository.getFixturesInRange).not.toHaveBeenCalled();
  });

  it('analyzeWithEva checks quota before building the sheet or calling Groq', async () => {
    const { service, repository, llm } = buildService({
      usageRequests: ANALYSIS_SHEET_LIMITS.defaultDailyLimit,
    });

    await expect(
      service.analyzeWithEva('user-1', {
        from: daysFromTodayIso(0),
        to: daysFromTodayIso(7),
      }),
    ).rejects.toThrow();
    expect(repository.getFixturesInRange).not.toHaveBeenCalled();
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('analyzeWithEva sends the rendered sheet to the LLM and increments usage', async () => {
    const { service, llm, rateLimit } = buildService();

    const result = await service.analyzeWithEva('user-1', {
      from: daysFromTodayIso(0),
      to: daysFromTodayIso(7),
    });

    expect(llm.complete).toHaveBeenCalledOnce();
    const call = llm.complete.mock.calls[0][0];
    expect(call.messages[1]!.content).toContain("FICHE D'ANALYSE EVCORE");
    expect(result.analysis).toBe('Analyse Eva');
    expect(result.truncated).toBe(false);
    expect(rateLimit.incrementUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        inputTokens: 100,
        outputTokens: 50,
      }),
    );
  });

  it('flags truncated: true when the range yields more fixtures than the analysis cap', async () => {
    const manyFixtures = Array.from(
      { length: ANALYSIS_SHEET_LIMITS.maxFixturesForAnalysis + 5 },
      (_, i) => ({
        fixtureId: `fx-${i}`,
        scheduledAt: new Date('2026-06-20T15:00:00.000Z'),
        status: 'FINISHED',
        homeScore: null,
        awayScore: null,
        homeTeam: 'A',
        awayTeam: 'B',
        competitionCode: 'PL',
        competitionName: 'Premier League',
        modelRunId: `mr-${i}`,
        analyzedAt: new Date('2026-06-20T10:00:00.000Z'),
        deterministicScore: 0.6,
        finalScore: 0.6,
        features: null,
        selections: [],
      }),
    );
    const { service } = buildService({ fixtures: manyFixtures });

    const result = await service.analyzeWithEva('user-1', {
      from: daysFromTodayIso(0),
      to: daysFromTodayIso(7),
    });

    expect(result.truncated).toBe(true);
  });

  it('resolves the evcore-coupons block against the sheet, prices it, and strips it from the analysis', async () => {
    const upcomingFixture = {
      fixtureId: 'fx-coupon',
      scheduledAt: new Date(Date.now() + 86_400_000),
      status: 'SCHEDULED',
      homeScore: null,
      awayScore: null,
      homeTeam: 'Kongsvinger',
      awayTeam: 'Sogndal',
      competitionCode: 'NOR2',
      competitionName: 'OBOS-ligaen',
      modelRunId: 'mr-1',
      analyzedAt: new Date(),
      deterministicScore: 0.66,
      finalScore: 0.66,
      features: null,
      selections: [
        {
          channel: 'SAFE',
          decisionStatus: 'SELECTED',
          reasonCode: null,
          reasonDetails: null,
          market: 'ONE_X_TWO',
          pick: 'HOME',
          probability: 0.9,
          odds: 1.5,
          ev: 0.35,
          qualityScore: 0.23,
          rank: 1,
          result: null,
        },
        {
          channel: 'GOALS',
          decisionStatus: 'SELECTED',
          reasonCode: null,
          reasonDetails: null,
          market: 'OVER_UNDER',
          pick: 'OVER',
          probability: 0.7,
          odds: 1.61,
          ev: 0.11,
          qualityScore: null,
          rank: 1,
          result: null,
        },
      ],
      priorPasses: [
        {
          modelRunId: 'mr-0',
          analyzedAt: new Date('2026-06-30T00:00:00.000Z'),
          phase: 'ADVANCE',
          selectedPicks: [
            {
              channel: 'SAFE',
              decisionStatus: 'SELECTED',
              reasonCode: null,
              reasonDetails: null,
              market: 'ONE_X_TWO',
              pick: 'HOME',
              probability: 0.88,
              odds: 1.55,
              ev: 0.31,
              qualityScore: 0.2,
              rank: 1,
              result: null,
            },
          ],
        },
        {
          modelRunId: 'mr-0b',
          analyzedAt: new Date('2026-07-01T00:00:00.000Z'),
          phase: 'ADVANCE',
          selectedPicks: [
            {
              channel: 'SAFE',
              decisionStatus: 'SELECTED',
              reasonCode: null,
              reasonDetails: null,
              market: 'ONE_X_TWO',
              pick: 'HOME',
              probability: 0.89,
              odds: 1.52,
              ev: 0.33,
              qualityScore: 0.21,
              rank: 1,
              result: null,
            },
          ],
        },
      ],
    };
    const block = `Analyse pro.\n\n\`\`\`evcore-coupons\n{"coupons":[{"label":"Solide","legs":[{"fixtureId":"fx-coupon","channel":"SAFE"},{"fixtureId":"fx-coupon","channel":"GOALS"}]}]}\n\`\`\``;
    const { service, llm } = buildService({
      fixtures: [upcomingFixture],
      llmContent: block,
    });

    const result = await service.analyzeWithEva('user-1', {
      from: daysFromTodayIso(0),
      to: daysFromTodayIso(7),
      targetWinAmount: 300_000,
    });

    // The target is forwarded to Eva so she can shape coupon profiles…
    const call = llm.complete.mock.calls[0][0];
    expect(call.messages[1]!.content).toContain(
      "Objectif de gain net de l'utilisateur : 300000",
    );
    // …but two legs on one fixture is invalid: the engine drops the coupon.
    expect(result.coupons).toEqual([]);
    expect(result.droppedCoupons).toEqual([
      { label: 'Solide', reasonCode: 'duplicate_fixture' },
    ]);
    expect(result.targetWinAmount).toBe(300_000);
    expect(result.analysis).toBe('Analyse pro.');
  });
});
