import { describe, expect, it } from 'vitest';
import {
  buildFormWindow,
  buildGoalsSplit,
  buildTeamForm,
  buildTeamGoals,
  buildTeamSchedule,
  buildTeamXg,
  wonEitherHalf,
  type PriorFixture,
} from './team-context.builder';

/** Un match joué, orienté pour l'équipe observée. Valeurs neutres par défaut. */
function played(overrides: Partial<PriorFixture> = {}): PriorFixture {
  return {
    fixtureId: 'fx',
    scheduledAt: new Date('2026-09-01T12:00:00.000Z'),
    competitionCode: 'PL',
    competitionName: 'Premier League',
    seasonName: '2026-27',
    isHome: true,
    goalsFor: 1,
    goalsAgainst: 1,
    htGoalsFor: 0,
    htGoalsAgainst: 0,
    xgFor: null,
    xgAgainst: null,
    ...overrides,
  };
}

describe('buildFormWindow', () => {
  it('compte points, buts et série sur la fenêtre demandée, du plus récent au plus ancien', () => {
    const form = buildFormWindow(
      [
        played({ goalsFor: 2, goalsAgainst: 0 }), // W
        played({ goalsFor: 1, goalsAgainst: 1 }), // D
        played({ goalsFor: 0, goalsAgainst: 3 }), // L
      ],
      5,
    );

    expect(form.sequence).toBe('WDL');
    expect(form.wins).toBe(1);
    expect(form.draws).toBe(1);
    expect(form.losses).toBe(1);
    expect(form.points).toBe(4);
    expect(form.goalsFor).toBe(3);
    expect(form.goalsAgainst).toBe(4);
  });

  it('rapporte le sampleSize réel quand la fenêtre est plus large que l’historique', () => {
    const form = buildFormWindow([played(), played()], 10);

    expect(form.window).toBe(10);
    expect(form.sampleSize).toBe(2);
    expect(form.pointsPerMatch).toBe(1);
  });

  it('ne coupe la fenêtre qu’au nombre demandé', () => {
    const fixtures = Array.from({ length: 12 }, () =>
      played({ goalsFor: 1, goalsAgainst: 0 }),
    );

    expect(buildFormWindow(fixtures, 5).sampleSize).toBe(5);
    expect(buildFormWindow(fixtures, 10).sampleSize).toBe(10);
  });

  it('rend des moyennes nulles plutôt que NaN sur un historique vide', () => {
    const form = buildFormWindow([], 5);

    expect(form.sampleSize).toBe(0);
    expect(form.sequence).toBe('');
    expect(form.pointsPerMatch).toBeNull();
    expect(form.goalsForPerMatch).toBeNull();
  });
});

describe('buildTeamForm', () => {
  it('restreint last5SameVenue au rôle tenu dans le match décrit', () => {
    const fixtures = [
      played({ isHome: true, goalsFor: 3, goalsAgainst: 0 }),
      played({ isHome: false, goalsFor: 0, goalsAgainst: 2 }),
      played({ isHome: true, goalsFor: 1, goalsAgainst: 0 }),
    ];

    const home = buildTeamForm(fixtures, 'HOME');
    expect(home.last5SameVenue.sampleSize).toBe(2);
    expect(home.last5SameVenue.sequence).toBe('WW');

    const away = buildTeamForm(fixtures, 'AWAY');
    expect(away.last5SameVenue.sampleSize).toBe(1);
    expect(away.last5SameVenue.sequence).toBe('L');
  });
});

