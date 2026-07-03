import { describe, expect, it, vi } from 'vitest';
import { AnalysisSheetRepository } from './analysis-sheet.repository';
import type { PrismaService } from '@/prisma.service';

function buildRepository(rows: unknown[]) {
  const queryRaw = vi.fn().mockResolvedValue(rows);
  const prisma = {
    client: { $queryRaw: queryRaw },
  } as unknown as PrismaService;
  return { repository: new AnalysisSheetRepository(prisma), queryRaw };
}

describe('AnalysisSheetRepository.getFixturesInRange', () => {
  it('maps a raw row into a Decimal-safe AnalysisSheetFixture, tolerating both numeric and string json_agg values', async () => {
    const { repository } = buildRepository([
      {
        fixture_id: 'fx-1',
        scheduled_at: new Date('2026-06-20T15:00:00.000Z'),
        status: 'FINISHED',
        home_score: 2,
        away_score: 1,
        home_team: 'Arsenal',
        away_team: 'Chelsea',
        competition_code: 'PL',
        competition_name: 'Premier League',
        model_run_id: 'mr-1',
        analyzed_at: new Date('2026-06-20T10:00:00.000Z'),
        deterministic_score: '0.7100', // Postgres numeric may come back as a string
        final_score: 0.71, // ...or as a JSON number, depending on precision
        features: { predictionSource: 'POISSON_MAIN' },
        selections: [
          {
            channel: 'VALUE',
            decisionStatus: 'SELECTED',
            reasonCode: null,
            reasonDetails: null,
            market: 'ONE_X_TWO',
            pick: 'HOME',
            comboMarket: null,
            comboPick: null,
            probability: '0.5800',
            odds: 1.95,
            ev: '0.1320',
            qualityScore: 0.812,
            rank: 1,
            result: 'WON',
          },
        ],
      },
    ]);

    const fixtures = await repository.getFixturesInRange({
      range: { from: new Date('2026-06-20'), to: new Date('2026-06-27') },
    });

    expect(fixtures).toHaveLength(1);
    const [fixture] = fixtures;
    expect(fixture.deterministicScore).toBe(0.71);
    expect(typeof fixture.deterministicScore).toBe('number');
    expect(fixture.finalScore).toBe(0.71);
    expect(fixture.selections[0].probability).toBe(0.58);
    expect(typeof fixture.selections[0].probability).toBe('number');
    expect(fixture.selections[0].ev).toBe(0.132);
  });

  it('returns an empty selections array for a fixture with a model run but no channel decisions yet', async () => {
    const { repository } = buildRepository([
      {
        fixture_id: 'fx-2',
        scheduled_at: new Date('2026-06-20T15:00:00.000Z'),
        status: 'SCHEDULED',
        home_score: null,
        away_score: null,
        home_team: 'A',
        away_team: 'B',
        competition_code: 'PL',
        competition_name: 'Premier League',
        model_run_id: 'mr-2',
        analyzed_at: new Date('2026-06-20T10:00:00.000Z'),
        deterministic_score: 0.5,
        final_score: 0.5,
        features: null,
        selections: [],
      },
    ]);

    const fixtures = await repository.getFixturesInRange({
      range: { from: new Date('2026-06-20'), to: new Date('2026-06-27') },
    });

    expect(fixtures[0].selections).toEqual([]);
  });

  it('collapses multiple rolling-horizon passes of the same fixture into one AnalysisSheetFixture with priorPasses', async () => {
    const { repository } = buildRepository([
      {
        fixture_id: 'fx-1',
        scheduled_at: new Date('2026-07-02T23:00:00.000Z'),
        status: 'SCHEDULED',
        home_score: null,
        away_score: null,
        home_team: 'Portugal',
        away_team: 'Croatia',
        competition_code: 'WC',
        competition_name: 'World Cup',
        model_run_id: 'mr-advance',
        analyzed_at: new Date('2026-06-30T14:19:30.000Z'),
        phase: 'ADVANCE',
        deterministic_score: 0.5,
        final_score: 0.5,
        features: null,
        selections: [
          {
            channel: 'VALUE',
            decisionStatus: 'SELECTED',
            reasonCode: null,
            reasonDetails: null,
            market: 'DOUBLE_CHANCE',
            pick: 'X2',
            comboMarket: null,
            comboPick: null,
            probability: 0.44,
            odds: 3.5,
            ev: 0.53,
            qualityScore: null,
            rank: 1,
            result: null,
          },
          {
            channel: 'BTTS',
            decisionStatus: 'REJECTED',
            reasonCode: 'ev_below_threshold',
            reasonDetails: null,
            market: null,
            pick: null,
            comboMarket: null,
            comboPick: null,
            probability: null,
            odds: null,
            ev: null,
            qualityScore: null,
            rank: null,
            result: null,
          },
        ],
      },
      {
        fixture_id: 'fx-1',
        scheduled_at: new Date('2026-07-02T23:00:00.000Z'),
        status: 'SCHEDULED',
        home_score: null,
        away_score: null,
        home_team: 'Portugal',
        away_team: 'Croatia',
        competition_code: 'WC',
        competition_name: 'World Cup',
        model_run_id: 'mr-live',
        analyzed_at: new Date('2026-07-02T22:55:00.000Z'),
        phase: 'LIVE',
        deterministic_score: 0.55,
        final_score: 0.55,
        features: null,
        selections: [
          {
            channel: 'VALUE',
            decisionStatus: 'SELECTED',
            reasonCode: null,
            reasonDetails: null,
            market: 'DOUBLE_CHANCE',
            pick: 'X2',
            comboMarket: null,
            comboPick: null,
            probability: 0.48,
            odds: 3.2,
            ev: 0.53,
            qualityScore: null,
            rank: 1,
            result: null,
          },
        ],
      },
    ]);

    const fixtures = await repository.getFixturesInRange({
      range: { from: new Date('2026-06-20'), to: new Date('2026-07-02') },
    });

    expect(fixtures).toHaveLength(1);
    const [fixture] = fixtures;
    // The latest pass (LIVE) is the current state.
    expect(fixture.modelRunId).toBe('mr-live');
    expect(
      fixture.selections.find((s) => s.channel === 'VALUE')?.probability,
    ).toBe(0.48);
    // The earlier pass (ADVANCE) survives as compact history — only its
    // SELECTED picks, the REJECTED BTTS row is dropped.
    expect(fixture.priorPasses).toHaveLength(1);
    expect(fixture.priorPasses[0].phase).toBe('ADVANCE');
    expect(fixture.priorPasses[0].selectedPicks).toHaveLength(1);
    expect(fixture.priorPasses[0].selectedPicks[0].probability).toBe(0.44);
  });

  it('passes null (not undefined) for absent competitionCode/channel filters', async () => {
    const { repository, queryRaw } = buildRepository([]);

    await repository.getFixturesInRange({
      range: { from: new Date('2026-06-20'), to: new Date('2026-06-27') },
    });

    expect(queryRaw).toHaveBeenCalledOnce();
    const params = queryRaw.mock.calls[0].slice(1);
    // Prisma's tagged-template $queryRaw interleaves param values after the
    // strings array — every interpolated value here must be a concrete
    // value (Date or null), never undefined, or the query throws.
    expect(params.every((p: unknown) => p !== undefined)).toBe(true);
  });
});
