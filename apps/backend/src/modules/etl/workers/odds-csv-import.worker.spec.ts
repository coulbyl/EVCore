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

describe('OddsCsvImportWorker', () => {
  const fixtureService = {
    findByDateAndTeams: vi.fn(),
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
});
