import { describe, expect, it } from 'vitest';
import { BetStatus, ModelRunPhase, StrategyChannel } from '@evcore/db';
import {
  latestPerFixtureChannel,
  type ChannelDecisionReadRow,
} from './channel-decision.repository';
import { CHANNEL_DECISION_STATUS } from './channel-strategy.types';

function row(
  overrides: Partial<ChannelDecisionReadRow>,
): ChannelDecisionReadRow {
  return {
    id: 'cd-1',
    modelRunId: 'mr-1',
    phase: ModelRunPhase.ADVANCE,
    analyzedAt: new Date('2026-06-30T14:00:00Z'),
    channel: StrategyChannel.VALUE,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    reasonCode: null,
    reasonDetails: null,
    fixtureId: 'fx-1',
    scheduledAt: new Date('2026-07-02T23:00:00Z'),
    homeTeam: 'Portugal',
    awayTeam: 'Croatia',
    homeLogo: null,
    awayLogo: null,
    competitionCode: 'WC',
    country: null,
    homeScore: null,
    awayScore: null,
    homeHtScore: null,
    awayHtScore: null,
    selections: [],
    result: null as unknown as BetStatus,
    ...overrides,
  } as ChannelDecisionReadRow;
}

describe('latestPerFixtureChannel', () => {
  it('keeps only the most recently analyzed decision per (fixture, channel)', () => {
    const rows = [
      row({
        id: 'cd-advance',
        modelRunId: 'mr-advance',
        analyzedAt: new Date('2026-06-30T14:00:00Z'),
      }),
      row({
        id: 'cd-pre-kickoff',
        modelRunId: 'mr-pre-kickoff',
        analyzedAt: new Date('2026-07-01T01:00:00Z'),
      }),
      row({
        id: 'cd-live',
        modelRunId: 'mr-live',
        analyzedAt: new Date('2026-07-02T22:55:00Z'),
      }),
    ];

    const result = latestPerFixtureChannel(rows);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cd-live');
  });

  it('does not merge across different channels or different fixtures', () => {
    const rows = [
      row({
        id: 'value-fx1',
        fixtureId: 'fx-1',
        channel: StrategyChannel.VALUE,
      }),
      row({ id: 'safe-fx1', fixtureId: 'fx-1', channel: StrategyChannel.SAFE }),
      row({
        id: 'value-fx2',
        fixtureId: 'fx-2',
        channel: StrategyChannel.VALUE,
      }),
    ];

    const result = latestPerFixtureChannel(rows);

    expect(result.map((r) => r.id).sort()).toEqual(
      ['safe-fx1', 'value-fx1', 'value-fx2'].sort(),
    );
  });

  it('is a no-op when there is only one analysis pass per fixture', () => {
    const rows = [row({ id: 'only-one' })];
    expect(latestPerFixtureChannel(rows)).toEqual(rows);
  });
});
