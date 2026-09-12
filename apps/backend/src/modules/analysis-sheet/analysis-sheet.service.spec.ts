import { describe, expect, it, vi } from 'vitest';
import { AnalysisSheetService } from './analysis-sheet.service';
import type { AnalysisSheetRepository } from './analysis-sheet.repository';
import type { AnalysisSheetV2Service } from './analysis-sheet-v2.service';
import { ANALYSIS_SHEET_LIMITS } from './analysis-sheet.constants';

function daysFromTodayIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function buildService(overrides?: { fixtures?: unknown[] }) {
  const repository = {
    getFixturesInRange: vi.fn().mockResolvedValue(overrides?.fixtures ?? []),
  } satisfies Partial<AnalysisSheetRepository>;

  // La v2 n'est sollicitée que par exportJsonV2 ; ces cas couvrent la v1, donc
  // un double suffisant plutôt qu'un vrai service et ses requêtes.
  const v2 = {
    build: vi.fn().mockResolvedValue({
      meta: { definitions: [], constants: {}, caveats: [] },
      extrasByFixture: new Map(),
      calibration: null,
      legPool: null,
    }),
  } satisfies Partial<AnalysisSheetV2Service>;

  const service = new AnalysisSheetService(
    repository as unknown as AnalysisSheetRepository,
    v2 as unknown as AnalysisSheetV2Service,
  );

  return { service, repository, v2 };
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
});
