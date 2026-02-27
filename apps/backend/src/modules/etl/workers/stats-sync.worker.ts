import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as cheerio from 'cheerio';
import pino from 'pino';
import { SeasonStatsSchema } from '../schemas/stats.schema';
import type { TeamStatsRaw } from '../schemas/stats.schema';
import { ETL_CONSTANTS, BULLMQ_QUEUES } from '../../../config/etl.constants';

export type StatsSyncJobData = { season: number };

const logger = pino({ name: 'stats-sync-worker' });

// FBref historical season URL pattern:
// season 2021 → https://fbref.com/en/comps/9/2021-2022/2021-2022-Premier-League-Stats
function fbrefUrl(season: number): string {
  const range = `${season}-${season + 1}`;
  return `${ETL_CONSTANTS.FBREF_BASE}/${range}/${range}-Premier-League-Stats`;
}

@Processor(BULLMQ_QUEUES.STATS_SYNC)
export class StatsSyncWorker extends WorkerHost {
  async process(job: Job<StatsSyncJobData>): Promise<void> {
    const { season } = job.data;
    const url = fbrefUrl(season);

    logger.info({ season, url }, 'Starting stats sync');

    const res = await fetch(url, {
      // FBref blocks default Node fetch UA — mimic a browser UA
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; EVCore-ETL/1.0; +https://github.com/coulbyl-studio/evcore)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      throw new Error(`FBref responded ${res.status} for season ${season}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // FBref home/away split is in the "Home/Away" performance table.
    // Table id: "stats_squads_homeaway" — rows alternate home/away per team.
    // NOTE: verify these selectors against actual FBref HTML if scraping breaks.
    const rows = $('#stats_squads_homeaway tbody tr').toArray();

    const statsMap = new Map<string, Partial<TeamStatsRaw>>();

    for (const row of rows) {
      const $row = $(row);

      // FBref marks home rows with data-row-type="home", away with "away"
      const rowType = $row.attr('data-row-type') as 'home' | 'away' | undefined;
      if (!rowType) continue;

      const teamName = $row.find('[data-stat="team"]').text().trim();
      if (!teamName) continue;

      const stat = (name: string): number => {
        const val = $row.find(`[data-stat="${name}"]`).text().trim();
        const n = parseInt(val, 10);
        return isNaN(n) ? 0 : n;
      };

      const existing = statsMap.get(teamName) ?? {};

      if (rowType === 'home') {
        statsMap.set(teamName, {
          ...existing,
          teamName,
          homeWins: stat('wins'),
          homeDraws: stat('draws'),
          homeLosses: stat('losses'),
        });
      } else {
        statsMap.set(teamName, {
          ...existing,
          teamName,
          awayWins: stat('wins'),
          awayDraws: stat('draws'),
          awayLosses: stat('losses'),
        });
      }
    }

    const rawEntries = Array.from(statsMap.values());
    const parsed = SeasonStatsSchema.safeParse(rawEntries);

    if (!parsed.success) {
      logger.error(
        { season, issues: parsed.error.issues },
        'Zod validation failed — rejecting payload',
      );
      throw new Error(`Zod validation failed for FBref stats season ${season}`);
    }

    // Week 1: validate and log only. TeamStats DB writes happen in rolling-stats (Week 2)
    // once fixtures + results + xG are fully imported and afterFixtureId refs are available.
    logger.info(
      { season, teamCount: parsed.data.length, sample: parsed.data[0] },
      'Stats sync validated — data ready for rolling-stats module',
    );
  }
}
