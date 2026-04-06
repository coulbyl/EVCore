import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { FixtureService } from '../../fixture/fixture.service';
import type { NotificationService } from '../../notification/notification.service';
import { OddsCsvImportWorker } from './odds-csv-import.worker';

const CSV_HEADER = [
  'Date',
  'HomeTeam',
  'AwayTeam',
  'FTHG',
  'FTAG',
  'FTR',
  'PSCH',
  'PSCD',
  'PSCA',
  'B365CH',
  'B365CD',
  'B365CA',
].join(',');

const CSV_ROW = [
  '05/08/2024',
  'Juventus',
  'Inter',
  '1',
  '0',
  'H',
  '2.20',
  '3.40',
  '3.10',
  '2.25',
  '3.35',
  '3.05',
].join(',');

const EXTRA_CSV_HEADER = [
  'Country',
  'League',
  'Season',
  'Date',
  'Time',
  'Home',
  'Away',
  'HG',
  'AG',
  'Res',
  'PSCH',
  'PSCD',
  'PSCA',
  'B365CH',
  'B365CD',
  'B365CA',
].join(',');

describe('OddsCsvImportWorker', () => {
  const fixtureService = {
    findByDateAndTeams: vi.fn(),
    findCandidatesByDate: vi.fn().mockResolvedValue([]),
    hasOneXTwoOddsSnapshot: vi.fn().mockResolvedValue(false),
    upsertOneXTwoOddsSnapshot: vi.fn().mockResolvedValue({ id: 'snapshot-id' }),
  } satisfies Partial<FixtureService>;

  const notification = {
    sendEtlFailureAlert: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<NotificationService>;

  const worker = new OddsCsvImportWorker(
    fixtureService as unknown as FixtureService,
    notification as unknown as NotificationService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    fixtureService.findCandidatesByDate.mockResolvedValue([]);
    fixtureService.hasOneXTwoOddsSnapshot.mockResolvedValue(false);
    fixtureService.upsertOneXTwoOddsSnapshot.mockResolvedValue({
      id: 'snapshot-id',
    });
  });

  it('builds URL from seasonCode/divisionCode and passes competitionCode to fixture lookup', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(`${CSV_HEADER}\n${CSV_ROW}`),
    });

    await worker.process({
      data: { competitionCode: 'SA', seasonCode: '2425', divisionCode: 'I1' },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fetch).toHaveBeenCalledWith(
      'https://www.football-data.co.uk/mmz4281/2425/I1.csv',
    );
    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'SA',
        homeTeamName: 'Juventus',
        awayTeamName: 'Inter',
      }),
    );
    expect(fixtureService.upsertOneXTwoOddsSnapshot).toHaveBeenCalledTimes(2);
    expect(fixtureService.upsertOneXTwoOddsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ bookmaker: 'Pinnacle' }),
    );
    expect(fixtureService.upsertOneXTwoOddsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ bookmaker: 'Bet365' }),
    );
  });

  it('skips bookmaker snapshots already imported for the fixture', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    fixtureService.hasOneXTwoOddsSnapshot
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(`${CSV_HEADER}\n${CSV_ROW}`),
    });

    await worker.process({
      data: { competitionCode: 'SA', seasonCode: '2425', divisionCode: 'I1' },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.hasOneXTwoOddsSnapshot).toHaveBeenCalledTimes(2);
    expect(fixtureService.upsertOneXTwoOddsSnapshot).toHaveBeenCalledTimes(1);
    expect(fixtureService.upsertOneXTwoOddsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ bookmaker: 'Bet365' }),
    );
  });

  it('accepts rows where Bet365 closing odds are zero and still imports Pinnacle', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          `${CSV_HEADER}\n05/08/2024,Juventus,Inter,1,0,H,2.20,3.40,3.10,0,0,0`,
        ),
    });

    await worker.process({
      data: { competitionCode: 'SA', seasonCode: '2425', divisionCode: 'I1' },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.upsertOneXTwoOddsSnapshot).toHaveBeenCalledTimes(1);
    expect(fixtureService.upsertOneXTwoOddsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ bookmaker: 'Pinnacle' }),
    );
  });

  it('skips row when fixture is not found', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue(null);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(`${CSV_HEADER}\n${CSV_ROW}`),
    });

    await worker.process({
      data: { competitionCode: 'SA', seasonCode: '2425', divisionCode: 'I1' },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.upsertOneXTwoOddsSnapshot).not.toHaveBeenCalled();
  });

  it('throws on non-ok CSV response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(
      worker.process({
        data: { competitionCode: 'SA', seasonCode: '2425', divisionCode: 'I1' },
      } as Job<{
        competitionCode: string;
        seasonCode: string;
        divisionCode: string;
      }>),
    ).rejects.toThrow('football-data.co.uk responded 404 for season 2425');
  });

  it('uses non-seasonal extra-league URL and filters JPN rows by start year', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          [
            EXTRA_CSV_HEADER,
            [
              'Japan',
              ' J1 League',
              '2023',
              '05/08/2023',
              '10:00',
              'Gamba Osaka',
              'Vissel Kobe',
              '1',
              '0',
              'H',
              '2.20',
              '3.40',
              '3.10',
              '2.25',
              '3.35',
              '3.05',
            ].join(','),
            [
              'Japan',
              ' J1 League',
              '2024',
              '05/08/2024',
              '10:00',
              'Gamba Osaka',
              'Vissel Kobe',
              '1',
              '0',
              'H',
              '2.20',
              '3.40',
              '3.10',
              '2.25',
              '3.35',
              '3.05',
            ].join(','),
          ].join('\n'),
        ),
    });

    await worker.process({
      data: { competitionCode: 'J1', seasonCode: '2324', divisionCode: 'JPN' },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fetch).toHaveBeenCalledWith(
      'https://www.football-data.co.uk/new/JPN.csv',
    );
    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledTimes(1);
    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'J1',
        homeTeamName: 'Gamba Osaka',
        awayTeamName: 'Vissel Kobe',
      }),
    );
  });

  it('maps J1 short CSV names to API-Football team names before fixture lookup', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          [
            EXTRA_CSV_HEADER,
            [
              'Japan',
              ' J1 League',
              '2025',
              '09/11/2025',
              '05:00',
              'Machida',
              'Urawa Reds',
              '1',
              '0',
              'H',
              '2.20',
              '3.40',
              '3.10',
              '2.25',
              '3.35',
              '3.05',
            ].join(','),
          ].join('\n'),
        ),
    });

    await worker.process({
      data: { competitionCode: 'J1', seasonCode: '2526', divisionCode: 'JPN' },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'J1',
        homeTeamName: 'Machida Zelvia',
        awayTeamName: 'Urawa',
      }),
    );
  });

  it('maps EL1 short CSV names to API-Football team names before fixture lookup', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          `${CSV_HEADER}\n05/08/2024,Stockport,Peterboro,1,0,H,2.20,3.40,3.10,2.25,3.35,3.05`,
        ),
    });

    await worker.process({
      data: {
        competitionCode: 'EL1',
        seasonCode: '2425',
        divisionCode: 'E1',
      },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'EL1',
        homeTeamName: 'Stockport County',
        awayTeamName: 'Peterborough',
      }),
    );
  });

  it('maps EL2 short CSV names to API-Football team names before fixture lookup', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          `${CSV_HEADER}\n05/08/2024,Swindon,Crewe,1,0,H,2.20,3.40,3.10,2.25,3.35,3.05`,
        ),
    });

    await worker.process({
      data: {
        competitionCode: 'EL2',
        seasonCode: '2425',
        divisionCode: 'E2',
      },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'EL2',
        homeTeamName: 'Swindon Town',
        awayTeamName: 'Crewe',
      }),
    );
  });

  it('maps F2 short CSV names to API-Football team names before fixture lookup', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          `${CSV_HEADER}\n05/08/2024,Quevilly Rouen,Pau FC,1,0,H,2.20,3.40,3.10,2.25,3.35,3.05`,
        ),
    });

    await worker.process({
      data: {
        competitionCode: 'F2',
        seasonCode: '2425',
        divisionCode: 'F2',
      },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'F2',
        homeTeamName: 'Quevilly',
        awayTeamName: 'PAU',
      }),
    );
  });

  it('maps POR short CSV names to API-Football team names before fixture lookup', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          `${CSV_HEADER}\n05/08/2024,Sp Braga,Porto,1,0,H,2.20,3.40,3.10,2.25,3.35,3.05`,
        ),
    });

    await worker.process({
      data: {
        competitionCode: 'POR',
        seasonCode: '2425',
        divisionCode: 'P1',
      },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'POR',
        homeTeamName: 'SC Braga',
        awayTeamName: 'FC Porto',
      }),
    );
  });

  it('maps SP2 short CSV names to API-Football team names before fixture lookup', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          `${CSV_HEADER}\n05/08/2024,Sp Gijon,La Coruna,1,0,H,2.20,3.40,3.10,2.25,3.35,3.05`,
        ),
    });

    await worker.process({
      data: {
        competitionCode: 'SP2',
        seasonCode: '2425',
        divisionCode: 'SP2',
      },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'SP2',
        homeTeamName: 'Sporting Gijon',
        awayTeamName: 'Deportivo La Coruna',
      }),
    );
  });

  it('maps D2 short CSV names to API-Football team names before fixture lookup', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          `${CSV_HEADER}\n05/08/2024,Greuther Furth,Nurnberg,1,0,H,2.20,3.40,3.10,2.25,3.35,3.05`,
        ),
    });

    await worker.process({
      data: {
        competitionCode: 'D2',
        seasonCode: '2425',
        divisionCode: 'D2',
      },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'D2',
        homeTeamName: 'SpVgg Greuther Fürth',
        awayTeamName: '1. FC Nürnberg',
      }),
    );
  });

  it('maps ERD short CSV names to API-Football team names before fixture lookup', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          `${CSV_HEADER}\n05/08/2024,Nijmegen,Zwolle,1,0,H,2.20,3.40,3.10,2.25,3.35,3.05`,
        ),
    });

    await worker.process({
      data: {
        competitionCode: 'ERD',
        seasonCode: '2425',
        divisionCode: 'N1',
      },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'ERD',
        homeTeamName: 'NEC Nijmegen',
        awayTeamName: 'PEC Zwolle',
      }),
    );
  });

  it('uses non-seasonal extra-league URL and filters MEX rows by start year', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          [
            EXTRA_CSV_HEADER,
            [
              'Mexico',
              'Liga MX',
              '2023/2024',
              '05/08/2023',
              '03:00',
              'Monterrey',
              'Club America',
              '1',
              '1',
              'D',
              '2.20',
              '3.40',
              '3.10',
              '2.25',
              '3.35',
              '3.05',
            ].join(','),
            [
              'Mexico',
              'Liga MX',
              '2024/2025',
              '05/08/2024',
              '03:00',
              'Monterrey',
              'Club America',
              '1',
              '1',
              'D',
              '2.20',
              '3.40',
              '3.10',
              '2.25',
              '3.35',
              '3.05',
            ].join(','),
          ].join('\n'),
        ),
    });

    await worker.process({
      data: {
        competitionCode: 'MX1',
        seasonCode: '2324',
        divisionCode: 'MEX',
      },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fetch).toHaveBeenCalledWith(
      'https://www.football-data.co.uk/new/MEX.csv',
    );
    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledTimes(1);
    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'MX1',
        homeTeamName: 'Monterrey',
        awayTeamName: 'Club America',
      }),
    );
  });

  it('maps Liga MX short CSV names to API-Football team names before fixture lookup', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          [
            EXTRA_CSV_HEADER,
            [
              'Mexico',
              'Liga MX',
              '2024/2025',
              '17/07/2024',
              '01:00',
              'Queretaro',
              'UNAM Pumas',
              '1',
              '0',
              'H',
              '2.20',
              '3.40',
              '3.10',
              '2.25',
              '3.35',
              '3.05',
            ].join(','),
          ].join('\n'),
        ),
    });

    await worker.process({
      data: {
        competitionCode: 'MX1',
        seasonCode: '2425',
        divisionCode: 'MEX',
      },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'MX1',
        homeTeamName: 'Club Queretaro',
        awayTeamName: 'U.N.A.M. - Pumas',
      }),
    );
  });

  it('maps La Liga short CSV names to API-Football team names before fixture lookup', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          `${CSV_HEADER}\n05/08/2024,Espanol,Ath Madrid,1,0,H,2.20,3.40,3.10,2.25,3.35,3.05`,
        ),
    });

    await worker.process({
      data: { competitionCode: 'LL', seasonCode: '2425', divisionCode: 'SP1' },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'LL',
        homeTeamName: 'Espanyol',
        awayTeamName: 'Atletico Madrid',
      }),
    );
  });

  it('maps Ligue 1 short CSV names to API-Football team names before fixture lookup', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          `${CSV_HEADER}\n05/08/2024,Brest,Paris SG,1,0,H,2.20,3.40,3.10,2.25,3.35,3.05`,
        ),
    });

    await worker.process({
      data: { competitionCode: 'L1', seasonCode: '2425', divisionCode: 'F1' },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'L1',
        homeTeamName: 'Stade Brestois 29',
        awayTeamName: 'Paris Saint Germain',
      }),
    );
  });

  it('normalizes whitespace in CSV team aliases before fixture lookup', async () => {
    fixtureService.findByDateAndTeams.mockResolvedValue({ id: 'fixture-id' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue(
          `${CSV_HEADER}\n05/08/2024,Nice,Paris\u00A0SG,1,0,H,2.20,3.40,3.10,2.25,3.35,3.05`,
        ),
    });

    await worker.process({
      data: { competitionCode: 'L1', seasonCode: '2425', divisionCode: 'F1' },
    } as Job<{
      competitionCode: string;
      seasonCode: string;
      divisionCode: string;
    }>);

    expect(fixtureService.findByDateAndTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: 'L1',
        homeTeamName: 'Nice',
        awayTeamName: 'Paris Saint Germain',
      }),
    );
  });
});
