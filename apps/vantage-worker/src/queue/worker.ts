import { Worker, type Job } from "bullmq";
import type { Logger } from "pino";
import type { Config } from "../config";
import type { LlmClients } from "../groq/client";
import { analyzeFixture } from "../vantage/analyze-fixture";
import { runSweep } from "./scheduler";
import {
  createQueue,
  createRedisConnection,
  VANTAGE_QUEUE_NAME,
} from "./queue";
import type { AnalyzeJobData, SweepJobData } from "./queue";

export function createVantageWorker(
  config: Config,
  llmClients: LlmClients,
  logger: Logger,
): Worker<AnalyzeJobData | SweepJobData> {
  // The worker enqueues its own follow-up analysis jobs from within the sweep
  // handler, so it needs a Queue handle alongside the Worker.
  const queue = createQueue(config);

  return new Worker<AnalyzeJobData | SweepJobData>(
    VANTAGE_QUEUE_NAME,
    async (job: Job<AnalyzeJobData | SweepJobData>) => {
      if (job.name === "sweep") {
        return runSweep(queue, config, logger);
      }
      if (job.name === "analyze") {
        const { fixtureId } = job.data as AnalyzeJobData;
        return analyzeFixture(fixtureId, llmClients, config, logger);
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
