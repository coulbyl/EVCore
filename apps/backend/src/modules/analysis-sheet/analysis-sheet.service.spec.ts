import { describe, expect, it, vi } from 'vitest';
import { AnalysisSheetService } from './analysis-sheet.service';
import type { AnalysisSheetRepository } from './analysis-sheet.repository';
import type { AnalysisSheetRateLimitService } from './analysis-sheet.rate-limit.service';
import type { LlmClient } from './groq/groq-llm.types';
import { ANALYSIS_SHEET_LIMITS } from './analysis-sheet.constants';

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
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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
    const input = { from: '2026-06-20', to: '2026-06-27' };

    const json = await service.exportJson(input);
    expect(json.range).toEqual({ from: '2026-06-20', to: '2026-06-27' });

    const txt = await service.exportTxt(input);
    expect(txt).toContain("FICHE D'ANALYSE EVCORE");
  });

  it('rejects a date range wider than the configured cap before touching the repository', async () => {
    const { service, repository } = buildService();
    const from = '2026-01-01';
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
        from: '2026-06-20',
        to: '2026-06-27',
      }),
    ).rejects.toThrow();
    expect(repository.getFixturesInRange).not.toHaveBeenCalled();
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('analyzeWithEva sends the rendered sheet to the LLM and increments usage', async () => {
    const { service, llm, rateLimit } = buildService();

    const result = await service.analyzeWithEva('user-1', {
      from: '2026-06-20',
      to: '2026-06-27',
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
      from: '2026-06-20',
      to: '2026-06-27',
    });

    expect(result.truncated).toBe(true);
  });
});
