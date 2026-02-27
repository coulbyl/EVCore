import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import pino from 'pino';
import { UnderstatSeasonSchema } from '../schemas/xg.schema';
import { FixtureService } from '../../fixture/fixture.service';
import { ETL_CONSTANTS, BULLMQ_QUEUES } from '@config/etl.constants';
import { sleep } from '../etl.utils';
import { parseUnderstatDatetimeUtc } from '@utils/date.utils';

export type XgSyncJobData = { season: number };

const logger = pino({ name: 'xg-sync-worker' });

// Understat injects match data as JSON.parse('<hex-escaped JSON>') in <script> tags.
// We extract and decode the datesData variable.
function extractDatesData(html: string): unknown {
  const match = html.match(/var datesData\s*=\s*JSON\.parse\('(.+?)'\)/s);
  if (!match?.[1]) {
    throw new Error('datesData variable not found in Understat HTML');
  }
  // The string uses \xHH and \uXXXX escape sequences — decode them manually
  const decoded = match[1]
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  return JSON.parse(decoded) as unknown;
}

@Processor(BULLMQ_QUEUES.XG_SYNC)
export class XgSyncWorker extends WorkerHost {
  constructor(private readonly fixtureService: FixtureService) {
    super();
  }

  async process(job: Job<XgSyncJobData>): Promise<void> {
    const { season } = job.data;
    // Understat uses the start year of the season
    const url = `${ETL_CONSTANTS.UNDERSTAT_BASE}/${season}`;

    logger.info({ season, url }, 'Starting xG sync');

    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });

    if (!res.ok) {
      throw new Error(`Understat responded ${res.status} for season ${season}`);
    }

    const html = await res.text();
    const rawData = extractDatesData(html);
    const parsed = UnderstatSeasonSchema.safeParse(rawData);

    if (!parsed.success) {
      logger.error(
        { season, issues: parsed.error.issues },
        'Zod validation failed — rejecting payload',
      );
      throw new Error(`Zod validation failed for Understat season ${season}`);
    }

    logger.info(
      { season, matchCount: parsed.data.length },
      'Matching xG to DB fixtures',
    );

    let updated = 0;
    let unmatched = 0;

    for (const match of parsed.data) {
      const date = parseUnderstatDatetimeUtc(match.datetime);

      const fixture = await this.fixtureService.findByDateAndTeams(
        date,
        match.h.title,
        match.a.title,
      );

      if (!fixture) {
        logger.warn(
          { home: match.h.title, away: match.a.title, date: match.datetime },
          'No matching fixture found — skipping',
        );
        unmatched++;
        continue;
      }

      await this.fixtureService.updateXg(
        fixture.externalId,
        match.h_xg,
        match.a_xg,
      );
      updated++;

      await sleep(50); // small pause between DB writes — not a rate limit concern here
    }

    logger.info({ season, updated, unmatched }, 'xG sync complete');
  }
}
