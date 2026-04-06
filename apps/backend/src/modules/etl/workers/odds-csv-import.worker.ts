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
const EXTRA_LEAGUE_DIVISION_CODES = new Set(['JPN', 'MEX']);

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
    const url = buildCsvUrl(seasonCode, divisionCode);

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
    const rows = filterRowsForJob(parseCsv(text), job.data);

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
        const candidates = await this.fixtureService.findCandidatesByDate({
          date: matchDate,
          competitionCode,
        });

        logger.warn(
          {
            competitionCode,
            date: row.Date,
            home: row.HomeTeam,
            away: row.AwayTeam,
            lookupHome: resolveTeamName(row.HomeTeam),
            lookupAway: resolveTeamName(row.AwayTeam),
            reason:
              candidates.length === 0
                ? 'no-fixtures-on-date'
                : 'fixtures-found-but-teams-differ',
            candidateFixtures: candidates.map((candidate) => ({
              scheduledAt: candidate.scheduledAt,
              home: candidate.homeTeam.name,
              away: candidate.awayTeam.name,
            })),
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
  // ERD (N1)
  'For Sittard': 'Fortuna Sittard',
  Nijmegen: 'NEC Nijmegen',
  Volendam: 'FC Volendam',
  Waalwijk: 'RKC Waalwijk',
  Zwolle: 'PEC Zwolle',
  'Go Ahead Eagles': 'GO Ahead Eagles',
  // POR (P1)
  'Gil Vicente': 'GIL Vicente',
  Porto: 'FC Porto',
  'Sp Braga': 'SC Braga',
  'Sp Lisbon': 'Sporting CP',
  // LL (SP1)
  'Ath Bilbao': 'Athletic Club',
  'Ath Madrid': 'Atletico Madrid',
  Betis: 'Real Betis',
  Brest: 'Stade Brestois 29',
  Celta: 'Celta Vigo',
  Espanol: 'Espanyol',
  Sociedad: 'Real Sociedad',
  Vallecano: 'Rayo Vallecano',
  // SP2 (SP2)
  Andorra: 'FC Andorra',
  Castellon: 'Castellón',
  Ceuta: 'AD Ceuta FC',
  Ferrol: 'Racing Ferrol',
  'La Coruna': 'Deportivo La Coruna',
  Santander: 'Racing Santander',
  'Sociedad B': 'Real Sociedad II',
  'Sp Gijon': 'Sporting Gijon',
  'Villarreal B': 'Villarreal II',
  Granada: 'Granada CF',
  // L1 (F1)
  Clermont: 'Clermont Foot',
  'Paris SG': 'Paris Saint Germain',
  'St Etienne': 'Saint Etienne',
  // F2 (F2)
  'Pau FC': 'PAU',
  'Quevilly Rouen': 'Quevilly',
  'Red Star': 'RED Star FC 93',
  Troyes: 'Estac Troyes',
  // EL1 / EL2 (E1 / E2)
  Accrington: 'Accrington ST',
  'Bristol Rvs': 'Bristol Rovers',
  Burton: 'Burton Albion',
  Cambridge: 'Cambridge United',
  Crawley: 'Crawley Town',
  Exeter: 'Exeter City',
  Fleetwood: 'Fleetwood Town',
  Harrogate: 'Harrogate Town',
  Mansfield: 'Mansfield Town',
  'MK Dons': 'Milton Keynes Dons',
  Newport: 'Newport County',
  'Notts Co': 'Notts County',
  Oxford: 'Oxford United',
  Peterboro: 'Peterborough',
  Salford: 'Salford City',
  Stockport: 'Stockport County',
  Sutton: 'Sutton Utd',
  Swindon: 'Swindon Town',
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
  // D2 (D2)
  Braunschweig: 'Eintracht Braunschweig',
  Dresden: 'Dynamo Dresden',
  Elversberg: 'SV Elversberg',
  Hamburg: 'Hamburger SV',
  Hannover: 'Hannover 96',
  Hertha: 'Hertha BSC',
  Karlsruhe: 'Karlsruher SC',
  Kaiserslautern: '1. FC Kaiserslautern',
  Magdeburg: '1. FC Magdeburg',
  Nurnberg: '1. FC Nürnberg',
  Osnabruck: 'VfL Osnabrück',
  Paderborn: 'SC Paderborn 07',
  Regensburg: 'SSV Jahn Regensburg',
  'Schalke 04': 'FC Schalke 04',
  'St Pauli': 'FC St. Pauli',
  Ulm: 'SSV Ulm 1846',
  Wehen: 'SV Wehen',
  'Greuther Furth': 'SpVgg Greuther Fürth',
  'Fortuna Dusseldorf': 'Fortuna Düsseldorf',
  Bielefeld: 'Arminia Bielefeld',
  // J1 (JPN)
  'Hokkaido Consadole Sapporo': 'Consadole Sapporo',
  Iwata: 'Jubilo Iwata',
  'Kashima Antlers': 'Kashima',
  Kyoto: 'Kyoto Sanga',
  Machida: 'Machida Zelvia',
  Okayama: 'Fagiano Okayama',
  'Shimizu S-Pulse': 'Shimizu S-pulse',
  'Urawa Reds': 'Urawa',
  Verdy: 'Tokyo Verdy',
  // MX1 (MEX)
  'Atl. San Luis': 'Atletico San Luis',
  'Club Leon': 'Leon',
  Juarez: 'FC Juarez',
  'Mazatlan FC': 'Mazatlán',
  Queretaro: 'Club Queretaro',
  'UNAM Pumas': 'U.N.A.M. - Pumas',
};

function resolveTeamName(csvName: string): string {
  const normalized = normalizeTeamAliasKey(csvName);
  return NORMALIZED_CSV_TEAM_ALIASES[normalized] ?? csvName.trim();
}

const NORMALIZED_CSV_TEAM_ALIASES = Object.fromEntries(
  Object.entries(CSV_TEAM_ALIASES).map(([key, value]) => [
    normalizeTeamAliasKey(key),
    value,
  ]),
);

function normalizeTeamAliasKey(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns true when all closing odds columns are absent or "0".
// This is the normal state for current-season rows where the bookmaker
// has not yet published closing odds — not a data quality issue.
function hasNoClosingOdds(raw: Record<string, string>): boolean {
  const cols = ['PSCH', 'PSCD', 'PSCA', 'B365CH', 'B365CD', 'B365CA'];
  return cols.every((col) => !raw[col] || raw[col] === '0');
}

function buildCsvUrl(seasonCode: string, divisionCode: string): string {
  if (EXTRA_LEAGUE_DIVISION_CODES.has(divisionCode)) {
    return `https://www.football-data.co.uk/new/${divisionCode}.csv`;
  }

  return `${ETL_CONSTANTS.CSV_ODDS_BASE}/${seasonCode}/${divisionCode}.csv`;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  const [header, ...rows] = lines;
  if (!header) return [];

  const keys = header
    .replace(/^\uFEFF/, '')
    .split(',')
    .map((k) => k.trim().replace(/\r/, ''));

  return rows
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const values = line.split(',');
      const raw = Object.fromEntries(
        keys.map((k, i) => [k, (values[i] ?? '').trim().replace(/\r/, '')]),
      );
      return normalizeCsvRow(raw);
    });
}

