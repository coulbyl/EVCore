import { Worker, type Job } from "bullmq";
import type { Logger } from "pino";
import type { Config } from "../config";
import type { LlmClients } from "../groq/client";
import { analyzeFixture } from "../vantage/analyze-fixture";
import { runCouponGeneration } from "../coupon/run-coupon-generation";
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

  return new Worker<VantageJobData>(
    VANTAGE_QUEUE_NAME,
    async (job: Job<VantageJobData>) => {
      if (job.name === "sweep") {
        return runSweep(queue, config, logger);
      }
      if (job.name === "analyze") {
        const { fixtureId } = job.data as AnalyzeJobData;
        return analyzeFixture(fixtureId, llmClients, config, logger);
      }
      if (job.name === "generate-coupons") {
        const { date } = job.data as CouponJobData;
        return runCouponGeneration(
          date ?? tomorrowUtc(),
          llmClients,
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
