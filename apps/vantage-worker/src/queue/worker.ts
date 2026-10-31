import { Worker, type Job } from "bullmq";
import type { Logger } from "pino";
import type { Config } from "../config";
import type { LlmClients } from "../groq/client";
import { clientsFor, readLiveConfig } from "../settings";
import { analyzeFixture } from "../vantage/analyze-fixture";
import {
  runCouponGeneration,
  runIntradayCouponGeneration,
} from "../coupon/run-coupon-generation";
import { runSweep } from "./scheduler";
import {
  createQueue,
  createRedisConnection,
  VANTAGE_QUEUE_NAME,
} from "./queue";
import type { AnalyzeJobData, CouponJobData, VantageJobData } from "./queue";

function tomorrowUtc(): string {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  return tomorrow.toISOString().slice(0, 10);
}

export function createVantageWorker(
  config: Config,
  llmClients: LlmClients,
  logger: Logger,
): Worker<VantageJobData> {
  // The worker enqueues its own follow-up analysis jobs from within the sweep
  // handler, so it needs a Queue handle alongside the Worker.
  const queue = createQueue(config);
  const liveClients = (live: Config): LlmClients =>
    live === config ? llmClients : clientsFor(live);

  return new Worker<VantageJobData>(
    VANTAGE_QUEUE_NAME,
    async (job: Job<VantageJobData>) => {
      if (job.name === "sweep") {
        return runSweep(queue, config, logger);
      }
      // The provider chain and research are operator switches, read at
      // every pass (app_setting); the boot clients serve until a row says
      // otherwise.
      if (job.name === "analyze") {
        const { fixtureId } = job.data as AnalyzeJobData;
        const live = await readLiveConfig(config, logger);
        return analyzeFixture(fixtureId, liveClients(live), live, logger);
      }
      if (job.name === "generate-coupons") {
        const { date } = job.data as CouponJobData;
        const live = await readLiveConfig(config, logger);
        return runCouponGeneration(
          date ?? tomorrowUtc(),
          liveClients(live),
          logger,
        );
      }
      if (job.name === "generate-intraday-coupons") {
        const live = await readLiveConfig(config, logger);
        return runIntradayCouponGeneration(
          config.couponIntradayWindowHours,
          liveClients(live),
          logger,
        );
      }
      logger.warn({ jobName: job.name }, "vantage: unknown job name, skipping");
      return undefined;
    },
    {
      connection: createRedisConnection(config),
      // Groq is fast (LPU inference) and this is not latency-sensitive
      // (matches are analyzed hours ahead of kickoff) — a modest concurrency
      // keeps us comfortably under Groq's rate limits without needing tuning.
      concurrency: 3,
    },
  );
}