function normalizeCsvRow(raw: Record<string, string>): Record<string, string> {
  if (raw['HomeTeam'] && raw['AwayTeam']) {
    return raw;
  }

  if (
    raw['Home'] &&
    raw['Away'] &&
    raw['HG'] !== undefined &&
    raw['AG'] !== undefined &&
    raw['Res']
  ) {
    return {
      ...raw,
      HomeTeam: raw['Home'],
      AwayTeam: raw['Away'],
      FTHG: raw['HG'],
      FTAG: raw['AG'],
      FTR: raw['Res'],
    };
  }

  return raw;
}

function filterRowsForJob(
  rows: Record<string, string>[],
  job: OddsCsvImportJobData,
): Record<string, string>[] {
  if (!EXTRA_LEAGUE_DIVISION_CODES.has(job.divisionCode)) {
    return rows;
  }

  const targetSeasonStartYear = seasonCodeToStartYear(job.seasonCode);
  return rows.filter((row) => {
    const seasonStartYear = extractSeasonStartYear(row['Season']);
    return seasonStartYear === targetSeasonStartYear;
  });
}

function seasonCodeToStartYear(seasonCode: string): number {
  const prefix = Number(seasonCode.slice(0, 2));
  return 2000 + prefix;
}

function extractSeasonStartYear(season: string | undefined): number | null {
  if (!season) return null;

  const match = season.match(/\d{4}/);
  if (!match) return null;

  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
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
