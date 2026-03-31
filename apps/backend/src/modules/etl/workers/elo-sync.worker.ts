import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { execFile } from 'node:child_process';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES, ETL_CONSTANTS } from '@config/etl.constants';
import { PrismaService } from '@/prisma.service';
import { NotificationService } from '@modules/notification/notification.service';
import { TEAM_NAME_TO_ELO_CODE } from '@modules/betting-engine/fri-elo.utils';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type EloSyncJobData = Record<string, never>;

type EloRow = {
  teamName: string;
  eloCode: string;
  rating: number;
};

const logger = createLogger('elo-sync-worker');

@Processor(BULLMQ_QUEUES.ELO_SYNC)
export class EloSyncWorker extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(_: Job<EloSyncJobData>): Promise<void> {
    logger.info('Starting Elo sync');

    const text = await this.downloadWorldEloTsv();
    const rows = parseWorldEloTsv(text);
    if (rows.length === 0) {
      throw new Error('Elo TSV parsed to zero mapped ratings');
    }

    const snapshotAt = new Date();
    await this.prisma.client.$transaction([
      this.prisma.client.nationalTeamEloRating.createMany({
        data: rows.map((row) => ({
          teamName: row.teamName,
          eloCode: row.eloCode,
          rating: row.rating,
          source: 'eloratings.net',
          snapshotAt,
        })),
      }),
      this.prisma.client.nationalTeamEloRating.deleteMany({
        where: { snapshotAt: { lt: snapshotAt } },
      }),
    ]);

    logger.info(
      { count: rows.length, snapshotAt: snapshotAt.toISOString() },
      'Elo sync complete',
    );
  }

  private async downloadWorldEloTsv(): Promise<string> {
    const curlText = await downloadWorldEloTsvViaCurl();
    if (curlText !== null) return curlText;

    const existingSnapshot =
      await this.prisma.client.nationalTeamEloRating.findFirst({
        select: { id: true, snapshotAt: true },
        orderBy: [{ snapshotAt: 'desc' }],
      });

    if (existingSnapshot === null) {
      throw new Error(
        'Elo TSV download failed via curl, and no prior Elo snapshot exists',
      );
    }

    throw new Error(
      `Elo TSV download failed via curl; keeping existing snapshot from ${existingSnapshot.snapshotAt.toISOString()}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EloSyncJobData> | undefined, error: Error): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.ELO_SYNC,
      job,
      error,
      logger,
    });
  }
}

export function parseWorldEloTsv(text: string): EloRow[] {
  const codeToRating = new Map<string, number>();

  for (const line of text.split('\n')) {
    const cols = line.trim().split('\t');
    if (cols.length < 4) continue;
    const eloCode = cols[2]?.trim();
    const rating = Number.parseInt(cols[3] ?? '', 10);
    if (eloCode && !Number.isNaN(rating)) {
      codeToRating.set(eloCode, rating);
    }
  }

  return Object.entries(TEAM_NAME_TO_ELO_CODE).flatMap(
    ([teamName, eloCode]) => {
      const rating = codeToRating.get(eloCode);
      return rating === undefined ? [] : [{ teamName, eloCode, rating }];
    },
  );
}

export async function downloadWorldEloTsvViaCurl(): Promise<string | null> {
  try {
    const stdout = await runCurlDownload();
    return stdout;
  } catch (error) {
    logger.warn(
      {
        err: describeUnknownError(error),
        url: ETL_CONSTANTS.ELO_RATINGS_WORLD_TSV_URL,
      },
      'curl fallback failed while downloading Elo TSV',
    );
    return null;
  }
}

function runCurlDownload(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      [
        '--fail',
        '--silent',
        '--show-error',
        '--location',
        ETL_CONSTANTS.ELO_RATINGS_WORLD_TSV_URL,
      ],
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function describeUnknownError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause:
        error.cause instanceof Error
          ? { name: error.cause.name, message: error.cause.message }
          : (error.cause ?? null),
    };
  }

  return { value: error };
}
