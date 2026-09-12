import { describe, expect, it } from 'vitest';
import {
  buildH2HAggregates,
  buildH2HBlock,
  buildH2HScoreExplanation,
  toMeeting,
  type H2HFixtureRow,
} from './h2h-context.builder';

const HOME = 'team-home';
const AWAY = 'team-away';

function meetingRow(overrides: Partial<H2HFixtureRow> = {}): H2HFixtureRow {
  return {
    fixtureId: 'fx',
    scheduledAt: new Date('2026-01-10T15:00:00.000Z'),
    competitionCode: 'PL',
    competitionName: 'Premier League',
    homeTeamId: HOME,
    awayTeamId: AWAY,
    homeScore: 1,
    awayScore: 0,
    homeHtScore: 1,
    awayHtScore: 0,
    ...overrides,
  };
}

describe('toMeeting', () => {
  it('garde les scores dans l’ordre quand le receveur du match décrit recevait déjà', () => {
    const meeting = toMeeting(meetingRow({ homeScore: 3, awayScore: 1 }), HOME);

    expect(meeting.venueForHomeTeam).toBe('HOME');
    expect(meeting.score).toEqual({ homeTeam: 3, awayTeam: 1 });
  });

  it('inverse les scores quand les rôles étaient inversés', () => {
    // Le receveur du match décrit (HOME) se déplaçait ce jour-là et a perdu 3-1.
    const meeting = toMeeting(
      meetingRow({
        homeTeamId: AWAY,
        awayTeamId: HOME,
        homeScore: 3,
        awayScore: 1,
        homeHtScore: 2,
        awayHtScore: 0,
      }),
      HOME,
    );

    expect(meeting.venueForHomeTeam).toBe('AWAY');
    expect(meeting.score).toEqual({ homeTeam: 1, awayTeam: 3 });
    expect(meeting.halfTimeScore).toEqual({ homeTeam: 0, awayTeam: 2 });
  });

  it('rend halfTimeScore null quand le score à la pause manque', () => {
    const meeting = toMeeting(
      meetingRow({ homeHtScore: null, awayHtScore: null }),
      HOME,
    );

    expect(meeting.halfTimeScore).toBeNull();
  });
});

describe('buildH2HAggregates', () => {
  it('compte les victoires du point de vue du receveur du match décrit', () => {
    const meetings = [
      toMeeting(meetingRow({ homeScore: 2, awayScore: 0 }), HOME),
      // Rôles inversés : HOME s'impose 2-1 à l'extérieur.
      toMeeting(
        meetingRow({
          homeTeamId: AWAY,
          awayTeamId: HOME,
          homeScore: 1,
          awayScore: 2,
        }),
        HOME,
      ),
      toMeeting(meetingRow({ homeScore: 1, awayScore: 1 }), HOME),
    ];

    const aggregates = buildH2HAggregates(meetings);

    expect(aggregates.sampleSize).toBe(3);
    expect(aggregates.homeTeamWins).toBe(2);
    expect(aggregates.draws).toBe(1);
    expect(aggregates.awayTeamWins).toBe(0);
  });

  it('calcule moyenne de buts et taux over/BTTS', () => {
    const meetings = [
      toMeeting(meetingRow({ homeScore: 2, awayScore: 1 }), HOME), // 3 buts, btts
      toMeeting(meetingRow({ homeScore: 1, awayScore: 0 }), HOME), // 1 but
    ];

    const aggregates = buildH2HAggregates(meetings);

    expect(aggregates.goalsPerMatch).toBe(2);
    expect(aggregates.over15Rate).toBe(0.5);
    expect(aggregates.over25Rate).toBe(0.5);
    expect(aggregates.bttsRate).toBe(0.5);
  });

  it('rend des taux null plutôt que NaN sans confrontation', () => {
    const aggregates = buildH2HAggregates([]);

    expect(aggregates.sampleSize).toBe(0);
    expect(aggregates.goalsPerMatch).toBeNull();
    expect(aggregates.bttsRate).toBeNull();
  });
});

describe('buildH2HScoreExplanation', () => {
  it('documente la formule et les paramètres réellement utilisés par le moteur', () => {
    const score = buildH2HScoreExplanation({
      value: 0.72,
      sampleSize: 5,
      homeProbability: 0.5,
      awayProbability: 0.25,
    });

    expect(score.value).toBe(0.72);
    expect(score.favorite).toBe('HOME');
    expect(score.decay).toBe(0.8);
    expect(score.drawScore).toBe(0.5);
    expect(score.minSample).toBe(3);
    expect(score.formula).toContain('0.8^i');
  });

  it('motive un score absent par un échantillon trop court', () => {
    const score = buildH2HScoreExplanation({
      value: null,
      sampleSize: 2,
      homeProbability: 0.4,
      awayProbability: 0.35,
    });

    expect(score.reason).toBe('sample_too_small');
    expect(score.favorite).toBeNull();
  });

  it('n’annonce aucun favori quand les probabilités manquent', () => {
    const score = buildH2HScoreExplanation({
      value: 0.6,
      sampleSize: 4,
      homeProbability: null,
      awayProbability: null,
    });

    expect(score.favorite).toBeNull();
  });
});

describe('buildH2HBlock', () => {
  it('expose au plus 10 confrontations', () => {
    const rows = Array.from({ length: 14 }, (_, i) =>
      meetingRow({ fixtureId: `fx-${i}` }),
    );

    const block = buildH2HBlock({
      rows,
      homeTeamId: HOME,
      shadowH2h: 0.6,
      shadowH2hSampleSize: 5,
      homeProbability: 0.5,
      awayProbability: 0.2,
    });

    expect(block.meetings).toHaveLength(10);
    expect(block.aggregates.sampleSize).toBe(10);
  });
});
