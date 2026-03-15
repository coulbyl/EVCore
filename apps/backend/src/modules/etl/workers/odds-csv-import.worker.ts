import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import { OddsCsvRowSchema, type OddsCsvRow } from '../schemas/odds-csv.schema';
import { FixtureService } from '../../fixture/fixture.service';
import { ETL_CONSTANTS, BULLMQ_QUEUES } from '@config/etl.constants';
import { NotificationService } from '../../notification/notification.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type OddsCsvImportJobData = {
  competitionCode: string;
  // Season code in football-data.co.uk format: '2122', '2223', '2324', '2425'
  seasonCode: string;
  // Division code in football-data.co.uk format: E0, I1, SP1, D1...
  divisionCode: string;
};

const logger = createLogger('odds-csv-import-worker');

@Processor(BULLMQ_QUEUES.ODDS_CSV_IMPORT)
export class OddsCsvImportWorker extends WorkerHost {
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<OddsCsvImportJobData>): Promise<void> {
    const { competitionCode, seasonCode, divisionCode } = job.data;
    const url = `${ETL_CONSTANTS.CSV_ODDS_BASE}/${seasonCode}/${divisionCode}.csv`;

    logger.info(
      { competitionCode, seasonCode, divisionCode, url },
      'Starting odds CSV import',
    );

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `football-data.co.uk responded ${res.status} for season ${seasonCode}`,
      );
    }

    const text = await res.text();
    const rows = parseCsv(text);

    logger.info({ seasonCode, rowCount: rows.length }, 'CSV parsed');

    let imported = 0;
    let skipped = 0;
    let noFixture = 0;
    let alreadyImported = 0;

    for (const raw of rows) {
      // Rows for unplayed matches or matches where closing odds are not yet
      // published have all odds columns set to "0" or empty. This is normal
      // for the current season CSV — skip silently instead of logging a warn.
      if (hasNoClosingOdds(raw)) {
        logger.debug(
          { date: raw['Date'], home: raw['HomeTeam'], away: raw['AwayTeam'] },
          'No closing odds available yet — skipping row',
        );
        skipped++;
        continue;
      }

      const parsed = OddsCsvRowSchema.safeParse(raw);

      if (!parsed.success) {
        logger.warn(
          {
            issues: parsed.error.issues,
            date: raw['Date'],
            home: raw['HomeTeam'],
            away: raw['AwayTeam'],
          },
          'Invalid CSV row — skipping',
        );
        skipped++;
        continue;
      }

      const row = parsed.data;
      const matchDate = parseDdMmYyyy(row.Date);

      const fixture = await this.fixtureService.findByDateAndTeams({
        date: matchDate,
        homeTeamName: resolveTeamName(row.HomeTeam),
        awayTeamName: resolveTeamName(row.AwayTeam),
        competitionCode,
      });

      if (!fixture) {
        logger.warn(
          {
            competitionCode,
            date: row.Date,
            home: row.HomeTeam,
            away: row.AwayTeam,
          },
          'No fixture found — skipping row',
        );
        noFixture++;
        continue;
      }

      // Closing odds snapshot — one record per bookmaker present in the row
      const snapshotAt = matchDate;
      const snapshots = buildSnapshots(row, fixture.id, snapshotAt);

      for (const snap of snapshots) {
        const exists = await this.fixtureService.hasOneXTwoOddsSnapshot({
          fixtureId: snap.fixtureId,
          bookmaker: snap.bookmaker,
          snapshotAt: snap.snapshotAt,
        });

        if (exists) {
          alreadyImported++;
          continue;
        }

        await this.fixtureService.upsertOneXTwoOddsSnapshot(snap);
        imported++;
      }
    }

    logger.info(
      {
        competitionCode,
        seasonCode,
        divisionCode,
        imported,
        skipped,
        noFixture,
        alreadyImported,
      },
      'Odds CSV import complete',
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OddsCsvImportJobData> | undefined, error: Error): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.ODDS_CSV_IMPORT,
      job,
      error,
      logger,
    });
  }
}

// ─── Team name aliases ────────────────────────────────────────────────────────

