import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import pino from 'pino';
import { OddsCsvRowSchema, type OddsCsvRow } from '../schemas/odds-csv.schema';
import { FixtureService } from '../../fixture/fixture.service';
import { ETL_CONSTANTS, BULLMQ_QUEUES } from '@config/etl.constants';

export type OddsCsvImportJobData = {
  // Season code in football-data.co.uk format: '2122', '2223', '2324', '2425'
  seasonCode: string;
};

const logger = pino({ name: 'odds-csv-import-worker' });

@Processor(BULLMQ_QUEUES.ODDS_CSV_IMPORT)
export class OddsCsvImportWorker extends WorkerHost {
  constructor(private readonly fixtureService: FixtureService) {
    super();
  }

  async process(job: Job<OddsCsvImportJobData>): Promise<void> {
    const { seasonCode } = job.data;
    const url = `${ETL_CONSTANTS.CSV_ODDS_BASE}/${seasonCode}/E0.csv`;

    logger.info({ seasonCode, url }, 'Starting odds CSV import');

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

    for (const raw of rows) {
      const parsed = OddsCsvRowSchema.safeParse(raw);

      if (!parsed.success) {
        logger.warn(
          { issues: parsed.error.issues, row: raw },
          'Invalid CSV row — skipping',
        );
        skipped++;
        continue;
      }

      const row = parsed.data;
      const matchDate = parseDdMmYyyy(row.Date);

      const fixture = await this.fixtureService.findByDateAndTeams(
        matchDate,
        row.HomeTeam,
        row.AwayTeam,
      );

      if (!fixture) {
        logger.warn(
          { date: row.Date, home: row.HomeTeam, away: row.AwayTeam },
          'No fixture found — skipping row',
        );
        noFixture++;
        continue;
      }

      // Closing odds snapshot — one record per bookmaker present in the row
      const snapshotAt = matchDate;
      const snapshots = buildSnapshots(row, fixture.id, snapshotAt);

      for (const snap of snapshots) {
        await this.fixtureService.upsertOneXTwoOddsSnapshot(snap);
        imported++;
      }
    }

    logger.info(
      { seasonCode, imported, skipped, noFixture },
      'Odds CSV import complete',
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