describe('wonEitherHalf', () => {
  it('reconnaît une victoire en première mi-temps', () => {
    expect(
      wonEitherHalf(
        played({
          goalsFor: 1,
          goalsAgainst: 2,
          htGoalsFor: 1,
          htGoalsAgainst: 0,
        }),
      ),
    ).toBe(true);
  });

  it('reconnaît une victoire en seconde mi-temps, calculée par différence', () => {
    // 0-1 à la pause, 2-1 au final → seconde période gagnée 2-0.
    expect(
      wonEitherHalf(
        played({
          goalsFor: 2,
          goalsAgainst: 1,
          htGoalsFor: 0,
          htGoalsAgainst: 1,
        }),
      ),
    ).toBe(true);
  });

  it('rend false quand les deux mi-temps sont perdues ou nulles', () => {
    // 0-0 à la pause, 0-1 au final → première nulle, seconde perdue.
    expect(
      wonEitherHalf(
        played({
          goalsFor: 0,
          goalsAgainst: 1,
          htGoalsFor: 0,
          htGoalsAgainst: 0,
        }),
      ),
    ).toBe(false);
  });

  it('rend null — et non false — quand le score à la mi-temps manque', () => {
    expect(
      wonEitherHalf(played({ htGoalsFor: null, htGoalsAgainst: null })),
    ).toBeNull();
  });
});

describe('buildGoalsSplit', () => {
  it('calcule les taux over/BTTS sur le total du match, pas sur les seuls buts de l’équipe', () => {
    const split = buildGoalsSplit([
      played({ goalsFor: 2, goalsAgainst: 1 }), // 3 buts : over1.5 + over2.5 + btts
      played({ goalsFor: 1, goalsAgainst: 0 }), // 1 but  : ni over1.5 ni btts
      played({ goalsFor: 1, goalsAgainst: 1 }), // 2 buts : over1.5 + btts
    ]);

    expect(split.over15Rate).toBeCloseTo(2 / 3, 4);
    expect(split.over25Rate).toBeCloseTo(1 / 3, 4);
    expect(split.bttsRate).toBeCloseTo(2 / 3, 4);
  });

  it('compte clean sheets et matchs sans marquer', () => {
    const split = buildGoalsSplit([
      played({ goalsFor: 2, goalsAgainst: 0 }),
      played({ goalsFor: 0, goalsAgainst: 1 }),
    ]);

    expect(split.cleanSheetRate).toBe(0.5);
    expect(split.failedToScoreRate).toBe(0.5);
  });

  it('rapporte winEitherHalfRate au sous-échantillon qui a un score de mi-temps', () => {
    const split = buildGoalsSplit([
      // Gagné en 1re MT.
      played({
        goalsFor: 1,
        goalsAgainst: 2,
        htGoalsFor: 1,
        htGoalsAgainst: 0,
      }),
      // Aucune MT gagnée.
      played({
        goalsFor: 0,
        goalsAgainst: 2,
        htGoalsFor: 0,
        htGoalsAgainst: 1,
      }),
      // Score de mi-temps manquant : exclu du dénominateur.
      played({ htGoalsFor: null, htGoalsAgainst: null }),
    ]);

    expect(split.sampleSize).toBe(3);
    expect(split.halfTimeSampleSize).toBe(2);
    expect(split.winEitherHalfRate).toBe(0.5);
  });

  it('rend null quand aucun match ne porte de score à la mi-temps', () => {
    const split = buildGoalsSplit([
      played({ htGoalsFor: null, htGoalsAgainst: null }),
    ]);

    expect(split.halfTimeSampleSize).toBe(0);
    expect(split.winEitherHalfRate).toBeNull();
  });
});

describe('buildTeamGoals', () => {
  it('sépare saison en cours et saison précédente, et scinde domicile/extérieur', () => {
    const goals = buildTeamGoals(
      [
        played({ seasonName: '2026-27', isHome: true, goalsFor: 2 }),
        played({ seasonName: '2026-27', isHome: false, goalsFor: 0 }),
        played({ seasonName: '2025-26', isHome: true, goalsFor: 1 }),
      ],
      '2026-27',
    );

    expect(goals.currentSeason).toMatchObject({ seasonName: '2026-27' });
    expect(goals.previousSeason).toMatchObject({ seasonName: '2025-26' });

    const current = goals.currentSeason as { all: { sampleSize: number } };
    expect(current.all.sampleSize).toBe(2);
  });

  it('rend une absence motivée quand l’équipe n’a joué aucun match', () => {
    const goals = buildTeamGoals([], '2026-27');

    expect(goals.currentSeason).toEqual({
      value: null,
      reason: 'no_prior_fixtures',
    });
  });

  it('ancre la saison en cours sur celle du match, pas sur la plus récente jouée', () => {
    // L'équipe n'a encore rien joué en 2026-27 : la saison en cours doit être
    // vide, surtout pas la saison précédente présentée comme actuelle.
    const goals = buildTeamGoals(
      [played({ seasonName: '2025-26' })],
      '2026-27',
    );

    expect(goals.currentSeason).toEqual({
      value: null,
      reason: 'no_prior_fixtures',
    });
    expect(goals.previousSeason).toMatchObject({ seasonName: '2025-26' });
  });
});

