import type { Job } from 'bullmq';
import type { NotificationService } from '../../notification/notification.service';
import type { PrismaService } from '@/prisma.service';

export type CompetitionMeta = {
  leagueId: number;
  code: string;
  name: string;
  country: string;
  isActive: boolean;
  csvDivisionCode: string | null;
  seasonStartMonth: number | null;
};

export type UpsertCompetitionInput = {
  leagueId: number;
  code: string;
  name: string;
  country: string;
  isActive: boolean;
  csvDivisionCode?: string;
  seasonStartMonth?: number;
};

export async function loadActiveCompetition(
  prisma: PrismaService,
  competitionCode: string,
): Promise<CompetitionMeta | null> {
  const competitionReader =
    'findUnique' in prisma.client.competition &&
    typeof prisma.client.competition.findUnique === 'function'
      ? prisma.client.competition.findUnique.bind(prisma.client.competition)
      : prisma.client.competition.findFirst.bind(prisma.client.competition);

  const competition = await competitionReader({
    where: { code: competitionCode },
    select: {
      leagueId: true,
      code: true,
      name: true,
      country: true,
      isActive: true,
      csvDivisionCode: true,
      seasonStartMonth: true,
    },
  });

  if (!competition) {
    throw new Error(`Competition not found in DB: ${competitionCode}`);
  }

  return competition.isActive ? competition : null;
}

export function toUpsertCompetitionInput(
  competition: CompetitionMeta,
): UpsertCompetitionInput {
  return {
    leagueId: competition.leagueId,
    name: competition.name,
    code: competition.code,
    country: competition.country,
    isActive: competition.isActive,
    csvDivisionCode: competition.csvDivisionCode ?? undefined,
    seasonStartMonth: competition.seasonStartMonth ?? undefined,
  };
}

type WorkerFailureContext<T> = {
  notification: NotificationService;
  queueName: string;
  job: Job<T> | undefined;
  error: Error;
  logger: {
    error: (obj: Record<string, unknown>, msg: string) => void;
    warn: (obj: Record<string, unknown>, msg: string) => void;
  };
};

const TRANSIENT_NETWORK_CODES = [
  'ETIMEDOUT',
  'ECONNRESET',
  'ENOTFOUND',
] as const;

function getNetworkErrorCode(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  return (err.cause as Record<string, unknown> | undefined)?.['code'] as
    | string
    | undefined;
}

export function getTransientNetworkErrorCode(err: unknown): string | undefined {
  const code = getNetworkErrorCode(err);
  return code !== undefined &&
    (TRANSIENT_NETWORK_CODES as readonly string[]).includes(code)
    ? code
    : undefined;
}

/**
 * Wraps fetch() with transient network error handling.
 * Returns null when the error is transient (ETIMEDOUT / ECONNRESET / ENOTFOUND)
 * so callers can skip the current item and continue their loop.
 * Re-throws all other errors so BullMQ can handle retries at job level.
 */
export async function fetchOrSkip(
  url: string,
  options: RequestInit,
): Promise<Response | null> {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (getTransientNetworkErrorCode(err) !== undefined) {
      return null;
    }
    throw err;
  }
}

export function isTransientNetworkError(err: unknown): boolean {
  return getTransientNetworkErrorCode(err) !== undefined;
}

export async function fetchOrSkipWithMeta(
  url: string,
  options: RequestInit,
): Promise<{ response: Response | null; transientErrorCode?: string }> {
  try {
    return { response: await fetch(url, options) };
  } catch (err) {
    const transientErrorCode = getTransientNetworkErrorCode(err);
    if (transientErrorCode !== undefined) {
      return { response: null, transientErrorCode };
    }
    throw err;
  }
}

export function notifyOnWorkerFailure<T>({
  notification,
  queueName,
  job,
  error,
  logger,
}: WorkerFailureContext<T>): void {
  const isFinalAttempt =
    job !== undefined && job.attemptsMade >= (job.opts.attempts ?? 1);

  if (isFinalAttempt) {
    logger.error(
      {
        jobName: job.name,
        attempts: job.attemptsMade,
        errorMessage: error.message,
      },
      'Job permanently failed — sending alert',
    );
    void notification.sendEtlFailureAlert(queueName, job.name, error.message);
    return;
  }

  logger.warn(
    {
      jobName: job?.name,
      attempt: job?.attemptsMade,
      errorMessage: error.message,
    },
    'Job attempt failed — will retry',
  );
}