// football-data.co.uk uses abbreviated/shortened team names that don't match
// the canonical names stored from API-Football. This map translates CSV names
// to their DB equivalents before lookup.
const CSV_TEAM_ALIASES: Record<string, string> = {
  // PL (E0)
  'Man City': 'Manchester City',
  'Man United': 'Manchester United',
  "Nott'm Forest": 'Nottingham Forest',
  'Sheffield United': 'Sheffield Utd',
  // SA (I1)
  Milan: 'AC Milan',
  Roma: 'AS Roma',
  Verona: 'Hellas Verona',
  // LL (SP1)
  'Ath Bilbao': 'Athletic Club',
  'Ath Madrid': 'Atletico Madrid',
  Betis: 'Real Betis',
  Celta: 'Celta Vigo',
  Sociedad: 'Real Sociedad',
  Vallecano: 'Rayo Vallecano',
  // BL1 (D1)
  'Bayern Munich': 'Bayern München',
  'FC Koln': '1. FC Köln',
  Dortmund: 'Borussia Dortmund',
  "M'gladbach": 'Borussia Mönchengladbach',
  'Ein Frankfurt': 'Eintracht Frankfurt',
  Heidenheim: '1. FC Heidenheim',
  Hoffenheim: '1899 Hoffenheim',
  Leverkusen: 'Bayer Leverkusen',
  Mainz: 'FSV Mainz 05',
  Stuttgart: 'VfB Stuttgart',
  Wolfsburg: 'VfL Wolfsburg',
  Augsburg: 'FC Augsburg',
  Freiburg: 'SC Freiburg',
  Bochum: 'VfL Bochum',
  Darmstadt: 'SV Darmstadt 98',
};

function resolveTeamName(csvName: string): string {
  return CSV_TEAM_ALIASES[csvName] ?? csvName;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns true when all closing odds columns are absent or "0".
// This is the normal state for current-season rows where the bookmaker
// has not yet published closing odds — not a data quality issue.
function hasNoClosingOdds(raw: Record<string, string>): boolean {
  const cols = ['PSCH', 'PSCD', 'PSCA', 'B365CH', 'B365CD', 'B365CA'];
  return cols.every((col) => !raw[col] || raw[col] === '0');
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  const [header, ...rows] = lines;
  if (!header) return [];

  const keys = header.split(',').map((k) => k.trim().replace(/\r/, ''));

  return rows
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const values = line.split(',');
      return Object.fromEntries(
        keys.map((k, i) => [k, (values[i] ?? '').trim().replace(/\r/, '')]),
      );
    });
}

function parseDdMmYyyy(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/');
  // Use noon UTC to avoid timezone edge cases near midnight
  return new Date(`${year}-${month}-${day}T12:00:00Z`);
}

type OddsSnapshotInput = {
  fixtureId: string;
  bookmaker: string;
  snapshotAt: Date;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
};

function buildSnapshots(
  row: OddsCsvRow,
  fixtureId: string,
  snapshotAt: Date,
): OddsSnapshotInput[] {
  const snapshots: OddsSnapshotInput[] = [];

  // Pinnacle closing — preferred (most efficient market, best for EV calibration)
  if (
    row.PSCH !== undefined &&
    row.PSCD !== undefined &&
    row.PSCA !== undefined
  ) {
    snapshots.push({
      fixtureId,
      bookmaker: 'Pinnacle',
      snapshotAt,
      homeOdds: row.PSCH,
      drawOdds: row.PSCD,
      awayOdds: row.PSCA,
    });
  }

  // Bet365 closing
  if (
    row.B365CH !== undefined &&
    row.B365CD !== undefined &&
    row.B365CA !== undefined
  ) {
    snapshots.push({
      fixtureId,
      bookmaker: 'Bet365',
      snapshotAt,
      homeOdds: row.B365CH,
      drawOdds: row.B365CD,
      awayOdds: row.B365CA,
    });
  }

  // Market average closing — fallback if no specific bookmaker data
  if (
    snapshots.length === 0 &&
    row.AvgCH !== undefined &&
    row.AvgCD !== undefined &&
    row.AvgCA !== undefined
  ) {
    snapshots.push({
      fixtureId,
      bookmaker: 'MarketAvg',
      snapshotAt,
      homeOdds: row.AvgCH,
      drawOdds: row.AvgCD,
      awayOdds: row.AvgCA,
    });
  }

  return snapshots;
}