describe('buildTeamXg', () => {
  it('moyenne sur les seuls matchs portant un xG et annonce leur nombre', () => {
    const xg = buildTeamXg(
      [
        played({ xgFor: 1.5, xgAgainst: 0.5 }),
        played({ xgFor: 0.5, xgAgainst: 1.5 }),
        played({ xgFor: null, xgAgainst: null }),
      ],
      10,
    );

    expect(xg.matchesWithXg).toBe(2);
    expect(xg.xgForPerMatch).toBe(1);
    expect(xg.xgAgainstPerMatch).toBe(1);
  });

  it('ne prétend jamais connaître la provenance du xG', () => {
    const xg = buildTeamXg([played({ xgFor: 1.2, xgAgainst: 0.8 })]);

    // xG réel et proxy tirs cadrés partagent la même colonne en base.
    expect(xg.source).toBe('unverifiable');
    expect(xg.reason).toBe('provenance_not_recorded');
  });

  it('distingue « aucun match » de « aucun xG dans l’échantillon »', () => {
    expect(buildTeamXg([]).reason).toBe('no_prior_fixtures');
    expect(buildTeamXg([played()]).reason).toBe('no_data_in_sample');
  });
});

describe('buildTeamSchedule', () => {
  const kickoff = new Date('2026-09-12T18:00:00.000Z');

  it('compte les jours de repos depuis le dernier match joué', () => {
    const schedule = buildTeamSchedule({
      kickoff,
      priorFixtures: [
        played({ scheduledAt: new Date('2026-09-09T18:00:00.000Z') }),
      ],
      nearbyFixtures: [],
      competitionCode: 'PL',
    });

    expect(schedule.restDays).toBe(3);
    expect(schedule.lastMatchCompetitionCode).toBe('PL');
  });

  it('sépare les matchs proches avant et après le coup d’envoi', () => {
    const schedule = buildTeamSchedule({
      kickoff,
      priorFixtures: [],
      nearbyFixtures: [
        {
          scheduledAt: new Date('2026-09-10T18:00:00.000Z'),
          competitionCode: 'PL',
        },
        {
          scheduledAt: new Date('2026-09-15T18:00:00.000Z'),
          competitionCode: 'PL',
        },
        // Hors fenêtre ±4 jours.
        {
          scheduledAt: new Date('2026-09-30T18:00:00.000Z'),
          competitionCode: 'PL',
        },
      ],
      competitionCode: 'PL',
    });

    expect(schedule.fixturesPrev4Days).toBe(1);
    expect(schedule.fixturesNext4Days).toBe(1);
  });

  it('signale un match d’une autre compétition dans la fenêtre ±4 jours', () => {
    const schedule = buildTeamSchedule({
      kickoff,
      priorFixtures: [],
      nearbyFixtures: [
        {
          scheduledAt: new Date('2026-09-15T18:00:00.000Z'),
          competitionCode: 'UCL',
        },
      ],
      competitionCode: 'PL',
    });

    expect(schedule.otherCompetitionWithin4Days).toMatchObject({
      competitionCode: 'UCL',
      side: 'AFTER',
    });
  });

  it('rend null sur le repos quand aucun match antérieur n’est connu', () => {
    const schedule = buildTeamSchedule({
      kickoff,
      priorFixtures: [],
      nearbyFixtures: [],
      competitionCode: 'PL',
    });

    expect(schedule.restDays).toBeNull();
    expect(schedule.lastMatchAt).toBeNull();
  });
});
