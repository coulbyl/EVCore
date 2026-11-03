import { describe, expect, it } from 'vitest';
import { FixtureStatus } from '@evcore/db';
import { matchFactsOf } from './match-facts.repository';

const row = (
  overrides: Partial<Parameters<typeof matchFactsOf>[0]> = {},
): Parameters<typeof matchFactsOf>[0] => ({
  id: 'f1',
  status: FixtureStatus.FINISHED,
  homeTeamId: 'home',
  awayTeamId: 'away',
  homeScore: 1,
  awayScore: 0,
  eventsSyncedAt: new Date('2026-11-03T04:00:00Z'),
  fixtureStatistics: [
    { teamId: 'home', type: 'corner_kicks', value: '7' },
    { teamId: 'away', type: 'corner_kicks', value: '2' },
    { teamId: 'home', type: 'shots_on_goal', value: '4.000' },
  ],
  events: [
    {
      teamId: 'home',
      ordinal: 0,
      minute: 30,
      extraMinute: null,
      type: 'GOAL',
      detail: 'Normal Goal',
      comments: null,
      playerExternalId: 11,
      playerName: 'K. Konsa',
      assistExternalId: null,
    },
  ],
  lineups: [
    { teamId: 'home', playerExternalId: 11, starter: true },
    { teamId: 'other', playerExternalId: 99, starter: true },
  ],
  playerStatistics: [
    {
      teamId: 'away',
      playerExternalId: 20,
      minutes: 90,
      shotsTotal: null,
      shotsOn: 0,
    },
  ],
  ...overrides,
});

describe('matchFactsOf', () => {
  it('maps teams to sides and statistics to counts, unknown as null', () => {
    const facts = matchFactsOf(row());
    expect(facts.score).toEqual({ home: 1, away: 0 });
    expect(facts.teams).toEqual({
      home: { corners: 7, shotsTotal: null, shotsOn: 4 },
      away: { corners: 2, shotsTotal: null, shotsOn: null },
    });
    expect(facts.events?.[0]).toMatchObject({ side: 'home', minute: 30 });
    // A row of a team that is neither side is dropped.
    expect(facts.lineups).toEqual([
      { side: 'home', playerExternalId: 11, starter: true },
    ]);
    expect(facts.playerStats).toEqual([
      {
        side: 'away',
        playerExternalId: 20,
        minutes: 90,
        shotsTotal: null,
        shotsOn: 0,
      },
    ]);
  });

  it('no score before the end of the match', () => {
    expect(
      matchFactsOf(row({ status: FixtureStatus.IN_PROGRESS })).score,
    ).toBeNull();
  });

  it('no event row is « none » once synced, « unknown » before', () => {
    expect(matchFactsOf(row({ events: [] })).events).toEqual([]);
    expect(
      matchFactsOf(row({ events: [], eventsSyncedAt: null })).events,
    ).toBeNull();
  });

  it('no lineup or player statistic row is unknown', () => {
    const facts = matchFactsOf(row({ lineups: [], playerStatistics: [] }));
    expect(facts.lineups).toBeNull();
    expect(facts.playerStats).toBeNull();
  });
});
